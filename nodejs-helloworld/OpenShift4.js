//=================================
//OCP4 deployer
//=================================
//Return a shell script deploying OpenShift 4
function buildOCP4Deployer(){
  // Build or get the errors: the OpenShift nodes have a dependeny on the flavors: build them beforehand
  var warnings=Flavors.build()+OpenShiftNodes.build();
  // If no openshift instances are defined, display warnings and return
  if(!OpenShiftNodes.instances){
    userOutput(warnings);
    return '';
  }
  return `
_failOCP4_() {
  # if running, stop the background task disabling OpenStack ports security
  stopBackgroundSecurityDisabling
  _fail_ $*
}
# Check pre-requisites
OCPrequirements() {
  which openstack > /dev/null && _log_ "Openstack CLI available" || _failOCP4_ "Missing openstack CLI "
  which jq > /dev/null && _log_ "jq CLI available" || _failOCP4_ "Missing jq CLI"
}

# Disable port security as a workaround for OpenShift cluster intra communication
# Forever every single minute
disableSecurityPortsForInstance() {
  local _name=$1
  test -n "$_name" || _failOCP4_ "Missing openshift project for disabling port security"
  while sleep 1m ; do 
    # Identify the first subnet of the openstack network which name starts with the parameter followed by a dash
    subnet=$(openstack network list -f json | jq -r -c '.[] | select( .Name | startswith("'$\{_name}-'")) | .Subnets')
    [[ "$subnet" =~ "[" ]] && subnet=$(echo $subnet | jq -r .[0])
    [[ $subnet =~ "-" ]] || continue
    for _subnet in $subnet ; do subnetname=$(openstack subnet show $_subnet -f json | jq -r .name) 
      # Get the ports IDs on this subnet
      ports=$(openstack port list --fixed-ip subnet=$subnet -f json | jq -r -c '.[].ID' )
      # Reset security on each port
      for p in $ports ; do 
        # if port security enabled => disable
        $(openstack port show $p -f json | jq .port_security_enabled) &&
        echo BACKGROUND Disabling security on port $p subnet $subnetname &>> $logfile && 
        openstack port set $p --no-allowed-address --no-security-group --disable-port-security &>> $logfile 
      done
    done
  done
}

startBackgroundSecurityDisabling() {
  local _name=$1
  _log_ "Background task for OpenStack port security disabling started for openshift instance $_name"
  disableSecurityPortsForInstance $_name &>> $logfile  &
  PIDdisableSecurityPortsForInstance=$!
  NAMEdisableSecurityPortsForInstance=$_name
}
stopBackgroundSecurityDisabling() {
  test -n "$PIDdisableSecurityPortsForInstance" && 
  kill $PIDdisableSecurityPortsForInstance &>> $logfile && 
  wait $PIDdisableSecurityPortsForInstance 2>/dev/null &&
  unset PIDdisableSecurityPortsForInstance && 
  _log_ "Background task for OpenStack port security disabling stopped for openshift instance $NAMEdisableSecurityPortsForInstance"
}

flavorCheckAttributes() {
  local _f=$1
  # Check the flavor attributes  hw:cpu_policy hw:mem_page_size hw:numa_nodes against shared 1GB 2 respectively
  # Formatting: openstack returns the flavor properties as a string like: "hw:cpu_policy='shared', hw:mem_page_size='1GB', hw:numa_nodes='2'"
  # Thanks to tr -d ',:' the columns and commas are removed from this string to make it a valid bash variable definition set, easing the processing
  local _flavor_properties=(cpu_policy mem_page_size numa_nodes)
  local _flavor_values=(shared 1GB 2)
  for _property in $(openstack flavor show $_f  -f json | jq -r .properties | tr -d ',:') ; do eval local $_property ; done
  local _i=$\{#_flavor_properties[@]}
  local _v=""
  while (($_i)) ; do ((_i--)) && _v=hw$\{_flavor_properties[$_i]} && [[ "$\{!_v}" == "$\{_flavor_values[$_i]}" ]] || _failOCP4_  "Flavor $_f missing property hw:$\{_flavor_properties[$_i]}=$\{_flavor_values[$_i]}" ; done
}

fipCheckCreate() {
  # First argument is the *name* of the variable holding the FIP value candidate
  # Second argument: comment associated to the FIP to be created if needed
  # Invoke: fipCheckCreate FIPAPI "OpenShift FIPAPI etc"
  local _fipName=$1
  local _fipValue=$\{!_fipName}
  local _fipComment=$\{2:-OpenShift cluster floating IP $_fipName}
  local _fipID
  if test -n "$_fipValue" && [ "$_fipValue" != "?" ] ; then
    # Fip is provided: check if it exists in this project 
    _fipID=$(openstack floating ip list -f json | jq -r '.[] | select( .Project=="'$OS_PROJECT_ID'") | select( ."Floating IP Address"=="'$_fipValue'")  | .ID')
    test -n "$_fipID" && _log_ Floating IP $_fipName=$_fipValue checked || _failOCP4_ "Floating IP $_fipValue not found in OpenStack project $OS_PROJECT_NAME $OS_PROJECT_ID"
  else
    # FIP is to be created
    _fipID=$(openstack floating ip create $_extnet --description "$_fipComment" -f json | jq -r -c '.id' )
    _fipValue=$(openstack floating ip show $_fipID -f json | jq -r .floating_ip_address)
    test -n "$_fipID" && _log_ Floating IP $_fipName=$_fipValue created || _failOCP4_ "Cannot allocate floating IP $_fipName"
    # Update the input variable with its actual value
    eval $_fipName=$_fipValue
  fi
}

# Deployment
# Input parameters: _name _domain _flavor _masters _workers  _extnet _extdns _fipapi _fipapp _nbVolumes [_flavorWorker]
deployOCP() {
  local _name=$1
  local _domain=$2
  local _flavor=$3
  local _masters=$4
  local _workers=$5
  local _extnet=$6
  local _extdns=$7
  local _fipapi=$8
  local _fipapp=$9
  local _nbVolumes=$10
  local _flavorWorker=$\{11:-$_flavor}
  local _etchosts=$\{12:-false}
  
  # Check openshift deployments CLIs
  which oc > /dev/null && _log_ "oc CLI available version $(oc version 2> /dev/null | grep 'Client Version'  | awk '{print $3}')" || _failOCP4_ "Missing oc CLI "
  which openshift-install > /dev/null && _log_ "openshift-install CLI available version $(openshift-install version | grep openshift-install | awk '{print $2}')" || _failOCP4_ "Missing openshift-install CLI"
   
  # Check OpenStack certificate, flavor and external network definition 
  test -n "$OS_CACERT" && test -f "$OS_CACERT" || _failOCP4_ "Cannot find OS_CACERT $OS_CACERT from environment file $os_env"
  openstack network list > /dev/null && _log_ "Connection to openstack API successful" || _failOCP4_ "Cannot connect to openstack CLI"
  openstack network show $_extnet > /dev/null && _log_ "External network $_extnet found in OpenStack" || _failOCP4_ "External network $_extnet not found in OpenStack"
  for _f in $_flavorWorker $_flavor ; do openstack flavor show $_f > /dev/null && _log_ "Flavor $_f found in OpenStack" || _failOCP4_ "Flavor $_f not found in OpenStack" ; done
  
  # Check the flavor attributes  
  flavorCheckAttributes $_flavor
  flavorCheckAttributes $_flavorWorker  
  
  # Check volumes quota and adjust if needed
  if (( $(openstack quota show -f json | jq .volumes) < $_nbVolumes )) ; then openstack quota set --volumes $_nbVolumes $OS_PROJECT_NAME || _failOCP4_ "Cannot set volumes quota to $_nbVolumes in OpenStack" ; fi

  # Allocate two floating IPs: API and APP unless they are preallocated
  fipCheckCreate _fipapi "OpenShift cluster $_name API"
  fipCheckCreate _fipapp "OpenShift cluster $_name APP"
  
  # Add those IPs as name_API and name_APP variables, potentially useful for other resources references, eg UPF
  _templatedVariablesResolution+=" -e 's/~$\{_name}_API~/$_fipapi/g'"
  _templatedVariablesResolution+=" -e 's/~$\{_name}_APP~/$_fipapp/g'"

  # Populate /etc/hosts
  if $_etchosts ; then 
  _log_ "Updating /etc/hosts"
  cat << EOF | sudo tee -a /etc/hosts &>> $logfile || _failOCP4_ "Cannot update /etc/hosts"
#### BofS OpenShift cluster $_name.$_domain ####
$_fipapi api.$_name.$_domain
$_fipapp console-openshift-console.apps.$_name.$_domain
$_fipapp integrated-oauth-server-openshift-authentication.apps.$_name.$_domain
$_fipapp oauth-openshift.apps.$_name.$_domain
$_fipapp prometheus-k8s-openshift-monitoring.apps.$_name.$_domain
$_fipapp grafana-openshift-monitoring.apps.$_name.$_domain
$_fipapp kibana-openshift-logging.apps.$_name.$_domain
$_fipapp jaeger-production-css-observability.apps.$_name.$_domain
$_fipapp downloads-openshift-console.apps.$_name.$_domain
#### EofS OpenShift cluster $_name.$_domain ####
EOF
  fi

  mkdir -p $_name || _failOCP4_ "Cannot create installation directory $_name"
  # Build clouds.yaml
  cat > $_name/clouds.yaml << EOF || _failOCP4_ "Cannot build clouds.yaml"
clouds:
  openstack:
    auth:
      auth_url: $OS_AUTH_URL
      username: "$OS_USERNAME"
      password: "$OS_PASSWORD"
      project_id: $OS_PROJECT_ID
      project_name: "$OS_PROJECT_NAME"
      user_domain_name: "$OS_USER_DOMAIN_NAME"
    region_name: "$OS_REGION_NAME"
    interface: "$OS_INTERFACE"
    identity_api_version: $OS_IDENTITY_API_VERSION
    cacert: $OS_CACERT
    insecure: true
    verify: false
EOF
# Push a working copy of clouds.yaml in the current directory consumed by the OpenShift installer
cp -f $_name/clouds.yaml $PWD &>> $logfile || _failOCP4_ "Cannot push $_name/clouds.yaml to $PWD"

  # Build install-config.yaml
  cat > $_name/install-config.yaml << EOF || _failOCP4_ "Cannot build install-config.yaml"
apiVersion: v1
baseDomain: $_domain
compute:
- architecture: amd64
  hyperthreading: Enabled
  name: worker
  platform: 
    openstack:
      type: $_flavorWorker
  replicas: $_workers
controlPlane:
  architecture: amd64
  hyperthreading: Enabled
  name: master
  platform: {}
  replicas: $_masters
metadata:
  creationTimestamp: null
  name: $_name
networking:
  clusterNetwork:
  - cidr: 10.128.0.0/14
    hostPrefix: 23
  machineNetwork:
  - cidr: 10.0.0.0/16
  networkType: OVNKubernetes
  serviceNetwork:
  - 172.30.0.0/16
platform:
  openstack:
    apiVIP: 10.0.0.5
    cloud: openstack
    computeFlavor: $_flavor
    externalDNS:
    - $_extdns
    externalNetwork: $_extnet
    ingressVIP: 10.0.0.7
    lbFloatingIP: $_fipapi
publish: External
pullSecret: '$RHELSECRET'
EOF
# Add proxy section if defined in the environment
test -n "$OPENSHIFT_HTTP_PROXY$OPENSHIFT_HTTPS_PROXY$OPENSHIFT_NO_PROXY" && cat >> $_name/install-config.yaml << EOF
proxy:
EOF
test -n "$OPENSHIFT_HTTP_PROXY" && cat >> $_name/install-config.yaml << EOF
  httpProxy: $OPENSHIFT_HTTP_PROXY
EOF
test -n "$OPENSHIFT_HTTPS_PROXY" && cat >> $_name/install-config.yaml << EOF
  httpsProxy: $OPENSHIFT_HTTPS_PROXY
EOF
test -n "$OPENSHIFT_NO_PROXY" && cat >> $_name/install-config.yaml << EOF
  noProxy: $OPENSHIFT_NO_PROXY
EOF
# Retrieve from openstack and add public ssh key if defined in the environment
if test -n "$OS_SSH_KEY_PAIR" ; then
 openstack keypair show $OS_SSH_KEY_PAIR --public-key  &>> $logfile || _failOCP4_  "Cannot get ssh key $OS_SSH_KEY_PAIR from openstack"
 cat >> $_name/install-config.yaml << EOF || _failOCP4_ "Cannot add private ssh key $OS_SSH_KEY_PAIR in install-config.yaml"
sshKey:  $(openstack keypair show $OS_SSH_KEY_PAIR --public-key)
EOF
fi
# Save a copy of the install-config.yaml consumed by the OpenShift installer
cp -f $_name/install-config.yaml $_name/install-config.saved.yaml &>> $logfile || _failOCP4_ "Cannot save $_name/install-config.yaml to $_name/install-config.saved.yaml"

  # Disable port security in background
  startBackgroundSecurityDisabling $_name

  # Deploy the cluster and stop the background task disabling OpenStack ports security
  _log_ "Deploying the OpenShift cluster $_name"
  if [ "$logfile" != "/dev/stdout" ] ; then _log_ "This takes a while, follow-up available in $logfile" ; fi
  $_preview openshift-install create cluster --dir $_name --log-level debug &>> $logfile || _failOCP4_ "Cannot create OpenShift cluster $_name"
  stopBackgroundSecurityDisabling

  _log_ "Checking deployment completion" 
  $_preview openshift-install wait-for install-complete --dir $_name --log-level debug &>> $logfile || _failOCP4_ "OpenShift cluster creation did not complete"
  
  # Preview mode: stop here, nothing instantiated
  test -n "$_preview" && _log_ "Preview mode: skipping application floating IP association" && return 0

  # Identify the first subnet of the openstack network which name startswith the parameter followed by a dash
  subnet=$(openstack network list -f json | jq -r -c '.[] | select( .Name | startswith("'$_name-'")) | .Subnets')
  [[ "$subnet" =~ "[" ]] && subnet=$(echo $subnet | jq -r .[0])
  [[ $subnet =~ "-" ]] || _failOCP4_ "No subnet found for $_name: cannot find ingress port"
  # Get the ingress ports IDs on this subnet
  port=$(openstack port list --fixed-ip subnet=$subnet -f json | jq -r -c '.[] | select( .Name | contains("ingress")) | .ID')
  # Associate cluster ingress port $port to apps FIP_APPS_LB $_fipapp
  test -n "$port" || _failOCP4_ "Ingress port not found for $_name"
  openstack floating ip set --port $port $_fipapp && _log_ Connecting APP Floating IP $_fipapp to port $port || _failOCP4_ "Cannot associate port $port to apps FIP_APPS_LB $_fipapp"
  
  _log_ "Checking OCP login as kubeadmin on $_name with KUBECONFIG=$_name/auth/kubeconfig and kubeadmin-password $(cat $_name/auth/kubeadmin-password)"
  export KUBECONFIG=$_name/auth/kubeconfig
  oc login -u kubeadmin -p $(cat $_name/auth/kubeadmin-password) &>> $logfile || _failOCP4_ "Cannot login to OCP cluster $_name as kubeadmin"
`+
// Cluster is ready for openshift resources deployment
buildNetworkFunctions()
+`
}

# Undeployment
undeployOCP() {
  local _name=$1
  local _domain=$2
  local _fipapi=$3
  local _fipapp=$4
  local _etchosts=$\{5:-false}

  openstack network list > /dev/null && _log_ "Connection to openstack API successful" || _failOCP4_ "Cannot connect to openstack CLI"
  
  # Restore the original clouds.yaml from this instance directory
  cp -f $_name/clouds.yaml $PWD &>> $logfile || _failOCP4_ "Cannot retrieve $_name/clouds.yaml to $PWD" 

  # Stop the background task disabling OpenStack ports security
  stopBackgroundSecurityDisabling

  # Delete cluster
  _log_ "Destroying OpenShift cluster $_name"
  $_preview openshift-install destroy cluster --dir $_name --log-level debug &>> $logfile || _failOCP4_ "Cannot destroy cluster $_name"

  # Delete floating IPs by selecting the description set at creation time in this OpenStack project excluding static IPs if any
  _log_ "Searching floating IPs to release for cluster $_name"
  allfips=$(openstack floating ip list -f json | jq -r '.[] | select( .Project=="'$OS_PROJECT_ID'") | select( ."Floating IP Address"=="'$_fipapi'" | not)  | select( ."Floating IP Address"=="'$_fipapp'" | not) | .ID')
  fips=$(for f in $allfips ; do openstack floating ip show $f -f json | jq -r '. | select( .description | startswith("OpenShift cluster '$_name'")) | .id' ; done)
  for f in $fips ; do _log_ Deleting floating IP $f && openstack floating ip delete $f &>> $logfile ; done

  # Cleanup /etc/hosts
  if $_etchosts ; then 
    _log_ "Cleaning up /etc/hosts of cluster $_name"
    sudo sed -i '/#### BofS OpenShift cluster '$_name.$_domain' ####/,/#### EofS OpenShift cluster '$_name.$_domain' ####/d' /etc/hosts &>> $logfile || _failOCP4_ "Cannot cleanup /etc/hosts"
  fi
}

# Main entry point
OCPrequirements

# Templated variables resolution: prepare a list of variables resolutions as a string of sed options aimed at replacing templated variables with their actual values 
# typically resulting from OCP4 clusters instantiation
# Example: -e 's/~$myocp_APP~/10.33.0.12/g'
_templatedVariablesResolution=""

# For all instance names, deploy or undeploy
i=0 && while (( i <  $\{#OCP[@]} )) ; do 
  os_env=$\{OS_env[i]:-$OS_env}
  if test -n "$os_env" ; then
    source $os_env || _failOCP4_ "Environment file $os_env not found"
  fi
  
  $_deploy && deployOCP $\{OCP[i]:-$OCP} $\{DOMAIN[i]:-$DOMAIN} $\{FLAVOR[i]:-$FLAVOR} $\{MASTERS[i]:-$MASTERS} $\{WORKERS[i]:-$WORKERS} $\{EXTNET[i]:-$EXTNET} $\{EXTDNS[i]:-$EXTDNS} $\{FIPAPI[i]:-$FIPAPI} $\{FIPAPP[i]:-$FIPAPP} $\{NBVOLUMES[i]:-$NBVOLUMES} $\{FLAVORWORKER[i]:-$FLAVORWORKER} $\{ETCHOSTS[i]:-$ETCHOSTS} || undeployOCP $\{OCP[i]:-$OCP} $\{DOMAIN[i]:-$DOMAIN} $\{FIPAPI[i]:-$FIPAPI} $\{FIPAPP[i]:-$FIPAPP} $\{ETCHOSTS[i]:-$ETCHOSTS}  
  ((i+=1))
done
`;
}
