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

cat > openshift_project_automated-deployer.yaml << 'EOFILE'
apiVersion: v1
kind: Template
metadata:
  name: automated-deployer
  annotations:
    description: network functions and backing services for project automated-deployer
objects:
  - kind: Secret
    apiVersion: v1
    metadata:
      name: assistant-autotest
      namespace: automated-deployer
    type: Opaque
    data:
      ssh-privatekey: LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0KYjNCbGJuTnphQzFyWlhrdGRqRUFBQUFBQkc1dmJtVUFBQUFFYm05dVpRQUFBQUFBQUFBQkFBQUJGd0FBQUFkemMyZ3RjbgpOaEFBQUFBd0VBQVFBQUFRRUF6eG5CdlJRdUZoRnFzMjZqbHdMUlJUK0IveEJmMm1MOXlYMXdmSU43cTRFaVB1d3dKSk5CCnlkWnFQeC9hdGxmeGRkeXU0SHlqRXJySjBKV2NOczRFL1dTY2dkQSsxVnVTWlE2ZDY4ZHhYRkJrTGJkUlhjOWtuVUdPWkMKNVhycGt3QytZQnZHZ0poaWlZeW54SlN5YStGeW9XbDdqQWxwRmtTOFMrYWtlb1Y2TnIvc2NXM0EvY21rdlRVKzBYZkdzRApJcGIrSENYSmZUMU1seTI3cDJjdjJyN1FpeWhncEx6MEtYdHZrTTJEeWswZ1BaYzNxLzM2Y1c2REZqenlVT1FNRjBGaS8wCmdMWkI1aEc5QVBRbHZzcVZ2b292R0RGZHlkejQ0V0hseDVOOXFGeFJCZjZRenZsSzVQSGRtSmFDVlpLdytYMmtRNzZOQlgKdU9iSjBvREVYUUFBQTlnbXJaM2VKcTJkM2dBQUFBZHpjMmd0Y25OaEFBQUJBUURQR2NHOUZDNFdFV3F6YnFPWEF0RkZQNApIL0VGL2FZdjNKZlhCOGczdXJnU0krN0RBa2swSEoxbW8vSDlxMlYvRjEzSzdnZktNU3VzblFsWncyemdUOVpKeUIwRDdWClc1SmxEcDNyeDNGY1VHUXR0MUZkejJTZFFZNWtMbGV1bVRBTDVnRzhhQW1HS0pqS2ZFbExKcjRYS2hhWHVNQ1drV1JMeEwKNXFSNmhYbzJ2K3h4YmNEOXlhUzlOVDdSZDhhd01pbHY0Y0pjbDlQVXlYTGJ1blp5L2F2dENMS0dDa3ZQUXBlMitRellQSwpUU0E5bHplci9mcHhib01XUFBKUTVBd1hRV0wvU0F0a0htRWIwQTlDVyt5cFcraWk4WU1WM0ozUGpoWWVYSGszMm9YRkVGCi9wRE8rVXJrOGQyWWxvSlZrckQ1ZmFSRHZvMEZlNDVzblNnTVJkQUFBQUF3RUFBUUFBQVFFQW5rY2FHVTZkOWtHellaVHkKTTh4MGNjOGFvL3c0dGFnb08rREJvbmUrZ1pHOHdZZ3pOeERRRzlqaDlJSjgzaFVTTmpqRjhrMXZPRFpIWFVHcVZQeFpOZQp1NTdVQmhkU0I2SHYvdjA2M214bDJ1WW40VEVuWVplRklNNkNXKzMzSzJGTEhocThON1crd1U4ZFBSRkQxMDFERlhlUGM3ClFSZTNKbTBqOWdmejhaMVZTYTNDSmE2SGtYamhzdjc1VEcvSzFRc0xNVTlYSDd5TmVrRWhDVWYyeWNkUmtCbkRUcFlTQWwKNVp1d25GZW1TNzRDSGdCTWxwNmNLL3lhbUs0RFZwbi9kSzNzUkd2OHRsU2NGVFdHdEdsYko1czh3RjlndjBkdXdyM2RqUwpDU2EwZGpVVUpndmcxcXRWVzhnMDI2S2lsUDVNMnZvSTdwekNmYWQ1N0g5NmhRQUFBSUVBcEVMcXV5czNydWtnRUFQYnJ5CjV3Y20wMVp2L1JtcU5tYVR0SFRIN1JIRTRRV1N6Lzg1aFNraHFwN3NJVUlEVGoxL0EyQWJ6UmFRbmduMUd0S2dVbVlpODQKazUwZjBraWRDRmNXVVBSL0hKUmlOZ3J1SVQzWjBFako4dGRKek14WTRDSFQ2NzBOdjM4RkU0YXlEeVBQWUw1OStxb0kyagpEMU9VdmM4OEQvZTk4QUFBQ0JBT2c5TC8rdk95c2NhQzl3dG9VMTFiNU9lMzFzU3VpU2RWL0VHRDBINEtxY1Q0MkNJTGJkCmJNKzFxVThOVmZEY1VvMk1BMEFXdzFqS0ZUUVhyRjdCYXJySW10NTF3ekdXTXlFWS9yaTMwazZNaCthWFc2QmxSSmxxNlkKVk8yMXJtQ2poZCtFY0JHczF3QlJaMnNHSm5iaU1qNlRvZTR1aitibFNKWHJCTDM4UEhBQUFBZ1FEa1NpUzF3QVJidFBsMApHVzJvU3RIWmRJdXpVM0xWclduZWtoYUpLazZ1YVBsTHQ0Yk14Y1Ivc1pPVHA1SEN0N1UrbmR4UnRYUE0vQnBiZlN1WDhTCktzeTBwVERSZnFSdkJobEhuY1p3Q0J6clJma1IveFhsbjNPUEhhRHNnT1c1VVRxd2lHN0FZOFpybnZPZW0rN1JkenV5bmsKd1hraHc0dU9FKy9iZWlrdXV3QUFBQ0ZrYjIxcGJtbHhkV1ZBWjJodmMzUXlNQzVuY21VdWFIQmxZMjl5Y0M1dVpYUT0KLS0tLS1FTkQgT1BFTlNTSCBQUklWQVRFIEtFWS0tLS0tCg==
  - kind: BuildConfig
    apiVersion: build.openshift.io/v1
    metadata:
      name: "assistant-autotest"
    spec:
      source:
        contextDir: pipelines/autotest
        sourceSecret:
          name: assistant-autotest
        git:
          uri: git@github.hpe.com:CMS-5GCS/automated-deployer.git
      strategy:
        jenkinsPipelineStrategy:
          type: JenkinsPipeline
          env:
            - name: "_NAME"
              value: assistant
  - kind: ImageStream
    apiVersion: v1
    metadata:
      name: pipelines
      namespace: automated-deployer
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
      name: pipelines
    spec:
      tls:
        insecureEdgeTerminationPolicy: Redirect
        termination: edge
      to:
        kind: Service
        name: pipelines
  - kind: DeploymentConfig
    apiVersion: v1
    metadata:
      annotations:
        template.alpha.openshift.io/wait-for-ready: "true"
      name: pipelines
    spec:
      replicas: 1
      selector:
        name: pipelines
      strategy:
        type: Recreate
      template:
        metadata:
          labels:
            name: pipelines
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
              value: pipelines
            - name: JNLP_SERVICE_NAME
              value: pipelines-jnlp
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
              name: pipelines-data
          dnsPolicy: ClusterFirst
          restartPolicy: Always
          serviceAccountName: pipelines
          volumes:
          - emptyDir:
              medium: ""
            name: pipelines-data
  - kind: ServiceAccount
    apiVersion: v1
    metadata:
      annotations:
        serviceaccounts.openshift.io/oauth-redirectreference.jenkins: '{"kind":"OAuthRedirectReference","apiVersion":"v1","reference":{"kind":"Route","name":"pipelines"}}'
      name: pipelines
  - apiVersion: v1
    groupNames: null
    kind: RoleBinding
    metadata:
      name: pipelines_edit
    roleRef:
      name: edit
    subjects:
    - kind: ServiceAccount
      name: pipelines
  - kind: Service
    apiVersion: v1
    metadata:
      name: pipelines-jnlp
    spec:
      ports:
      - name: agent
        nodePort: 0
        port: 50000
        protocol: TCP
        targetPort: 50000
      selector:
        name: pipelines
      sessionAffinity: None
      type: ClusterIP
  - kind: Service
    apiVersion: v1
    metadata:
      annotations:
        service.alpha.openshift.io/dependencies: '[{"name": "pipelines-jnlp", "namespace": "", "kind": "Service"}]'
        service.openshift.io/infrastructure: "true"
      name: pipelines
    spec:
      ports:
      - name: web
        nodePort: 0
        port: 80
        protocol: TCP
        targetPort: 8080
      selector:
        name: pipelines
      sessionAffinity: None
      type: ClusterIP
  
