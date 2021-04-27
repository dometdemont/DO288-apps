#! /bin/bash
_usage() {
    echo "
HPE 5G resources automated deployer: 2021-03-04 Version 0.91
This client deploys and undeploys 
- OpenShift clusters hosted on OpenStack 
- Individual OpenStack resources as a stack
- HPE 5g resources 
 
Usage: $0 
    -d|--deploy <name> : name of the OpenShift instance and OpenStack stack to deploy; default: hpe5g
    -o|--domain <domain name> : domain name of the OpenShift instance to deploy; default: localdomain
    -n|--OSnetwork <network root>: default OpenStack network root as 3 unique digits like 192.168.199
    -e|--OSenv <OpenStackEnvironmentFile> : name of the file providing the OpenStack environment. Retrieved from the OpenStack GUI: Project/API access
      By default, this file prompts the user for his password; to make the deployment unattended, replace the prompt with the actual password in the variable OS_PASSWORD
      Mandatory additional variables:
      - OS_CACERT: path to a file providing a specific cacert in case the SSL cert is signed by an unknown CA
      - OS_SSH_KEY_PAIR: name of the ssh key pair defined in the OpenStack project, pushed to the OpenShift nodes for remote access
      - CLOUD_SSH_KEY: (ansible deployments only) ssh private key used to reach the deployed nodes, matching the public OS_SSH_KEY_PAIR
      - CLOUD_DEFAULT_USER: (ansible deployments only) user name used to log in the deployed nodes

      Extensions supported as additional variables: 
      - Proxy URLs for OpenShift cluster
      OPENSHIFT_HTTP_PROXY
      OPENSHIFT_HTTPS_PROXY
      OPENSHIFT_NO_PROXY
    -x|--ext-net <external network> : name of the external network in the OpenStack infrastructure to connect this instance to; default: ext-net
    -s|--dns <external DNS> : external domain name server; default 8.8.8.8
    -f|--flavor <OpenStack flavor> : name of the OpenStack flavor used for master instances. Minimum 4vCPUs, 25Gb disk, 16Gb RAM; default: v4.m16.d25
    -fw|--flavorWorker <OpenStack flavor> : name of the OpenStack flavor used for worker instances. Minimum 4vCPUs, 25Gb disk, 16Gb RAM; default: master flavor
    --fipapi preallocated OpenShift API floating IPs
    --fipapp preallocated OpenShift APP floating IPs
    -m|--masters <number of masters> : default 3
    -w|--workers <number of workers> : default 3
    -v|--volumes <mininimum quota of OpenStack volumes>
    -t|--etc-hosts [true|false] : boolean enabling /etc/hosts update (requires sudo privilege) ; default: true
    -p|--pull-secret <file> : name of the file delivering the RedHat pull secret
    -l|--log logfile 
    -u|--undeploy|--destroy <name>: name of the OpenShift instance to undeploy; default: hpe5g
    --preview: no openshift installer invocation, display only 
    --headless: no log on stdout, only logfile is populated
    
Example: 
$0 -d hpe5g -o localdomain -s 8.8.8.8 -x ext-net -f v4.m16.d25 -m 3 -w 3 -t true -c openstack

To deploy several OpenShift clusters, all parameters are lists of space separated values. 
For example, to deploy two clusters ocp1 and ocp2 with specific flavors and a common external network:
$0 -n \"ocp1 ocp2\" -f \"flavor1 flavor2\" -x ext-net
"
}

# Default parameters
default_stack=hpe5g
oc_stack=$default_stack
oc_network=192.168.199
OS_env=RHOS12.env
_deploy=$([[ "deploy" != "undeploy" ]] && echo true || echo false)
_displayedAction=$($_deploy && echo Deploying || echo Undeploying)
state=$($_deploy && echo present || echo absent)
_headless=
_preview=

_defaultName=(marakech meknes)
OCP=(marakech meknes)
ETCHOSTS=(true true)
EXTNET=(External-VLAN502 External-VLAN502)
OS_env=(FC33.sh factory-openrc.sh)
DOMAIN=(fc133 factory)
FIPAPI=(? ?)
FIPAPP=(? ?)
WORKERS=(1 1)
MASTERS=(3 3)
FLAVOR=(master3 master3)
FLAVORWORKER=(v1.m2 master3)
EXTDNS=(8.8.8.8 8.8.8.8)
NBVOLUMES=(8 15)
RHELSECRET='{"auths":{"cloud.openshift.com":{"auth":"b3BlbnNoaWZ0LXJlbGVhc2UtZGV2K2RvbWV0ZGVtb250MXhjMXp2N3VhbjNhbTloamNrb2h1Y2tscTBjOlM2QVc3WUlCSDFMRFhSRkhBNU1WM1dOWUFNQjRSTDk4MU1JRE1PQzFYQUVBMDRLWlRKNVk3SzQwUFFVODlOOUo=","email":"dominique.domet-de-mont@hpe.com"},"quay.io":{"auth":"b3BlbnNoaWZ0LXJlbGVhc2UtZGV2K2RvbWV0ZGVtb250MXhjMXp2N3VhbjNhbTloamNrb2h1Y2tscTBjOlM2QVc3WUlCSDFMRFhSRkhBNU1WM1dOWUFNQjRSTDk4MU1JRE1PQzFYQUVBMDRLWlRKNVk3SzQwUFFVODlOOUo=","email":"dominique.domet-de-mont@hpe.com"},"registry.connect.redhat.com":{"auth":"NDM4MTY3MHx1aGMtMVhjMVp2N1VhTjNBbTloSmNrb2h1Y0tMcTBjOmV5SmhiR2NpT2lKU1V6VXhNaUo5LmV5SnpkV0lpT2lJMk4yUmpOMlZtWTJNMU5qSTBPVEZsT1RneVpXTTBOVGM1TUdGa1pUQTNaQ0o5Lkp2dWsybEo2Q3dLLTY5WnBkbDg1enk0RFUtdzV3aTVPWE5aZ0hDUDBlbXNCVmZDXzkzN3Fhdk5OZDZqdjRBU0NSRllPb3ZCTmxYTEhJbjA5amhIaTJiZDRfQ2xwMVhBaTdPYWVwN21qc0x5NVdrSEZHU3lHcU02RU43Y1N3bmFRWm00Q3lDNmNHaFItbVhtYnVDUTdYdWl0MVJCNEh5X0laZHV6dUhOa3hmam5aX2ZmWHNRb1ZVTmoxdW44bFlZMjQzLXpOMkpvN0p2M3MwZkZYYnBnbzBtMUNia284MzIzRWhGc3h5SFM5UXNYWUk3VDRJX21JRnBHMTZSVGotUGUyalluNjVJTnBxVFF4Y0FQaHpuQkxLYUNwd01Yb2F2V0hPMXpRWEs1QTF2dGR3Z1VUZEh0VWplX3FYUm13ZUQwYkVOeDRiVHgySGx2X0RlcnZuMEVfc3ZuRU4zVlpkNEc0VFNHZlo2d1c1LVlvSjJxZkdxeGVqeVZWdThqeDFyazFWRk52NERXaDd4amlTZ2I5d3dNTWVWVW9pSXFMZUN2NTZzUW4ycTRUdUpmdDNIVGR2UXhBSldHQWtGbDBFVUJKT0R2aGZrWGtSTWtjbmk5RVdiZVU0NWYwUThhQ1NmeG84anBzNE80endUMUxSQlVTVE5ZekN3bjhrTFdYR2FkaGo1aHdDNW9XNjlzUW5wYmpEY2JWR0dCSkdhNUtRREJpNmRVNzFoUTY3cThncUZ1UHhOaXJCcFNleTg0VWxtMS1PVjBzVXN4dnRwaVYxWFFvUVJrcHRVNnNBMFJaMTE2c25JT0gxR2piWm9paTB6M2hJbUltcmRPeG1ReHhYcC1nTWhsc2txcDZRVGtSWFdPZ0lyYWJ0UkNvV2pRc3JZb1EyZFNiRzBBODNB","email":"dominique.domet-de-mont@hpe.com"},"registry.redhat.io":{"auth":"NDM4MTY3MHx1aGMtMVhjMVp2N1VhTjNBbTloSmNrb2h1Y0tMcTBjOmV5SmhiR2NpT2lKU1V6VXhNaUo5LmV5SnpkV0lpT2lJMk4yUmpOMlZtWTJNMU5qSTBPVEZsT1RneVpXTTBOVGM1TUdGa1pUQTNaQ0o5Lkp2dWsybEo2Q3dLLTY5WnBkbDg1enk0RFUtdzV3aTVPWE5aZ0hDUDBlbXNCVmZDXzkzN3Fhdk5OZDZqdjRBU0NSRllPb3ZCTmxYTEhJbjA5amhIaTJiZDRfQ2xwMVhBaTdPYWVwN21qc0x5NVdrSEZHU3lHcU02RU43Y1N3bmFRWm00Q3lDNmNHaFItbVhtYnVDUTdYdWl0MVJCNEh5X0laZHV6dUhOa3hmam5aX2ZmWHNRb1ZVTmoxdW44bFlZMjQzLXpOMkpvN0p2M3MwZkZYYnBnbzBtMUNia284MzIzRWhGc3h5SFM5UXNYWUk3VDRJX21JRnBHMTZSVGotUGUyalluNjVJTnBxVFF4Y0FQaHpuQkxLYUNwd01Yb2F2V0hPMXpRWEs1QTF2dGR3Z1VUZEh0VWplX3FYUm13ZUQwYkVOeDRiVHgySGx2X0RlcnZuMEVfc3ZuRU4zVlpkNEc0VFNHZlo2d1c1LVlvSjJxZkdxeGVqeVZWdThqeDFyazFWRk52NERXaDd4amlTZ2I5d3dNTWVWVW9pSXFMZUN2NTZzUW4ycTRUdUpmdDNIVGR2UXhBSldHQWtGbDBFVUJKT0R2aGZrWGtSTWtjbmk5RVdiZVU0NWYwUThhQ1NmeG84anBzNE80endUMUxSQlVTVE5ZekN3bjhrTFdYR2FkaGo1aHdDNW9XNjlzUW5wYmpEY2JWR0dCSkdhNUtRREJpNmRVNzFoUTY3cThncUZ1UHhOaXJCcFNleTg0VWxtMS1PVjBzVXN4dnRwaVYxWFFvUVJrcHRVNnNBMFJaMTE2c25JT0gxR2piWm9paTB6M2hJbUltcmRPeG1ReHhYcC1nTWhsc2txcDZRVGtSWFdPZ0lyYWJ0UkNvV2pRc3JZb1EyZFNiRzBBODNB","email":"dominique.domet-de-mont@hpe.com"}}}'

