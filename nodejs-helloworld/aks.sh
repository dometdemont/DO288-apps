#! /bin/bash
_usage() {
    echo "
HPE 5G resources automated deployer: 2021-06-21 Version 0.97
This client deploys and undeploys 
- OpenShift clusters hosted on OpenStack 
- Individual OpenStack resources as a stack
- HPE 5g resources 
 
Usage: $0 
    -d|--deploy <name> : name of the OpenShift instance and OpenStack stack to deploy; default: hpe5g
    -c|--cloud <cloud type>: type of the target cloud: openstack|azure
    -o|--domain <domain name> : domain name of the OpenShift instance to deploy; default: localdomain
    -n|--OSnetwork <network root>: default OpenStack network root as 3 unique digits like 192.168.199
    -e|--OSenv <EnvironmentFile> : name of the file providing the infrastructure environment. 
      For Azure, this file can be typically used for setting the PATH to point to the target openshift and oc CLI
      For OpenStack , this environment is typically retrieved from the GUI: Project/API access
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

_defaultName=$default_stack
unset OCP FIPAPI FIPAPP
ETCHOSTS=true
EXTNET=ext-net
DOMAIN=localdomain
WORKERS=3
MASTERS=3
FLAVOR=v4.m16.d25
FLAVORWORKER=$FLAVOR
EXTDNS=8.8.8.8
NBVOLUMES=10

_defaultName=(mayflower santamaria)
VANILLA=(mayflower santamaria)
VANILLACLOUD=(azure azure)
VANILLANODES=(3 5)
VANILLAFLAVOR=(Standard_B2ms Standard_B4ms)
VANILLALOCATION=(westeurope westeurope)
VANILLASSHKEY=("" "")

RHELSECRET='{"auths":{"cloud.openshift.com":{"auth":"b3BlbnNoaWZ0LXJlbGVhc2UtZGV2K2RvbWV0ZGVtb250MXhjMXp2N3VhbjNhbTloamNrb2h1Y2tscTBjOlM2QVc3WUlCSDFMRFhSRkhBNU1WM1dOWUFNQjRSTDk4MU1JRE1PQzFYQUVBMDRLWlRKNVk3SzQwUFFVODlOOUo=","email":"dominique.domet-de-mont@hpe.com"},"quay.io":{"auth":"b3BlbnNoaWZ0LXJlbGVhc2UtZGV2K2RvbWV0ZGVtb250MXhjMXp2N3VhbjNhbTloamNrb2h1Y2tscTBjOlM2QVc3WUlCSDFMRFhSRkhBNU1WM1dOWUFNQjRSTDk4MU1JRE1PQzFYQUVBMDRLWlRKNVk3SzQwUFFVODlOOUo=","email":"dominique.domet-de-mont@hpe.com"},"registry.connect.redhat.com":{"auth":"NDM4MTY3MHx1aGMtMVhjMVp2N1VhTjNBbTloSmNrb2h1Y0tMcTBjOmV5SmhiR2NpT2lKU1V6VXhNaUo5LmV5SnpkV0lpT2lJMk4yUmpOMlZtWTJNMU5qSTBPVEZsT1RneVpXTTBOVGM1TUdGa1pUQTNaQ0o5Lkp2dWsybEo2Q3dLLTY5WnBkbDg1enk0RFUtdzV3aTVPWE5aZ0hDUDBlbXNCVmZDXzkzN3Fhdk5OZDZqdjRBU0NSRllPb3ZCTmxYTEhJbjA5amhIaTJiZDRfQ2xwMVhBaTdPYWVwN21qc0x5NVdrSEZHU3lHcU02RU43Y1N3bmFRWm00Q3lDNmNHaFItbVhtYnVDUTdYdWl0MVJCNEh5X0laZHV6dUhOa3hmam5aX2ZmWHNRb1ZVTmoxdW44bFlZMjQzLXpOMkpvN0p2M3MwZkZYYnBnbzBtMUNia284MzIzRWhGc3h5SFM5UXNYWUk3VDRJX21JRnBHMTZSVGotUGUyalluNjVJTnBxVFF4Y0FQaHpuQkxLYUNwd01Yb2F2V0hPMXpRWEs1QTF2dGR3Z1VUZEh0VWplX3FYUm13ZUQwYkVOeDRiVHgySGx2X0RlcnZuMEVfc3ZuRU4zVlpkNEc0VFNHZlo2d1c1LVlvSjJxZkdxeGVqeVZWdThqeDFyazFWRk52NERXaDd4amlTZ2I5d3dNTWVWVW9pSXFMZUN2NTZzUW4ycTRUdUpmdDNIVGR2UXhBSldHQWtGbDBFVUJKT0R2aGZrWGtSTWtjbmk5RVdiZVU0NWYwUThhQ1NmeG84anBzNE80endUMUxSQlVTVE5ZekN3bjhrTFdYR2FkaGo1aHdDNW9XNjlzUW5wYmpEY2JWR0dCSkdhNUtRREJpNmRVNzFoUTY3cThncUZ1UHhOaXJCcFNleTg0VWxtMS1PVjBzVXN4dnRwaVYxWFFvUVJrcHRVNnNBMFJaMTE2c25JT0gxR2piWm9paTB6M2hJbUltcmRPeG1ReHhYcC1nTWhsc2txcDZRVGtSWFdPZ0lyYWJ0UkNvV2pRc3JZb1EyZFNiRzBBODNB","email":"dominique.domet-de-mont@hpe.com"},"registry.redhat.io":{"auth":"NDM4MTY3MHx1aGMtMVhjMVp2N1VhTjNBbTloSmNrb2h1Y0tMcTBjOmV5SmhiR2NpT2lKU1V6VXhNaUo5LmV5SnpkV0lpT2lJMk4yUmpOMlZtWTJNMU5qSTBPVEZsT1RneVpXTTBOVGM1TUdGa1pUQTNaQ0o5Lkp2dWsybEo2Q3dLLTY5WnBkbDg1enk0RFUtdzV3aTVPWE5aZ0hDUDBlbXNCVmZDXzkzN3Fhdk5OZDZqdjRBU0NSRllPb3ZCTmxYTEhJbjA5amhIaTJiZDRfQ2xwMVhBaTdPYWVwN21qc0x5NVdrSEZHU3lHcU02RU43Y1N3bmFRWm00Q3lDNmNHaFItbVhtYnVDUTdYdWl0MVJCNEh5X0laZHV6dUhOa3hmam5aX2ZmWHNRb1ZVTmoxdW44bFlZMjQzLXpOMkpvN0p2M3MwZkZYYnBnbzBtMUNia284MzIzRWhGc3h5SFM5UXNYWUk3VDRJX21JRnBHMTZSVGotUGUyalluNjVJTnBxVFF4Y0FQaHpuQkxLYUNwd01Yb2F2V0hPMXpRWEs1QTF2dGR3Z1VUZEh0VWplX3FYUm13ZUQwYkVOeDRiVHgySGx2X0RlcnZuMEVfc3ZuRU4zVlpkNEc0VFNHZlo2d1c1LVlvSjJxZkdxeGVqeVZWdThqeDFyazFWRk52NERXaDd4amlTZ2I5d3dNTWVWVW9pSXFMZUN2NTZzUW4ycTRUdUpmdDNIVGR2UXhBSldHQWtGbDBFVUJKT0R2aGZrWGtSTWtjbmk5RVdiZVU0NWYwUThhQ1NmeG84anBzNE80endUMUxSQlVTVE5ZekN3bjhrTFdYR2FkaGo1aHdDNW9XNjlzUW5wYmpEY2JWR0dCSkdhNUtRREJpNmRVNzFoUTY3cThncUZ1UHhOaXJCcFNleTg0VWxtMS1PVjBzVXN4dnRwaVYxWFFvUVJrcHRVNnNBMFJaMTE2c25JT0gxR2piWm9paTB6M2hJbUltcmRPeG1ReHhYcC1nTWhsc2txcDZRVGtSWFdPZ0lyYWJ0UkNvV2pRc3JZb1EyZFNiRzBBODNB","email":"dominique.domet-de-mont@hpe.com"}}}'

while [[ "$#" -gt 0 ]]; do case $1 in
  -d|--deploy) _deploy=true; _displayedAction="Deploying"; state=present ; OCP=(${2:-${OCP[@]:-$_defaultName}}) ; shift;;
  -u|--undeploy|--destroy) _deploy=false ; _displayedAction="Undeploying"; state=absent ; OCP=(${2:-${OCP[@]:-$_defaultName}}); shift;;
  -c|--cloud) CLOUD=($2); shift;;
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

  # Check pre-requisites
  VanillaAzureRequirements() {
    which jq > /dev/null && _log_ "jq CLI available" || _fail_ "Missing json parser jq: please install jq 1.5 or later"
    which az > /dev/null && _log_ Azure CLI available az $(az version | jq -r '."azure-cli"') || _fail_ "Missing Azure CLI az: please install az CLI 2.6.0 or later "
    local azureLoggedUser=$(az ad signed-in-user show | jq -r .userPrincipalName)
    test -n "$azureLoggedUser" && _log_ "Logged in Azure as $azureLoggedUser" || _fail_ "Missing logging in Azure; please run: az login"
    which kubectl > /dev/null && _log_ "kubectl CLI available" || _fail_ "Missing kubectl command; please run: sudo az aks install-cli"
  }

  # Deploy a vanilla kubernetes instance on Azure
  deployVanillaAzure() {
    local _name=$1
    local _flavor=$2
    local _nodes=$3
    local _location=$4
    local _sshKey=$5

    # Dedicate a specific resource group to this aks instance: naming rule: aks_<name>
    local grp_name=aks_$_name
    local _az_aks_create="$_preview az aks create --yes --resource-group $grp_name --name $_name --node-count $_nodes --node-vm-size $_flavor --enable-addons monitoring"
    
    # Check for an existing resource group with this name
    az group show --resource-group $grp_name > /dev/null 2>&1 && _fail_ "Azure resource group $grp_name already exists"
    $_preview az group create --name $grp_name --location $_location &>> $logfile && _log_ "Azure resource group $grp_name created" || _fail_ "Cannot create Azure resource group $grp_name"
    _log_ "Creating aks instance $_name in $_location consisting in $_nodes nodes with flavor $_flavor"
    # generate-ssh-keys if no key was provided
    if test -n "$_sshKey" ; then 
      $_az_aks_create --ssh-key-value "$_sshKey" &>> $logfile || _fail_ "Cannot create Azure aks $_name in group $grp_name located in $_location"
    else
      $_az_aks_create --generate-ssh-keys &>> $logfile || _fail_ "Cannot create Azure aks $_name in group $grp_name located in $_location"
    fi
    $_preview az aks get-credentials --overwrite-existing --resource-group $grp_name --name $_name &>> $logfile || _fail_ "Cannot get credentials from aks instance $_name "
    $_preview kubectl get nodes &>> $logfile || _fail_ "Cannot connect to aks instance $_name using kubectl"
    _log_ "aks instance $_name successfully created" 
  }
  
  # Deploy a vanilla kubernetes instance on Azure
  undeployVanillaAzure() {
    local _name=$1
    # Dedicate a specific resource group to this aks instance: naming rule: aks_<name>
    local grp_name=aks_$_name
    _log_  "Deleting aks instance $_name"
    $_preview az aks delete --yes --name $_name --resource-group $grp_name &>> $logfile || _fail_ "Cannot delete aks instance $_name"
    _log_ "Deleting Azure resource group $grp_name"
    $_preview az group delete --name $grp_name --yes &>> $logfile || _fail_ "Cannot delete Azure resource group $grp_name"
  }

# For all instance names, deploy or undeploy
i=0 && while (( i <  ${#VANILLA[@]} )) ; do 
  case ${VANILLACLOUD[i]} in
  azure)
    VanillaAzureRequirements
    $_deploy && deployVanillaAzure ${VANILLA[i]:-$VANILLA} ${VANILLAFLAVOR[i]:-$VANILLAFLAVOR} ${VANILLANODES[i]:-$VANILLANODES} ${VANILLALOCATION[i]:-$VANILLALOCATION} "${VANILLASSHKEY[i]:-$VANILLASSHKEY}" || undeployVanillaAzure ${VANILLA[i]:-$VANILLA}   
    ;;
  *) _fail_ Unsupported cloud type ${VANILLACLOUD[i]}: expecting azure ;;
  esac  
  ((i+=1))
done



exit 0