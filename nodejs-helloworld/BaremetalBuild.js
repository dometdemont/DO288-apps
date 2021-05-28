//=================================
//OCP4 baremetal deployer
//=================================
//Return a shell script deploying OpenShift 4 on bare metal
function buildOCP4BaremetalDeployer(){
  // Build or get the errors: 
  var warnings=BaremetalNodes.build();
  // If no openshift instances are defined, display warnings and return
  if(!BaremetalNodes.clusters){
    userOutput(warnings);
    return '';
  }
  var shell= `
# Reference documentation for OpenShift deployment on bare metal: https://openshift-kni.github.io/baremetal-deploy/4.6/Deployment.html
# Deployment
# Input parameters: cluster name, command to power off all nodes part of this cluster, list of nodes providing local storage as a json array
deployOCPBM() {
  local _name=$1
  local _powerOff=$2
  local _localStorageNodes=$3
  
  # Check openshift deployments CLIs
  which oc > /dev/null && _log_ "oc CLI available version $(oc version 2> /dev/null | grep 'Client Version'  | awk '{print $3}')" || _fail_ "Missing oc CLI "
  which openshift-baremetal-install > /dev/null && _log_ "openshift-baremetal-install CLI available version $(openshift-baremetal-install version | grep openshift-baremetal-install | awk '{print $2}')" || _fail_ "Missing openshift-baremetal-install CLI"
  which ipmitool > /dev/null && _log_ "$(ipmitool -V) CLI available" || _fail_ "Missing ipmitool CLI"
  
  # Save a copy of the install-config.yaml consumed by the OpenShift installer
  cp -f $_name/install-config.yaml $_name/install-config.saved.yaml &>> $logfile || _fail_ "Cannot save $_name/install-config.yaml to $_name/install-config.saved.yaml"
  
  # Power off all nodes
  _log_ "Shuting down all servers part of $_name "
  eval $_powerOff &>> $logfile || _fail_ "Cannot shutdown $_name nodes with: $_powerOff"
  
  # Deploy the cluster
  _log_ "Deploying the OpenShift cluster $_name"
  if [ "$logfile" != "/dev/stdout" ] ; then _log_ "This takes a while, follow-up available in $logfile" ; fi
  $_preview openshift-baremetal-install create cluster --dir $_name --log-level debug &>> $logfile || _fail_ "Cannot create OpenShift cluster $_name"

  _log_ "Checking deployment completion" 
  $_preview openshift-baremetal-install wait-for install-complete --dir $_name --log-level debug &>> $logfile || _fail_ "OpenShift cluster $_name creation did not complete"
  
  _log_ "Checking OCP login as kubeadmin on $_name with KUBECONFIG=$_name/auth/kubeconfig and kubeadmin-password $(cat $_name/auth/kubeadmin-password)"
  export KUBECONFIG=$_name/auth/kubeconfig
  oc login -u kubeadmin -p $(cat $_name/auth/kubeadmin-password) &>> $logfile || _fail_ "Cannot login to OCP cluster $_name as kubeadmin"
`+
// Cluster is ready for openshift resources deployment
buildNetworkFunctions()
+`
}

# Undeployment
undeployOCPBM() {
  local _name=$1
  
  # Delete cluster
  _log_ "Destroying OpenShift cluster $_name"
  $_preview openshift-baremetal-install destroy cluster --dir $_name --log-level debug &>> $logfile || rm -Rf $_name  &>> $logfile || _fail_ "Cannot destroy cluster $_name"
}

_log_ "OpenShift installer internal cleanup"
for i in $(sudo virsh pool-list --all | tail -n +3 | grep cluster | awk {'print $1'}); do   
  virsh pool-destroy $i &>> $logfile   
  rm -Rf /var/lib/libvirt/openshift-images/$i &>> $logfile   
  virsh pool-delete $i &>> $logfile   
  virsh pool-undefine $i &>> $logfile 
done
for i in $(sudo virsh list | tail -n +3 | grep bootstrap | awk {'print $2'}); do   
  sudo virsh destroy $i &>> $logfile   
  sudo virsh undefine $i &>> $logfile   
  sudo virsh vol-delete $i --pool default &>> $logfile   
  sudo virsh vol-delete $i.ign --pool default &>> $logfile 
done

# If deployment, create one directory per OCP cluster, and drop install-config files
if $_deploy ; then
`;
Object.keys(BaremetalNodes.clusters).forEach(function(ocp){
shell+=`_name=`+ocp+`
mkdir -p $_name || _fail_ "Cannot create installation directory $_name"
# Build install-config.yaml
cat > $_name/install-config.yaml << EOF || _fail_ "Cannot build $_name/install-config.yaml"
`+BaremetalNodes.clusters[ocp].installConfig+`
EOF
`  
});

shell+=`
fi  # If deployment, create one directory per OCP cluster, and drop install-config files

# For all instance names, deploy or undeploy
i=0 && while (( i <  $\{#OCPBM[@]} )) ; do 
  $_deploy && deployOCPBM $\{OCPBM[i]:-$OCPBM} "$\{OCPBMOFF[i]}" "$\{OCPBMNODES[i]}"  || undeployOCPBM $\{OCPBM[i]:-$OCPBM}  
  ((i+=1))
done
`;
return shell;
}