while [[ "$#" -gt 0 ]]; do case $1 in
  -d|--deploy) _deploy=true; _displayedAction="Deploying"; state=present ; OCP=(${2:-${OCP[@]:-$_defaultName}}) ; shift;;
  -u|--undeploy|--destroy) _deploy=false ; _displayedAction="Undeploying"; state=absent ; OCP=(${2:-${OCP[@]:-$_defaultName}}); shift;;
  -e|--OSenv) OS_env=($2); shift;;
  -n|--OSnetwork) oc_network="$2"; shift;;
  -o|--domain) DOMAIN=($2); shift;;
  -x|--ext-net) EXTNET=($2); shift;;
  -f|--flavor) FLAVOR=($2); shift;;
  -fw|--flavorWorker) FLAVORWORKER=($2); shift;;
  --fipapi) FIPAPI=($2); shift;;
  --fipapp) FIPAPP=($2); shift;;
  -m|--masters) MASTERS=($2); shift;;
  -w|--workers) WORKERS=($2); shift;;
  -v|--volumes) NBVOLUMES=($2); shift;;
  -t|--etc-hosts) ETCHOSTS=($2); shift;;
  -l|--log) logfile=($2); shift;;
  -s|--dns) EXTDNS=($2); shift;;
  -p|--pull-secret) test -f $2 && RHELSECRET=$(cat $2) || exit 1; shift;;
  -h|--help) _usage; exit 0 ;;
  --headless) _headless=true;;
  --preview) _preview="_log_ Preview: ";;
  *) echo "Unknown parameter passed: $1." ; exit 1;;
esac; shift; done

# Force a log file in headless mode named as the stack, otherwise keep stdout
if ! test -n "$logfile" ; then test -n "$_headless" && logfile=$oc_stack.log || logfile="/dev/stdout" ; fi