EOFILE
# CustomApps deployment scripts
cat > openshift_project_automated-deployer.sh << 'EOFautomated-deployer'
#!/bin/bash
( [[ "$1" == "delete" ]] && oc delete all --selector app=assistant ) || ( [[ "$1" == "apply" ]] && oc create secret generic assistant-mad --type=kubernetes.io/ssh-auth --from-literal=ssh-privatekey='-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEAzxnBvRQuFhFqs26jlwLRRT+B/xBf2mL9yX1wfIN7q4EiPuwwJJNB
ydZqPx/atlfxddyu4HyjErrJ0JWcNs4E/WScgdA+1VuSZQ6d68dxXFBkLbdRXc9knUGOZC
5XrpkwC+YBvGgJhiiYynxJSya+FyoWl7jAlpFkS8S+akeoV6Nr/scW3A/cmkvTU+0XfGsD
Ipb+HCXJfT1Mly27p2cv2r7QiyhgpLz0KXtvkM2Dyk0gPZc3q/36cW6DFjzyUOQMF0Fi/0
gLZB5hG9APQlvsqVvoovGDFdydz44WHlx5N9qFxRBf6QzvlK5PHdmJaCVZKw+X2kQ76NBX
uObJ0oDEXQAAA9gmrZ3eJq2d3gAAAAdzc2gtcnNhAAABAQDPGcG9FC4WEWqzbqOXAtFFP4
H/EF/aYv3JfXB8g3urgSI+7DAkk0HJ1mo/H9q2V/F13K7gfKMSusnQlZw2zgT9ZJyB0D7V
W5JlDp3rx3FcUGQtt1Fdz2SdQY5kLleumTAL5gG8aAmGKJjKfElLJr4XKhaXuMCWkWRLxL
5qR6hXo2v+xxbcD9yaS9NT7Rd8awMilv4cJcl9PUyXLbunZy/avtCLKGCkvPQpe2+QzYPK
TSA9lzer/fpxboMWPPJQ5AwXQWL/SAtkHmEb0A9CW+ypW+ii8YMV3J3PjhYeXHk32oXFEF
/pDO+Urk8d2YloJVkrD5faRDvo0Fe45snSgMRdAAAAAwEAAQAAAQEAnkcaGU6d9kGzYZTy
M8x0cc8ao/w4tagoO+DBone+gZG8wYgzNxDQG9jh9IJ83hUSNjjF8k1vODZHXUGqVPxZNe
u57UBhdSB6Hv/v063mxl2uYn4TEnYZeFIM6CW+33K2FLHhq8N7W+wU8dPRFD101DFXePc7
QRe3Jm0j9gfz8Z1VSa3CJa6HkXjhsv75TG/K1QsLMU9XH7yNekEhCUf2ycdRkBnDTpYSAl
5ZuwnFemS74CHgBMlp6cK/yamK4DVpn/dK3sRGv8tlScFTWGtGlbJ5s8wF9gv0duwr3djS
CSa0djUUJgvg1qtVW8g026KilP5M2voI7pzCfad57H96hQAAAIEApELquys3rukgEAPbry
5wcm01Zv/RmqNmaTtHTH7RHE4QWSz/85hSkhqp7sIUIDTj1/A2AbzRaQngn1GtKgUmYi84
k50f0kidCFcWUPR/HJRiNgruIT3Z0EjJ8tdJzMxY4CHT670Nv38FE4ayDyPPYL59+qoI2j
D1OUvc88D/e98AAACBAOg9L/+vOyscaC9wtoU11b5Oe31sSuiSdV/EGD0H4KqcT42CILbd
bM+1qU8NVfDcUo2MA0AWw1jKFTQXrF7BarrImt51wzGWMyEY/ri30k6Mh+aXW6BlRJlq6Y
VO21rmCjhd+EcBGs1wBRZ2sGJnbiMj6Toe4uj+blSJXrBL38PHAAAAgQDkSiS1wARbtPl0
GW2oStHZdIuzU3LVrWnekhaJKk6uaPlLt4bMxcR/sZOTp5HCt7U+ndxRtXPM/BpbfSuX8S
Ksy0pTDRfqRvBhlHncZwCBzrRfkR/xXln3OPHaDsgOW5UTqwiG7AY8ZrnvOem+7Rdzuynk
wXkhw4uOE+/beikuuwAAACFkb21pbmlxdWVAZ2hvc3QyMC5ncmUuaHBlY29ycC5uZXQ=
-----END OPENSSH PRIVATE KEY-----
' && oc new-app --name assistant --source-secret=assistant-mad git@github.hpe.com:CMS-5GCS/automated-deployer.git && oc expose svc/assistant ) || exit 1
exit 0
EOFautomated-deployer
chmod a+x openshift_project_automated-deployer.sh

cat > openshift_project_openshift-marketplace.sh << 'EOFopenshift-marketplace'
#!/bin/bash
oc $1 -f - << EOFdometdemont
apiVersion: operators.coreos.com/v1
kind: OperatorSource
metadata:
  name: dometdemont-operators
  namespace: openshift-marketplace
spec:
  type: appregistry
  endpoint: https://quay.io/cnr
  registryNamespace: dometdemont
EOFdometdemont
[ $? = 0 ] || exit 1
exit 0
EOFopenshift-marketplace
chmod a+x openshift_project_openshift-marketplace.sh

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
oc_projects="automated-deployer openshift-marketplace"
for _project in $oc_projects ; do oc project $_project &>> $logfile || oc new-project $_project --display-name="Project $_project" --description='From HPE5g automated deployer 2021-03-04 Version 0.91 on: Thu Mar 04 2021 14:07:29 GMT+0100 (Central European Standard Time) Deploy an automated deployer as a custom app with a jenkins pipeline running autotests' &>> $logfile || _fail_ "Cannot find or create project $_project missing" ; done
if echo guess | oc login -u system:admin &>> $logfile ; then
_log_ "Listing nodes as system:admin"
oc get nodes -o wide &>> $logfile
oc login -u $oc_user &>> $logfile
else
 _warn_ "Resource(s) requiring special privileges might jeopardize the deployment:"
 _warn_ "- dometdemont:	section: OperatorSources	project: openshift-marketplace	type: operator-source"
fi
_log_ "Listing pods as $oc_user"
oc get pods -o wide  -n default  &>> $logfile
oc_image_projects=( )
oc_image_urls=( )
oc_images=( )
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

exit 0