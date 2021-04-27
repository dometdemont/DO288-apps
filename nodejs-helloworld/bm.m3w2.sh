#! /bin/bash
_usage() {
    echo "
HPE 5G resources automated deployer: 2021-04-14 Version 0.92
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

_defaultName=(steel)
OCPBM=(steel)
OCPBMOFF=("ipmitool -I lanplus -U admin -P HP1nvent -H 10.33.0.16 power off && ipmitool -I lanplus -U admin -P HP1nvent -H 10.33.0.17 power off && ipmitool -I lanplus -U admin -P HP1nvent -H 10.33.0.19 power off && ipmitool -I lanplus -U admin -P HP1nvent -H 10.33.0.15 power off && ipmitool -I lanplus -U admin -P HP1nvent -H 10.33.0.18 power off")
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

# Reference documentation for OpenShift deployment on bare metal: https://openshift-kni.github.io/baremetal-deploy/4.6/Deployment.html
# Deployment
# Input parameters: cluster name and command to power off all nodes part of this cluster
deployOCPBM() {
  local _name=$1
  local _powerOff=$2
  
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
    until _cmdOutput=$(eval "$_cmd" >> $logfile) || (( $_count >= $_countMax )) ; do
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

cat > openshift_project_sanity.yaml << 'EOFILE'
apiVersion: template.openshift.io/v1
kind: Template
metadata:
  name: sanity
  annotations:
    description: network functions and backing services for project sanity
objects:
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: mypipes
      namespace: sanity
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
      name: mypipes
    spec:
      tls:
        insecureEdgeTerminationPolicy: Redirect
        termination: edge
      to:
        kind: Service
        name: mypipes
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      annotations:
        template.alpha.openshift.io/wait-for-ready: "true"
      name: mypipes
    spec:
      replicas: 1
      selector:
        name: mypipes
      strategy:
        type: Recreate
      template:
        metadata:
          labels:
            name: mypipes
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
              value: mypipes
            - name: JNLP_SERVICE_NAME
              value: mypipes-jnlp
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
              name: mypipes-data
          dnsPolicy: ClusterFirst
          restartPolicy: Always
          serviceAccountName: mypipes
          volumes:
          - emptyDir:
              medium: ""
            name: mypipes-data
  - kind: ServiceAccount
    apiVersion: v1
    metadata:
      annotations:
        serviceaccounts.openshift.io/oauth-redirectreference.jenkins: '{"kind":"OAuthRedirectReference","apiVersion":"v1","reference":{"kind":"Route","name":"mypipes"}}'
      name: mypipes
  - apiVersion: v1
    groupNames: null
    kind: RoleBinding
    metadata:
      name: mypipes_edit
    roleRef:
      name: edit
    subjects:
    - kind: ServiceAccount
      name: mypipes
  - kind: Service
    apiVersion: v1
    metadata:
      name: mypipes-jnlp
    spec:
      ports:
      - name: agent
        nodePort: 0
        port: 50000
        protocol: TCP
        targetPort: 50000
      selector:
        name: mypipes
      sessionAffinity: None
      type: ClusterIP
  - kind: Service
    apiVersion: v1
    metadata:
      annotations:
        service.alpha.openshift.io/dependencies: '[{"name": "mypipes-jnlp", "namespace": "", "kind": "Service"}]'
        service.openshift.io/infrastructure: "true"
      name: mypipes
    spec:
      ports:
      - name: web
        nodePort: 0
        port: 80
        protocol: TCP
        targetPort: 8080
      selector:
        name: mypipes
      sessionAffinity: None
      type: ClusterIP
  
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
oc_projects="sanity"
for _project in $oc_projects ; do if [[ "$_project" =~ ^openshift.* ]] ; then _newproject_prefix="adm" ; else _newproject_prefix="" ; fi ; oc project $_project &>> $logfile || oc $_newproject_prefix new-project $_project --display-name="Project $_project" --description='From HPE5g automated deployer 2021-04-14 Version 0.92 on: Thu Apr 15 2021 10:50:12 GMT+0200 (Central European Summer Time) An OpenShift cluster on 5 baremetal servers, 3 masters and 2 workers, one jenkins pipeline deployed.' &>> $logfile || _fail_ "Cannot find or create project $_project missing" ; done
if echo guess | oc login -u system:admin &>> $logfile ; then
_log_ "Listing nodes as system:admin"
oc get nodes -o wide &>> $logfile
oc login -u $oc_user &>> $logfile

fi
_log_ "Listing pods as $oc_user"
oc get pods -o wide  -n default  &>> $logfile
oc_image_projects=()
oc_image_urls=()
oc_images=()
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
_name=steel
mkdir -p $_name || _fail_ "Cannot create installation directory $_name"
# Build install-config.yaml
cat > $_name/install-config.yaml << EOF || _fail_ "Cannot build $_name/install-config.yaml"
apiVersion: v1
baseDomain: hpe5g.bm.fc
metadata:
  name: steel
networking:
  machineCIDR: 10.33.200.0/24
  networkType: OVNKubernetes
compute:
- name: worker
  replicas: 2
controlPlane:
  name: master
  replicas: 3
  platform:
    baremetal: {}
platform:
  baremetal:
    apiVIP: 10.33.200.90
    ingressVIP: 10.33.200.91
    disableCertificateVerification: True
    provisioningBridge: provisioning
    provisioningNetworkCIDR: 10.33.202.0/24
    provisioningNetworkInterface: ens1f0

    hosts:
      - name: zwei
        role: master
        bmc:
          address: ipmi://10.33.0.16/
          username: admin
          password: HP1nvent
          disableCertificateVerification: True
        bootMACAddress: 48:df:37:6b:e7:3c
        rootDeviceHints:
         deviceName: "/dev/sdb"
      - name: drei
        role: master
        bmc:
          address: ipmi://10.33.0.17/
          username: admin
          password: HP1nvent
          disableCertificateVerification: True
        bootMACAddress: 48:df:37:68:f4:c8
        rootDeviceHints:
         deviceName: "/dev/sdb"
      - name: funf
        role: master
        bmc:
          address: ipmi://10.33.0.19/
          username: admin
          password: HP1nvent
          disableCertificateVerification: True
        bootMACAddress: 48:df:37:c9:ab:a8
        rootDeviceHints:
         deviceName: "/dev/sdb"
      - name: eins
        role: worker
        bmc:
          address: ipmi://10.33.0.15/
          username: admin
          password: HP1nvent
          disableCertificateVerification: True
        bootMACAddress: 48:df:37:6b:e7:38
        rootDeviceHints:
         deviceName: "/dev/sdh"
      - name: vier
        role: worker
        bmc:
          address: ipmi://10.33.0.18/
          username: admin
          password: HP1nvent
          disableCertificateVerification: True
        bootMACAddress: 48:df:37:6b:e7:40
        rootDeviceHints:
         deviceName: "/dev/sdh"
pullSecret: '{"auths":{"cloud.openshift.com":{"auth":"b3BlbnNoaWZ0LXJlbGVhc2UtZGV2K2RvbWV0ZGVtb250MXhjMXp2N3VhbjNhbTloamNrb2h1Y2tscTBjOlM2QVc3WUlCSDFMRFhSRkhBNU1WM1dOWUFNQjRSTDk4MU1JRE1PQzFYQUVBMDRLWlRKNVk3SzQwUFFVODlOOUo=","email":"dominique.domet-de-mont@hpe.com"},"quay.io":{"auth":"b3BlbnNoaWZ0LXJlbGVhc2UtZGV2K2RvbWV0ZGVtb250MXhjMXp2N3VhbjNhbTloamNrb2h1Y2tscTBjOlM2QVc3WUlCSDFMRFhSRkhBNU1WM1dOWUFNQjRSTDk4MU1JRE1PQzFYQUVBMDRLWlRKNVk3SzQwUFFVODlOOUo=","email":"dominique.domet-de-mont@hpe.com"},"registry.connect.redhat.com":{"auth":"NDM4MTY3MHx1aGMtMVhjMVp2N1VhTjNBbTloSmNrb2h1Y0tMcTBjOmV5SmhiR2NpT2lKU1V6VXhNaUo5LmV5SnpkV0lpT2lJMk4yUmpOMlZtWTJNMU5qSTBPVEZsT1RneVpXTTBOVGM1TUdGa1pUQTNaQ0o5Lkp2dWsybEo2Q3dLLTY5WnBkbDg1enk0RFUtdzV3aTVPWE5aZ0hDUDBlbXNCVmZDXzkzN3Fhdk5OZDZqdjRBU0NSRllPb3ZCTmxYTEhJbjA5amhIaTJiZDRfQ2xwMVhBaTdPYWVwN21qc0x5NVdrSEZHU3lHcU02RU43Y1N3bmFRWm00Q3lDNmNHaFItbVhtYnVDUTdYdWl0MVJCNEh5X0laZHV6dUhOa3hmam5aX2ZmWHNRb1ZVTmoxdW44bFlZMjQzLXpOMkpvN0p2M3MwZkZYYnBnbzBtMUNia284MzIzRWhGc3h5SFM5UXNYWUk3VDRJX21JRnBHMTZSVGotUGUyalluNjVJTnBxVFF4Y0FQaHpuQkxLYUNwd01Yb2F2V0hPMXpRWEs1QTF2dGR3Z1VUZEh0VWplX3FYUm13ZUQwYkVOeDRiVHgySGx2X0RlcnZuMEVfc3ZuRU4zVlpkNEc0VFNHZlo2d1c1LVlvSjJxZkdxeGVqeVZWdThqeDFyazFWRk52NERXaDd4amlTZ2I5d3dNTWVWVW9pSXFMZUN2NTZzUW4ycTRUdUpmdDNIVGR2UXhBSldHQWtGbDBFVUJKT0R2aGZrWGtSTWtjbmk5RVdiZVU0NWYwUThhQ1NmeG84anBzNE80endUMUxSQlVTVE5ZekN3bjhrTFdYR2FkaGo1aHdDNW9XNjlzUW5wYmpEY2JWR0dCSkdhNUtRREJpNmRVNzFoUTY3cThncUZ1UHhOaXJCcFNleTg0VWxtMS1PVjBzVXN4dnRwaVYxWFFvUVJrcHRVNnNBMFJaMTE2c25JT0gxR2piWm9paTB6M2hJbUltcmRPeG1ReHhYcC1nTWhsc2txcDZRVGtSWFdPZ0lyYWJ0UkNvV2pRc3JZb1EyZFNiRzBBODNB","email":"dominique.domet-de-mont@hpe.com"},"registry.redhat.io":{"auth":"NDM4MTY3MHx1aGMtMVhjMVp2N1VhTjNBbTloSmNrb2h1Y0tMcTBjOmV5SmhiR2NpT2lKU1V6VXhNaUo5LmV5SnpkV0lpT2lJMk4yUmpOMlZtWTJNMU5qSTBPVEZsT1RneVpXTTBOVGM1TUdGa1pUQTNaQ0o5Lkp2dWsybEo2Q3dLLTY5WnBkbDg1enk0RFUtdzV3aTVPWE5aZ0hDUDBlbXNCVmZDXzkzN3Fhdk5OZDZqdjRBU0NSRllPb3ZCTmxYTEhJbjA5amhIaTJiZDRfQ2xwMVhBaTdPYWVwN21qc0x5NVdrSEZHU3lHcU02RU43Y1N3bmFRWm00Q3lDNmNHaFItbVhtYnVDUTdYdWl0MVJCNEh5X0laZHV6dUhOa3hmam5aX2ZmWHNRb1ZVTmoxdW44bFlZMjQzLXpOMkpvN0p2M3MwZkZYYnBnbzBtMUNia284MzIzRWhGc3h5SFM5UXNYWUk3VDRJX21JRnBHMTZSVGotUGUyalluNjVJTnBxVFF4Y0FQaHpuQkxLYUNwd01Yb2F2V0hPMXpRWEs1QTF2dGR3Z1VUZEh0VWplX3FYUm13ZUQwYkVOeDRiVHgySGx2X0RlcnZuMEVfc3ZuRU4zVlpkNEc0VFNHZlo2d1c1LVlvSjJxZkdxeGVqeVZWdThqeDFyazFWRk52NERXaDd4amlTZ2I5d3dNTWVWVW9pSXFMZUN2NTZzUW4ycTRUdUpmdDNIVGR2UXhBSldHQWtGbDBFVUJKT0R2aGZrWGtSTWtjbmk5RVdiZVU0NWYwUThhQ1NmeG84anBzNE80endUMUxSQlVTVE5ZekN3bjhrTFdYR2FkaGo1aHdDNW9XNjlzUW5wYmpEY2JWR0dCSkdhNUtRREJpNmRVNzFoUTY3cThncUZ1UHhOaXJCcFNleTg0VWxtMS1PVjBzVXN4dnRwaVYxWFFvUVJrcHRVNnNBMFJaMTE2c25JT0gxR2piWm9paTB6M2hJbUltcmRPeG1ReHhYcC1nTWhsc2txcDZRVGtSWFdPZ0lyYWJ0UkNvV2pRc3JZb1EyZFNiRzBBODNB","email":"dominique.domet-de-mont@hpe.com"}}}'
sshKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDD7NHyHQT3pfG6yfpmQFSBjYe0x7t3qosl0sd880GHDbOkEZy9q5qMxYkQS41QCNzbx6RLrfz5eQawyWx0ADfY/YHaCKrjtFjd1hsP/svOBycJcOscGRjgmHt5ONDxqQGNgIpPOk/HOZn5oJEeJ8Bmk8hFdrsfl5m5f3IHg29jXmfL6bjaGGuWhD1xTKQEAk12DzObqvngalTO5+JPNoxSn2M7bYKZykP+vWQICyHTc8IRnwExyEmI4wEONOrMh13S2AdDpP9aoVCoTk+1Q8sJCmjO49g/uJlusfVTiVTBHTGycxWCcGG2uQ1BfwYJ/vp/8y9A/LVXmjYzYUIjBiBT Generated-by-Nova' 

EOF

fi  # If deployment, create one directory per OCP cluster, and drop install-config files

# For all instance names, deploy or undeploy
i=0 && while (( i <  ${#OCPBM[@]} )) ; do 
  $_deploy && deployOCPBM ${OCPBM[i]:-$OCPBM} "${OCPBMOFF[i]}" || undeployOCPBM ${OCPBM[i]:-$OCPBM}  
  ((i+=1))
done

exit 0