# Cosmetic: ellipsize too long strings to keep cute logs: keep _max characters
_cutTooLong() {
  local _cut="$*"
  local _max=150
  if (( ${#_cut} > $_max )) ; then
    _cut=$(echo $* | cut -c1-$_max)
    _cut+="..."
  fi
  echo $_cut
}

_log_() {
    # echo a cute time stamped log on stdout except in headless mode, and append the full log to the logfile
    test -n "$_headless" || echo -e $(date) $(_cutTooLong $*)
    if [ "$logfile" != "/dev/stdout" ] ; then echo -e $(date) $* &>> $logfile ; fi
    return 0
}

_warn_() {
  local RED='\033[0;31m'
  local NC='\033[0m' # No Color
  _log_ "${RED}WARNING${NC}: $*"
}

_fail_() {
  _log_ "FATAL ERROR: $*.  Now exiting... Check $logfile"
  test -f $logfile && echo Last lines of $logfile >&2 && tail $logfile >&2
  exit 1
}

# Clean log file
> $logfile

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
    subnet=$(openstack network list -f json | jq -r -c '.[] | select( .Name | startswith("'${_name}-'")) | .Subnets')
    [[ "$subnet" =~ "[" ]] && subnet=$(echo $subnet | jq -r .[0])
    [[ $subnet =~ "-" ]] || continue
    subnetname=$(openstack subnet show $subnet -f json | jq -r .name)
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
  local _i=${#_flavor_properties[@]}
  local _v=""
  while (($_i)) ; do ((_i--)) && _v=hw${_flavor_properties[$_i]} && [[ "${!_v}" == "${_flavor_values[$_i]}" ]] || _failOCP4_  "Flavor $_f missing property hw:${_flavor_properties[$_i]}=${_flavor_values[$_i]}" ; done
}

fipCheckCreate() {
  # First argument is the *name* of the variable holding the FIP value candidate
  # Second argument: comment associated to the FIP to be created if needed
  # Invoke: fipCheckCreate FIPAPI "OpenShift FIPAPI etc"
  local _fipName=$1
  local _fipValue=${!_fipName}
  local _fipComment=${2:-OpenShift cluster floating IP $_fipName}
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
  local _flavorWorker=${11:-$_flavor}
  
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
  _templatedVariablesResolution+=" -e 's/~${_name}_API~/$_fipapi/g'"
  _templatedVariablesResolution+=" -e 's/~${_name}_APP~/$_fipapp/g'"

  # Populate /etc/hosts
  if ${ETCHOSTS:-false} ; then 
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
  networkType: OpenShiftSDN
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

# Prerequisites:
# - OpenShift command line interface installed (oc)
if ! which oc  > /dev/null ; then  echo Please install oc utility to submit OpenShift requests ; exit 1 ; fi
# - current user logged in the target OpenShift cluster: oc login -u <user> -p <password>

_getTemplateInstanceStatus() {
	local TOKEN=$1 ENDPOINT=$2 NAMESPACE=$3 TEMPLATEINSTANCE=$4
	curl -s -k -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" https://$ENDPOINT/apis/template.openshift.io/v1/namespaces/$NAMESPACE/templateinstances/$TEMPLATEINSTANCE | jq -e '.status.conditions[] | select(.status == "True") | .type'
	return $?
}
_getTemplateInstanceMessage() {
	local TOKEN=$1 ENDPOINT=$2 NAMESPACE=$3 TEMPLATEINSTANCE=$4
	local status=$(curl -s -k -H "Authorization: Bearer $TOKEN" -H "Accept: application/json" https://$ENDPOINT/apis/template.openshift.io/v1/namespaces/$NAMESPACE/templateinstances/$TEMPLATEINSTANCE )
	echo $status >> $logfile
	echo $status | jq -e '.status.conditions[] | select(.status == "True") | .message'
}

# Submit a command until success or timeout, log a current status after each retry
# Parameters:
# $1: the command
# $2: (optional) the command description, displayed at each retried iteration, appended to the command output, defaults to the command
# $3: (optional) the timeout in seconds
# $4: (optional) the retry period in seconds
_cmd_with_retry() {
	local _cmd="$1"
	local _cmdDescription="${2:-$_cmd}"
	local _timeout=${3:-60}
	local _retryPeriod=${4:-10}
	
	[ "$_cmd" = "" ] && echo "_cmd_with_retry <command> <description> <timeout[$_timeout]> <retry period[$_retryPeriod]>" && return 1
	 
	local _countMax=$(( $_timeout/$_retryPeriod + 1 ))
	local _count=0
    until _cmdOutput=$(eval "$_cmd" 2>> $logfile) || (( $_count >= $_countMax )) ; do
    	((_count++))
    	_log_ "$_cmdDescription: attempt $_count of $_countMax, retrying in $_retryPeriod seconds"
        sleep $_retryPeriod
    done
   if (( $_count >= $_countMax )) ; then
   	return 1
   else
   	test -n "$_cmdOutput" && echo $_cmdOutput >> $logfile
   fi
   return 0
}

cat > openshift_project_hpe5g.yaml << 'EOFILE'
apiVersion: v1
kind: Template
metadata:
  name: hpe5g
  annotations:
    description: network functions and backing services for project hpe5g
objects:
  - kind: ServiceAccount
    apiVersion: v1
    metadata:
      name: gridgain
      namespace: hpe5g
  - kind: RoleBinding
    apiVersion: authorization.openshift.io/v1
    metadata:
      name: gridgain-view
      namespace: hpe5g
    roleRef:
      kind: Role
      name: view
    subjects:
    - kind: ServiceAccount
      name: gridgain
      namespace: hpe5g
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: gridgain
      namespace: hpe5g
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations:
        from:
          kind: DockerImage
          name: docker.io/gridgain/community:8.7.14
        generation: 1
        importPolicy: {}
        name: ""
        referencePolicy:
          type: Source
  
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      name: gridgain-work
    spec:
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 250Mi
      
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      name: gridgain-wal
    spec:
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 250Mi
      
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      name: gridgain-walarchive
    spec:
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 250Mi
      
  
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      name: gridgain
      namespace: hpe5g
    spec:
      template: 
        metadata:
          labels: 
            name: gridgain
          name: gridgain
        spec:
          serviceAccountName: gridgain
          containers:
          - name: gridgain
            namespace: hpe5g
            image: docker.io/gridgain/community:8.7.14
            env:
            - name: OPTION_LIBS
              value: ignite-kubernetes,ignite-rest-http
            - name: CONFIG_URI
              value: file:/etc/opt/hpe-5g/ignite/igniteConfig.xml
  
            - name: JVM_OPTS
              value: "-DIGNITE_WAL_MMAP=false"
  
            ports:
            # Ports to open.
            # Might be optional depending on your Kubernetes environment.
            - containerPort: 11211 # REST port number.
            - containerPort: 47100 # communication SPI port number.
            - containerPort: 47500 # discovery SPI port number.
            - containerPort: 49112 # JMX port number.
            - containerPort: 10800 # SQL port number.
            - containerPort: 10900 # Thin clients port number.
            volumeMounts:
              - name: gridgain
                namespace: hpe5g
                mountPath: /etc/opt/hpe-5g/ignite/
  
              - mountPath: /gridgain/work
                name: gridgain-work
              - mountPath: /gridgain/wal
                name: gridgain-wal
              - mountPath: /gridgain/walarchive
                name: gridgain-walarchive
  
          volumes:
            - name: gridgain
              namespace: hpe5g
              configMap:
                name: gridgain
  
            - name: gridgain-work
              persistentVolumeClaim:
                claimName: gridgain-work
            - name: gridgain-wal
              persistentVolumeClaim:
                claimName: gridgain-wal
            - name: gridgain-walarchive
              persistentVolumeClaim:
                claimName: gridgain-walarchive
  
      replicas: 1
  - kind: Service
    apiVersion: v1
    metadata: 
      name: gridgain
      namespace: hpe5g
    spec:
      type: LoadBalancer
      ports:
        - name: rest
          port: 8080
          targetPort: 8080
        - name: sql
          port: 10800
          targetPort: 10800
        - name: thinclients
          port: 10900
          targetPort: 10900
      # Optional - remove 'sessionAffinity' property if the Ignite cluster
      # and applications deployed within Kubernetes
      sessionAffinity: ClientIP   
      selector:
        name: gridgain
        deploymentconfig: gridgain
  - kind: Route
    apiVersion: v1
    metadata:
      name: gridgain
      namespace: hpe5g
    spec:
      to:
        kind: Service
        name: gridgain
  - kind: ConfigMap
    apiVersion: v1
    metadata:
      name: gridgain
      namespace: hpe5g
    data:
      igniteConfig.xml: |+
        <beans xmlns="http://www.springframework.org/schema/beans" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation=" http://www.springframework.org/schema/beans  http://www.springframework.org/schema/beans/spring-beans-3.1.xsd">
         <bean id="ignite.cfg" class="org.apache.ignite.configuration.IgniteConfiguration">
  
         <property name="workDirectory" value="/gridgain/work"/>
             <property name="dataStorageConfiguration">
                 <bean class="org.apache.ignite.configuration.DataStorageConfiguration">
                     <property name="defaultDataRegionConfiguration">
                         <bean class="org.apache.ignite.configuration.DataRegionConfiguration">
                             <property name="persistenceEnabled" value="true"/>
                         </bean>
                     </property>
                     <property name="walPath" value="/gridgain/wal"/>
                     <property name="walArchivePath" value="/gridgain/walarchive"/>
                 </bean>
             </property>
  
           <property name="discoverySpi">
              <bean class="org.apache.ignite.spi.discovery.tcp.TcpDiscoverySpi">
                <property name="ipFinder">
                   <bean class="org.apache.ignite.spi.discovery.tcp.ipfinder.kubernetes.TcpDiscoveryKubernetesIpFinder">
                   <property name="namespace" value="hpe5g"/>
                   <property name="serviceName" value="gridgain"/>
                   <property name="masterUrl" value="https://#{systemEnvironment['KUBERNETES_SERVICE_HOST']}:443"/>
                   </bean>
                </property>
              </bean>
           </property>
          </bean>
         </beans>
  
  - kind: Secret
    apiVersion: v1
    metadata:
      name: udsf-flux
      namespace: hpe5g
    name: udsf-flux
    stringData:
      admin-user-password: udsf-flux
    type: Opaque
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      name: udsf-flux
    spec:
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 1Gi
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: udsf-flux
      namespace: hpe5g
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations:
        from:
          kind: DockerImage
          name: docker.io/bitnami/influxdb:1.7.10
        generation: 1
        importPolicy: {}
        name: ""
        referencePolicy:
          type: Source
  - kind: Service
    apiVersion: v1
    metadata: 
      name: udsf-flux
      namespace: hpe5g
    spec:
      type: ClusterIP
      ports:
        - port: 8086
          targetPort: http
          protocol: TCP
          name: http
          nodePort: null
        - port: 8088
          targetPort: rpc
          protocol: TCP
          name: rpc
          nodePort: null
      selector:
          name: udsf-flux
          deploymentconfig: udsf-flux
  - kind: Route
    apiVersion: v1
    metadata:
      name: udsf-flux
      namespace: hpe5g
    spec:
      to:
        kind: Service
        name: udsf-flux
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      annotations:
        template.alpha.openshift.io/wait-for-ready: 'true'
      name: udsf-flux
    spec:
      replicas: 1
      selector:
          name: udsf-flux
      template:
        metadata:
          labels:
            name: udsf-flux
        spec:
          containers:
            - name: udsf-flux
              image: docker.io/bitnami/influxdb:1.7.10
              imagePullPolicy: IfNotPresent
              env:
                - name: BITNAMI_DEBUG
                  value: "false"
                - name: POD_IP
                  valueFrom:
                    fieldRef:
                      fieldPath: status.podIP
                - name: INFLUXDB_HTTP_AUTH_ENABLED
                  value: "false"
                - name: INFLUXDB_ADMIN_USER
                  value: "admin"
                - name: INFLUXDB_ADMIN_USER_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: udsf-flux
                      key: admin-user-password
                - name: INFLUXDB_DB
                  value: udsf-flux
              ports:
                - name: http
                  containerPort: 8086
                  protocol: TCP
                - name: rpc
                  containerPort: 8088
                  protocol: TCP
              livenessProbe:
                exec:
                  command:
                    - "/bin/bash"
                    - "-i"
                    - "-c"
                    - "INFLUX_USERNAME=\"$INFLUXDB_ADMIN_USER\" INFLUX_PASSWORD=\"$INFLUXDB_ADMIN_USER_PASSWORD\" timeout 29s influx -host $POD_IP -port 8086 -execute \"SHOW DATABASES\" "
                initialDelaySeconds: 180
                periodSeconds: 45
                timeoutSeconds: 30
                successThreshold: 1
                failureThreshold: 6
              readinessProbe:
                exec:
                  command:
                    - "/bin/bash"
                    - "-i"
                    - "-c"
                    - "INFLUX_USERNAME=\"$INFLUXDB_ADMIN_USER\" INFLUX_PASSWORD=\"$INFLUXDB_ADMIN_USER_PASSWORD\" timeout 29s influx -host $POD_IP -port 8086 -execute \"SHOW DATABASES\" "
                initialDelaySeconds: 60
                periodSeconds: 45
                timeoutSeconds: 30
                successThreshold: 1
                failureThreshold: 6
              resources:
                limits: {}
                requests: {}
              volumeMounts:
                - name: data
                  mountPath: /bitnami/influxdb
          volumes:
            - name: data
              persistentVolumeClaim:
                claimName: udsf-flux
  
  - kind: Secret
    apiVersion: v1
    metadata:
      name: myredis
      namespace: hpe5g
    name: myredis
    stringData:
      database-password: myredis
  - kind: Service
    apiVersion: v1
    metadata: 
      name: myredis
      namespace: hpe5g
    spec:
      ports:
      - name: redis
        nodePort: 0
        port: 6379
        protocol: TCP
        targetPort: 6379
      selector:
        name: myredis
        deploymentconfig: myredis
      sessionAffinity: None
      type: ClusterIP
    status:
      loadBalancer: {}
  - kind: Route
    apiVersion: v1
    metadata:
      name: myredis
      namespace: hpe5g
    spec:
      to:
        kind: Service
        name: myredis
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      name: myredis
    spec:
      accessModes:
      - ReadWriteOnce
      resources:
        requests:
          storage: 100Mi
      
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: myredis
      namespace: hpe5g
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations:
        from:
          kind: DockerImage
          name: docker.io/bitnami/redis:latest
        generation: 1
        importPolicy: {}
        name: ""
        referencePolicy:
          type: Source
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      annotations:
        template.alpha.openshift.io/wait-for-ready: 'true'
      name: myredis
    spec:
      replicas: 1
      selector:
        name: myredis
      strategy:
        type: Recreate
      template:
        metadata:
          labels:
            name: myredis
        spec:
          containers:
          - capabilities: {}
            env:
            - name: REDIS_PORT
              value: "6379"
  
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  key: database-password
                  name: myredis
            image: docker.io/bitnami/redis:latest
            livenessProbe:
              initialDelaySeconds: 30
              tcpSocket:
                port: 6379
              timeoutSeconds: 1
            name: redis
            ports:
            - containerPort: 6379
              protocol: TCP
            readinessProbe:
              exec:
                command:
                - "/bin/bash"
                - "-i"
                - "-c"
                - "test \"$(redis-cli -h 127.0.0.1 -a myredis ping)\" == \"PONG\""
              initialDelaySeconds: 5
              timeoutSeconds: 1
            resources:
              limits:
                memory: 100Mi
            securityContext:
              capabilities: {}
              privileged: false
            terminationMessagePath: "/dev/termination-log"
            volumeMounts:
            - mountPath: "/var/lib/redis/data"
              name: "myredis-data"
          dnsPolicy: ClusterFirst
          restartPolicy: Always
          volumes:
          - name: "myredis-data"
            persistentVolumeClaim:
              claimName: myredis
    status: {}
  
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: myjenkins
      namespace: hpe5g
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations:
        from:
          kind: DockerImage
          name: quay.io/openshift/origin-jenkins:latest
        generation: 1
        importPolicy: {}
        name: ""
        referencePolicy:
          type: Source
  - kind: Route
    apiVersion: v1
    metadata:
      annotations:
        haproxy.router.openshift.io/timeout: 4m
        template.openshift.io/expose-uri: http://{.spec.host}{.spec.path}
      name: myjenkins
    spec:
      tls:
        insecureEdgeTerminationPolicy: Redirect
        termination: edge
      to:
        kind: Service
        name: myjenkins
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      annotations:
        template.alpha.openshift.io/wait-for-ready: "true"
      name: myjenkins
    spec:
      replicas: 1
      selector:
        name: myjenkins
      strategy:
        type: Recreate
      template:
        metadata:
          labels:
            name: myjenkins
        spec:
          containers:
          - capabilities: {}
            env:
            - name: OPENSHIFT_ENABLE_OAUTH
              value: "true"
            - name: OPENSHIFT_ENABLE_REDIRECT_PROMPT
              value: "true"
            - name: KUBERNETES_MASTER
              value: https://kubernetes.default:443
            - name: KUBERNETES_TRUST_CERTIFICATES
              value: "true"
            - name: JENKINS_SERVICE_NAME
              value: myjenkins
            - name: JNLP_SERVICE_NAME
              value: myjenkins-jnlp
            image: quay.io/openshift/origin-jenkins:latest
            imagePullPolicy: IfNotPresent
            livenessProbe:
              failureThreshold: 2
              httpGet:
                path: /login
                port: 8080
              initialDelaySeconds: 420
              periodSeconds: 360
              timeoutSeconds: 240
            name: jenkins
            readinessProbe:
              httpGet:
                path: /login
                port: 8080
              initialDelaySeconds: 3
              timeoutSeconds: 240
            resources:
              limits:
                memory: 2048Mi
            securityContext:
              capabilities: {}
              privileged: false
            terminationMessagePath: /dev/termination-log
            volumeMounts:
            - mountPath: /var/lib/jenkins
              name: myjenkins-data
          dnsPolicy: ClusterFirst
          restartPolicy: Always
          serviceAccountName: myjenkins
          volumes:
          - emptyDir:
              medium: ""
            name: myjenkins-data
  - kind: ServiceAccount
    apiVersion: v1
    metadata:
      annotations:
        serviceaccounts.openshift.io/oauth-redirectreference.jenkins: '{"kind":"OAuthRedirectReference","apiVersion":"v1","reference":{"kind":"Route","name":"myjenkins"}}'
      name: myjenkins
  - apiVersion: v1
    groupNames: null
    kind: RoleBinding
    metadata:
      name: myjenkins_edit
    roleRef:
      name: edit
    subjects:
    - kind: ServiceAccount
      name: myjenkins
  - kind: Service
    apiVersion: v1
    metadata:
      name: myjenkins-jnlp
    spec:
      ports:
      - name: agent
        nodePort: 0
        port: 50000
        protocol: TCP
        targetPort: 50000
      selector:
        name: myjenkins
      sessionAffinity: None
      type: ClusterIP
  - kind: Service
    apiVersion: v1
    metadata:
      annotations:
        service.alpha.openshift.io/dependencies: '[{"name": "myjenkins-jnlp", "namespace": "", "kind": "Service"}]'
        service.openshift.io/infrastructure: "true"
      name: myjenkins
    spec:
      ports:
      - name: web
        nodePort: 0
        port: 80
        protocol: TCP
        targetPort: 8080
      selector:
        name: myjenkins
      sessionAffinity: None
      type: ClusterIP
  
  - kind: ServiceAccount
    apiVersion: v1
    metadata:
      name: myalert
      namespace: hpe5g
  - kind: RoleBinding
    apiVersion: authorization.openshift.io/v1
    metadata:
      name: myalert-view
      namespace: hpe5g
    roleRef:
      kind: Role
      name: view
    subjects:
    - kind: ServiceAccount
      name: myalert
      namespace: hpe5g
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: myalert
      namespace: hpe5g
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations:
        from:
          kind: DockerImage
          name: docker.io/prom/alertmanager:v0.20.0
        generation: 1
        importPolicy: {}
        name: ""
        referencePolicy:
          type: Source        
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      name: myalert
    spec:
      accessModes:
      - ReadWriteOnce 
      resources:
         requests:
           storage: 8Gi
      
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      name: myalert
      namespace: hpe5g
    spec:
      template: 
        metadata:
          labels: 
            name: myalert
          name: myalert
        spec:
          serviceAccountName: myalert
          containers:
          - name: myalert
            namespace: hpe5g
            image: docker.io/prom/alertmanager:v0.20.0
            env:
              - name: POD_IP
                valueFrom:
                  fieldRef:
                    apiVersion: v1
                    fieldPath: status.podIP
            args:
              - --config.file=/etc/config/alertmanager.yml
              - --storage.path=/data
              - --cluster.advertise-address=$(POD_IP):6783
              - --web.external-url=http://localhost:9093
            ports:
              - containerPort: 9093
            readinessProbe:
              httpGet:
                path: /-/ready
                port: 9093
              initialDelaySeconds: 30
              timeoutSeconds: 30
            resources:
              {}
            volumeMounts:
              - name: config-volume
                mountPath: /etc/config
              - name: storage-volume
                mountPath: "/data"
          volumes:
            - name: config-volume
              configMap:
                name: myalert
            - name: storage-volume
              namespace: hpe5g
              persistentVolumeClaim:
                claimName: myalert
      selector:
        name: myalert
      replicas: 1
  - kind: Service
    apiVersion: v1
    metadata: 
      name: myalert
      namespace: hpe5g
    spec:
      ports:
        - name: http
          port: 80
          protocol: TCP
          targetPort: 9093
      selector:
        name: myalert
  - kind: Route
    apiVersion: v1
    metadata:
      name: myalert
      namespace: hpe5g
    spec:
      to:
        kind: Service
        name: myalert
  - kind: ConfigMap
    apiVersion: v1
    metadata:
      name: myalert
      namespace: hpe5g
    data:
      alertmanager.yml: |
        global: {}
        receivers:
        - name: default-receiver
        route:
          group_interval: 5m
          group_wait: 10s
          receiver: default-receiver
          repeat_interval: 3h
  
  - kind: ServiceAccount
    apiVersion: v1
    metadata:
      name: myprom
      namespace: hpe5g
  - kind: RoleBinding
    apiVersion: authorization.openshift.io/v1
    metadata:
      name: myprom-view
      namespace: hpe5g
    roleRef:
      kind: Role
      name: view
    subjects:
    - kind: ServiceAccount
      name: myprom
      namespace: hpe5g
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: myprom
      namespace: hpe5g
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations:
        from:
          kind: DockerImage
          name: docker.io/prom/prometheus:v2.16.0
        generation: 1
        importPolicy: {}
        name: ""
        referencePolicy:
          type: Source        
  - kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      name: myprom
    spec:
      accessModes:
      - ReadWriteOnce 
      resources:
         requests:
           storage: 200Mi
      
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      name: myprom
      namespace: hpe5g
    spec:
      template: 
        metadata:
          labels: 
            name: myprom
          name: myprom
        spec:
          serviceAccountName: myprom
          containers:
          - name: myprom
            namespace: hpe5g
            image: docker.io/prom/prometheus:v2.16.0
            args:
              - --storage.tsdb.retention.time=15d
              - --config.file=/etc/config/prometheus.yml
              - --storage.tsdb.path=/data
              - --web.console.libraries=/etc/prometheus/console_libraries
              - --web.console.templates=/etc/prometheus/consoles
              - --web.enable-lifecycle
            ports:
              - containerPort: 9090
            readinessProbe:
              httpGet:
                path: /-/ready
                port: 9090
              initialDelaySeconds: 30
              timeoutSeconds: 30
              failureThreshold: 3
              successThreshold: 1
            livenessProbe:
              httpGet:
                path: /-/healthy
                port: 9090
              initialDelaySeconds: 30
              timeoutSeconds: 30
              failureThreshold: 3
              successThreshold: 1
            resources:
              {}
            volumeMounts:
              - name: config-volume
                mountPath: /etc/config
              - mountPath: /data
                name: storage-volume
          volumes:
            - name: config-volume
              configMap:
                name: myprom
            - name: storage-volume
              namespace: hpe5g
              persistentVolumeClaim:
                claimName: myprom
      selector:
        name: myprom
      replicas: 1
  - kind: Service
    apiVersion: v1
    metadata: 
      name: myprom
      namespace: hpe5g
    spec:
      ports:
        - name: http
          port: 80
          protocol: TCP
          targetPort: 9090
      selector:
        name: myprom
      sessionAffinity: None
      type: "ClusterIP"
  - kind: Route
    apiVersion: v1
    metadata:
      name: myprom
      namespace: hpe5g
    spec:
      to:
        kind: Service
        name: myprom
  - kind: ConfigMap
    apiVersion: v1
    metadata:
      name: myprom
      namespace: hpe5g
    data:
      alerting_rules.yml: |
        {}
      alerts: |
        {}
      prometheus.yml: |
        global:
          evaluation_interval: 1m
          scrape_interval: 1m
          scrape_timeout: 10s
        rule_files:
        - /etc/config/recording_rules.yml
        - /etc/config/alerting_rules.yml
        - /etc/config/rules
        - /etc/config/alerts
        scrape_configs:
        - job_name: prometheus
          static_configs:
          - targets:
            - localhost:9090
        - bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
          job_name: kubernetes-apiservers
          kubernetes_sd_configs:
          - role: endpoints
          relabel_configs:
          - action: keep
            regex: default;kubernetes;https
            source_labels:
            - __meta_kubernetes_namespace
            - __meta_kubernetes_service_name
            - __meta_kubernetes_endpoint_port_name
          scheme: https
          tls_config:
            ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
            insecure_skip_verify: true
        - bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
          job_name: kubernetes-nodes
          kubernetes_sd_configs:
          - role: node
          relabel_configs:
          - action: labelmap
            regex: __meta_kubernetes_node_label_(.+)
          - replacement: kubernetes.default.svc:443
            target_label: __address__
          - regex: (.+)
            replacement: /api/v1/nodes/$1/proxy/metrics
            source_labels:
            - __meta_kubernetes_node_name
            target_label: __metrics_path__
          scheme: https
          tls_config:
            ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
            insecure_skip_verify: true
        - bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
          job_name: kubernetes-nodes-cadvisor
          kubernetes_sd_configs:
          - role: node
          relabel_configs:
          - action: labelmap
            regex: __meta_kubernetes_node_label_(.+)
          - replacement: kubernetes.default.svc:443
            target_label: __address__
          - regex: (.+)
            replacement: /api/v1/nodes/$1/proxy/metrics/cadvisor
            source_labels:
            - __meta_kubernetes_node_name
            target_label: __metrics_path__
          scheme: https
          tls_config:
            ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
            insecure_skip_verify: true
        - job_name: kubernetes-service-endpoints
          kubernetes_sd_configs:
          - role: endpoints
          relabel_configs:
          - action: keep
            regex: true
            source_labels:
            - __meta_kubernetes_service_annotation_prometheus_io_scrape
          - action: replace
            regex: (https?)
            source_labels:
            - __meta_kubernetes_service_annotation_prometheus_io_scheme
            target_label: __scheme__
          - action: replace
            regex: (.+)
            source_labels:
            - __meta_kubernetes_service_annotation_prometheus_io_path
            target_label: __metrics_path__
          - action: replace
            regex: ([^:]+)(?::d+)?;(d+)
            replacement: $1:$2
            source_labels:
            - __address__
            - __meta_kubernetes_service_annotation_prometheus_io_port
            target_label: __address__
          - action: labelmap
            regex: __meta_kubernetes_service_label_(.+)
          - action: replace
            source_labels:
            - __meta_kubernetes_namespace
            target_label: kubernetes_namespace
          - action: replace
            source_labels:
            - __meta_kubernetes_service_name
            target_label: kubernetes_name
          - action: replace
            source_labels:
            - __meta_kubernetes_pod_node_name
            target_label: kubernetes_node
        - job_name: kubernetes-service-endpoints-slow
          kubernetes_sd_configs:
          - role: endpoints
          relabel_configs:
          - action: keep
            regex: true
            source_labels:
            - __meta_kubernetes_service_annotation_prometheus_io_scrape_slow
          - action: replace
            regex: (https?)
            source_labels:
            - __meta_kubernetes_service_annotation_prometheus_io_scheme
            target_label: __scheme__
          - action: replace
            regex: (.+)
            source_labels:
            - __meta_kubernetes_service_annotation_prometheus_io_path
            target_label: __metrics_path__
          - action: replace
            regex: ([^:]+)(?::d+)?;(d+)
            replacement: $1:$2
            source_labels:
            - __address__
            - __meta_kubernetes_service_annotation_prometheus_io_port
            target_label: __address__
          - action: labelmap
            regex: __meta_kubernetes_service_label_(.+)
          - action: replace
            source_labels:
            - __meta_kubernetes_namespace
            target_label: kubernetes_namespace
          - action: replace
            source_labels:
            - __meta_kubernetes_service_name
            target_label: kubernetes_name
          - action: replace
            source_labels:
            - __meta_kubernetes_pod_node_name
            target_label: kubernetes_node
          scrape_interval: 5m
          scrape_timeout: 30s
        - honor_labels: true
          job_name: prometheus-pushgateway
          kubernetes_sd_configs:
          - role: service
          relabel_configs:
          - action: keep
            regex: pushgateway
            source_labels:
            - __meta_kubernetes_service_annotation_prometheus_io_probe
        - job_name: kubernetes-services
          kubernetes_sd_configs:
          - role: service
          metrics_path: /probe
          params:
            module:
            - http_2xx
          relabel_configs:
          - action: keep
            regex: true
            source_labels:
            - __meta_kubernetes_service_annotation_prometheus_io_probe
          - source_labels:
            - __address__
            target_label: __param_target
          - replacement: blackbox
            target_label: __address__
          - source_labels:
            - __param_target
            target_label: instance
          - action: labelmap
            regex: __meta_kubernetes_service_label_(.+)
          - source_labels:
            - __meta_kubernetes_namespace
            target_label: kubernetes_namespace
          - source_labels:
            - __meta_kubernetes_service_name
            target_label: kubernetes_name
        - job_name: kubernetes-pods
          kubernetes_sd_configs:
          - role: pod
          relabel_configs:
          - action: keep
            regex: true
            source_labels:
            - __meta_kubernetes_pod_annotation_prometheus_io_scrape
          - action: replace
            regex: (.+)
            source_labels:
            - __meta_kubernetes_pod_annotation_prometheus_io_path
            target_label: __metrics_path__
          - action: replace
            regex: ([^:]+)(?::d+)?;(d+)
            replacement: $1:$2
            source_labels:
            - __address__
            - __meta_kubernetes_pod_annotation_prometheus_io_port
            target_label: __address__
          - action: labelmap
            regex: __meta_kubernetes_pod_label_(.+)
          - action: replace
            source_labels:
            - __meta_kubernetes_namespace
            target_label: kubernetes_namespace
          - action: replace
            source_labels:
            - __meta_kubernetes_pod_name
            target_label: kubernetes_pod_name
        - job_name: kubernetes-pods-slow
          kubernetes_sd_configs:
          - role: pod
          relabel_configs:
          - action: keep
            regex: true
            source_labels:
            - __meta_kubernetes_pod_annotation_prometheus_io_scrape_slow
          - action: replace
            regex: (.+)
            source_labels:
            - __meta_kubernetes_pod_annotation_prometheus_io_path
            target_label: __metrics_path__
          - action: replace
            regex: ([^:]+)(?::d+)?;(d+)
            replacement: $1:$2
            source_labels:
            - __address__
            - __meta_kubernetes_pod_annotation_prometheus_io_port
            target_label: __address__
          - action: labelmap
            regex: __meta_kubernetes_pod_label_(.+)
          - action: replace
            source_labels:
            - __meta_kubernetes_namespace
            target_label: kubernetes_namespace
          - action: replace
            source_labels:
            - __meta_kubernetes_pod_name
            target_label: kubernetes_pod_name
          scrape_interval: 5m
          scrape_timeout: 30s
        alerting:
          alertmanagers:
          - kubernetes_sd_configs:
              - role: pod
            tls_config:
              ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
            bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
            relabel_configs:
            - source_labels: [__meta_kubernetes_namespace]
              regex: myprom
              action: keep
            - source_labels: [__meta_kubernetes_pod_label_app]
              regex: prometheus
              action: keep
            - source_labels: [__meta_kubernetes_pod_label_component]
              regex: alertmanager
              action: keep
            - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_probe]
              regex: .*
              action: keep
            - source_labels: [__meta_kubernetes_pod_container_port_number]
              regex:
              action: drop
      recording_rules.yml: |
        {}
      rules: |
        {}
  
  - kind: ServiceAccount
    apiVersion: v1
    metadata:
      name: mygateway
      namespace: hpe5g
  - kind: RoleBinding
    apiVersion: authorization.openshift.io/v1
    metadata:
      name: mygateway-view
      namespace: hpe5g
    roleRef:
      kind: Role
      name: view
    subjects:
    - kind: ServiceAccount
      name: mygateway
      namespace: hpe5g
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: mygateway
      namespace: hpe5g
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations:
        from:
          kind: DockerImage
          name: docker.io/prom/pushgateway:v1.0.1
        generation: 1
        importPolicy: {}
        name: ""
        referencePolicy:
          type: Source        
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      name: mygateway
      namespace: hpe5g
    spec:
      template: 
        metadata:
          labels: 
            name: mygateway
          name: mygateway
        spec:
          serviceAccountName: mygateway
          containers:
          - name: mygateway
            namespace: hpe5g
            image: docker.io/prom/pushgateway:v1.0.1
            ports:
              - containerPort: 9091
            livenessProbe:
              httpGet:
                path: /-/healthy
                port: 9091
              initialDelaySeconds: 10
              timeoutSeconds: 10
            readinessProbe:
              httpGet:
                path: /-/ready
                port: 9091
              initialDelaySeconds: 10
              timeoutSeconds: 10
            resources:
              {}
      selector:
        name: mygateway
      replicas: 1
  - kind: Service
    apiVersion: v1
    metadata: 
      name: mygateway
      namespace: hpe5g
    spec:
      selector:
        name: mygateway
      ports:
        - name: http
          port: 9091
          protocol: TCP
          targetPort: 9091
  - kind: Route
    apiVersion: v1
    metadata:
      name: mygateway
      namespace: hpe5g
    spec:
      to:
        kind: Service
        name: mygateway
  
  - kind: ServiceAccount
    apiVersion: v1
    metadata:
      name: mygraf
      namespace: hpe5g
  - kind: RoleBinding
    apiVersion: authorization.openshift.io/v1
    metadata:
      name: mygraf-view
      namespace: hpe5g
    roleRef:
      kind: Role
      name: view
    subjects:
    - kind: ServiceAccount
      name: mygraf
      namespace: hpe5g
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: mygraf
      namespace: hpe5g
    spec:
      lookupPolicy:
        local: false
      tags:
      - annotations:
        from:
          kind: DockerImage
          name: docker.io/telegraf:1.14-alpine
        generation: 1
        importPolicy: {}
        name: ""
        referencePolicy:
          type: Source        
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      name: mygraf
      namespace: hpe5g
    spec:
      template: 
        metadata:
          labels: 
            name: mygraf
          name: mygraf
        spec:
          serviceAccountName: mygraf
          containers:
          - name: mygraf
            namespace: hpe5g
            image: docker.io/telegraf:1.14-alpine
            env:
            - name: HOSTNAME
              value: telegraf-polling-service
            volumeMounts:
            - name: config-volume
              mountPath: /etc/telegraf
          volumes:
            - name: config-volume
              configMap:
                name: mygraf
      selector:
        name: mygraf
      replicas: 1
  - kind: Service
    apiVersion: v1
    metadata: 
      name: mygraf
      namespace: hpe5g
    spec:
      type: ClusterIP
      ports:
      - port: 8888
        targetPort: 8888
        name: "health"
      - port: 8125
        targetPort: 8125
        protocol: "UDP"
        name: "statsd"
      selector:
        name: mygraf
  - kind: Route
    apiVersion: v1
    metadata:
      name: mygraf
      namespace: hpe5g
    spec:
      to:
        kind: Service
        name: mygraf
  - kind: ConfigMap
    apiVersion: v1
    metadata:
      name: mygraf
      namespace: hpe5g
    data:
      telegraf.conf: |+    
        [agent]
          collection_jitter = "0s"
          debug = false
          flush_interval = "10s"
          flush_jitter = "0s"
          hostname = "$HOSTNAME"
          interval = "10s"
          logfile = ""
          metric_batch_size = 1000
          metric_buffer_limit = 10000
          omit_hostname = false
          precision = ""
          quiet = false
          round_interval = true
        [[processors.enum]]
          [[processors.enum.mapping]]
            dest = "status_code"
            field = "status"
            [processors.enum.mapping.value_mappings]
                critical = 3
                healthy = 1
                problem = 2
        [[outputs.prometheus_client]]
          listen = ":9273"
          path = "/metrics"
        [[inputs.internal]]
          collect_memstats = false
        [[inputs.influxdb_listener]]
          service_address = ":8888"
  
EOFILE
# CustomApps deployment scripts
if $_deploy ; then 
	_ocAction="apply"
	_helmAction() { helm upgrade --install $_HPE5G_name $_HPE5G_template --values _tmp_$_helmValues $_HPE5G_options; }
else
	_helmAction() { helm delete $_HPE5G_name ; }
	_ocAction="delete"
fi

# checking user logged in
oc_user=$(oc whoami)
test -n "$oc_user" && [ "$oc_user" != "system:admin" ] || _fail_ "Current user is ${oc_user:-unknown}: please log as user: oc login -u user"
_log_ "$_displayedAction CMS5G Core Stack as user $oc_user"
_log_ "Checking projects"
oc_projects="hpe5g"
for _project in $oc_projects ; do oc project $_project &>> $logfile || oc new-project $_project --display-name="Project $_project" --description='From HPE5g automated deployer 2021-03-04 Version 0.91 on: Thu Mar 04 2021 14:09:55 GMT+0100 (Central European Standard Time) Two OpenShift 4 cluster with a limited set of services' &>> $logfile || _fail_ "Cannot find or create project $_project missing" ; done
if echo guess | oc login -u system:admin &>> $logfile ; then
_log_ "Listing nodes as system:admin"
oc get nodes -o wide &>> $logfile
oc login -u $oc_user &>> $logfile

fi
_log_ "Listing pods as $oc_user"
oc get pods -o wide  -n default  &>> $logfile
oc_image_projects=(       )
oc_image_urls=(       )
oc_images=(       )
[[ ${#oc_images[@]} != 0 ]] && _log_ "Populating the docker registry with services images: pull, tag and push"
  for _iImage in ${!oc_images[@]} ; do
    sudo docker login -u $(oc whoami) -p $(oc whoami -t) docker-registry.default.svc:5000 &>> $logfile || _fail_ "Cannot connect to the internal docker registry as user $oc_user"
    sudo docker pull ${oc_image_urls[$_iImage]}/${oc_images[$_iImage]} || _fail_ "Cannot pull ${oc_image_urls[$_iImage]}/${oc_images[$_iImage]}"
    sudo docker tag ${oc_image_urls[$_iImage]}/${oc_images[$_iImage]} docker-registry.default.svc:5000/${oc_image_projects[$_iImage]}/${oc_images[$_iImage]} || _fail_ "Cannot tag ${oc_image_urls[$_iImage]}/${oc_images[$_iImage]}"
	sudo docker push docker-registry.default.svc:5000/${oc_image_projects[$_iImage]}/${oc_images[$_iImage]} || _fail_ "Cannot push docker-registry.default.svc:5000/${oc_image_projects[$_iImage]}/${oc_images[$_iImage]}"
  done
if false && echo guess | oc login -u system:admin &>> $logfile ; then
_log_ "Relaxing security policy to match network functions requirements, approving pending certificates"
oc adm policy add-scc-to-user anyuid system:serviceaccount  &>> $logfile &&
oc adm policy add-scc-to-user privileged system:serviceaccount  &>> $logfile &&
oc adm policy add-scc-to-group anyuid system:authenticated  &>> $logfile &&
oc adm policy add-role-to-group view system:serviceaccounts &>> $logfile &&
oc policy add-role-to-user view system:serviceaccount &>> $logfile || _fail_ "Cannot relax security settings"
if test -n "$(oc get csr -o name)" ; then oc get csr -o name | xargs oc adm certificate approve &>> $logfile || _fail_ "Cannot approve pending certificates" ; fi
if test -f openshift_volumes.yaml ; then _log_ "$_displayedAction the persistent volumes with idempotence" && oc process -f openshift_volumes.yaml | oc $_ocAction -f - &>> $logfile && oc get persistentvolumes -o wide || _fail_ "Cannot create persistent volumes" ; fi
fi
_log_ "$_displayedAction the network functions and Helm instances"
for _project in $oc_projects; do 
	oc project $_project &>> $logfile || _fail_ "Cannot switch to project $_project"
	# Deploy custom apps if any
	if test -f openshift_project_$_project.sh ; then _log_ "$_displayedAction openshift_project_$_project.sh on project $_project" && ./openshift_project_$_project.sh $_ocAction &>> $logfile && rm -f openshift_project_$_project.sh &>> $logfile || _fail_ "$_displayedAction openshift_project_$_project.sh "; fi
	# File naming convention for Network functions: openshift_project_<project>.yaml
	# File naming convention for Helm instances: openshift_helm_<project>_<name>.yaml and a first line setting the context as bash variables: _HPE5G_name= _HPE5G_template= _HPE5G_options=
	if test -f openshift_project_$_project.yaml ; then _log_ "$_displayedAction openshift_project_$_project.yaml on project $_project" && _cmd_with_retry "oc process -f openshift_project_$_project.yaml | oc $_ocAction -f -" "Processing" && rm -f openshift_project_$_project.yaml &>> $logfile || _fail_ "$_displayedAction openshift_project_$_project.yaml "; fi
	for _helmValues in $(ls openshift_helm_${_project}_*.yaml 2> /dev/null) ; do eval $(head -1 $_helmValues) && _log_ "$_displayedAction $_HPE5G_name with chart $_HPE5G_template $_HPE5G_options on project $_project" && tail -n +2 $_helmValues > _tmp_$_helmValues && _helmAction &>> $logfile && rm -f $_helmValues _tmp_$_helmValues &>> $logfile || _fail_ "$_displayedAction Helm instance on project $_project" ; done
	# Undeployment: wait for pods termination  
	while [[ "$_ocAction" == "delete" ]] && _log_ "Waiting 30s for terminating pods on project $_project" && sleep 30 && oc get pods 2> /dev/null | grep -e Terminating &>> $logfile ; do : ; done
	# If undeployment, indulge 5 seconds to stabilize, then delete the project if no pods, otherwise log a status
	[[ "$_ocAction" == "delete" ]] && sleep 5s && test -n "$(oc get pods --namespace $_project 2>&1 >/dev/null)" && _log_ "No remaining pods in project $_project: deleting" && oc delete project $_project &>> $logfile || oc get all --namespace $_project &>> $logfile 
done
oc login -u $oc_user &>> $logfile || _fail_ "Cannot log as $oc_user"
_log_ "$_displayedAction completed: check $logfile"

}

# Undeployment
undeployOCP() {
  local _name=$1
  local _domain=$2
  local _fipapi=$3
  local _fipapp=$4

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
  if ${ETCHOSTS:-false} ; then 
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
i=0 && while (( i <  ${#OCP[@]} )) ; do 
  os_env=${OS_env[i]:-$OS_env}
  if test -n "$os_env" ; then
    source $os_env || _failOCP4_ "Environment file $os_env not found"
  fi
  
  $_deploy && deployOCP ${OCP[i]:-$OCP} ${DOMAIN[i]:-$DOMAIN} ${FLAVOR[i]:-$FLAVOR} ${MASTERS[i]:-$MASTERS} ${WORKERS[i]:-$WORKERS} ${EXTNET[i]:-$EXTNET} ${EXTDNS[i]:-$EXTDNS} ${FIPAPI[i]:-$FIPAPI} ${FIPAPP[i]:-$FIPAPP} ${NBVOLUMES[i]:-$NBVOLUMES} ${FLAVORWORKER[i]:-$FLAVORWORKER} || undeployOCP ${OCP[i]:-$OCP} ${DOMAIN[i]:-$DOMAIN} ${FIPAPI[i]:-$FIPAPI} ${FIPAPP[i]:-$FIPAPP} 
  ((i+=1))
done

exit 0