// Build the installer as a shell script deploying the volumes, projects, and all OpenShift resources 

// This installer is a composition of 
// - a header : shellHeader, displaying the online help, parsing the arguments, setting the default values according to the deployed resources and providing logging utilities
// - a body: shellBody, checking pre-requisites, and setting additional utilities
// - the deployer: buildNetworkFunctions and hpe5gDeploymentScript, performing the deployment for all projects and types of resources, built using:
//   - hpe5gUntemplatedDeploymentsScript for non templated resources
//   - hpe5gHelmValues for Helm defined resources
//   - hpe5gNetworkFunctions for native OpenShift resources deployed by an application template
// - the deliverable: outputInstallerShell delivering the installer to the user

// OpenShift 3.x cluster deployment is based on an Ansible inventory built by buildInventory

// Two targets supported: 
// - oc: if the installer has to rely on the OpenShift CLI
// - curl: if the installer has to rely on the OpenShift REST API
// Prerequisites depend on the target: oc/curl

function shellBody(target){  
var result=`
# Prerequisites:`;
switch(target){
case 'oc': result+=`
# - OpenShift command line interface installed (oc)
if ! which oc  > /dev/null ; then  echo Please install oc utility to submit OpenShift requests ; exit 1 ; fi
# - current user logged in the target OpenShift cluster: oc login -u <user> -p <password>`; break;
case 'curl': result+=`
# - curl and jq utilities installed
PATH=$PATH:.
if ! which jq  > /dev/null ; then  echo Please install jq utility to inspect OpenShift REST API responses ; exit 1 ; fi
if ! which curl  > /dev/null ; then  echo Please install curl utility to submit OpenShift REST API requests ; exit 1 ; fi
# - network configured to reach all the targeted OpenShift clusters`; break;
default: result+= 'unsupported'; break;
}
result+=`

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
	local _cmdDescription="$\{2:-$_cmd}"
	local _timeout=$\{3:-60}
	local _retryPeriod=$\{4:-10}
	
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
`;
return result;};

function hpe5gDeploymentScript(warningMessage){
var _shellTemplate=`
if $_deploy ; then 
	_ocAction="apply"
	_helmAction() { helm upgrade --install $_HPE5G_name $_HPE5G_template --values _tmp_$_helmValues $_HPE5G_options; }
else
	_helmAction() { helm delete $_HPE5G_name ; }
	_ocAction="delete"
fi

# checking user logged in
oc_user=$(oc whoami)
test -n "$oc_user" && [ "$oc_user" != "system:admin" ] || _fail_ "Current user is $\{oc_user:-unknown}: please log as user: oc login -u user"
_log_ "$_displayedAction CMS5G Core Stack as user $oc_user"
_log_ "Checking projects"
oc_projects="~PROJECTS~"
for _project in $oc_projects ; do if [[ "$_project" =~ ^openshift.* ]] ; then _newproject_prefix="adm" ; else _newproject_prefix="" ; fi ; oc project $_project &>> $logfile || oc $_newproject_prefix new-project $_project --display-name="Project $_project" --description='~PROJECT_DESCRIPTION~' &>> $logfile || _fail_ "Cannot find or create project $_project missing" ; done
if echo guess | oc login -u system:admin &>> $logfile ; then
_log_ "Listing nodes as system:admin"
oc get nodes -o wide &>> $logfile
oc login -u $oc_user &>> $logfile
`;
if(warningMessage){
	_shellTemplate+="else";
	warningMessage.split("\n").forEach(function(line){_shellTemplate+='\n _warn_ "'+line+'"';});
}
_shellTemplate+=
`
fi
_log_ "Listing pods as $oc_user"
oc get pods -o wide  -n default  &>> $logfile
oc_image_projects=(~IMAGES_INSECURE_PROJECTS~)
oc_image_urls=(~IMAGES_INSECURE_URLS~)
oc_images=(~IMAGES_INSECURE~)
[[ $\{#oc_images[@]} != 0 ]] && _log_ "Populating the docker registry with services images: pull, tag and push"
  for _iImage in $\{!oc_images[@]} ; do
    sudo docker login -u $(oc whoami) -p $(oc whoami -t) docker-registry.default.svc:5000 &>> $logfile || _fail_ "Cannot connect to the internal docker registry as user $oc_user"
    sudo docker pull $\{oc_image_urls[$_iImage]}/$\{oc_images[$_iImage]} || _fail_ "Cannot pull $\{oc_image_urls[$_iImage]}/$\{oc_images[$_iImage]}"
    sudo docker tag $\{oc_image_urls[$_iImage]}/$\{oc_images[$_iImage]} docker-registry.default.svc:5000/$\{oc_image_projects[$_iImage]}/$\{oc_images[$_iImage]} || _fail_ "Cannot tag $\{oc_image_urls[$_iImage]}/$\{oc_images[$_iImage]}"
	sudo docker push docker-registry.default.svc:5000/$\{oc_image_projects[$_iImage]}/$\{oc_images[$_iImage]} || _fail_ "Cannot push docker-registry.default.svc:5000/$\{oc_image_projects[$_iImage]}/$\{oc_images[$_iImage]}"
  done
if `+Misc.getValue('anyuid')+` && echo guess | oc login -u system:admin &>> $logfile ; then
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
	for _helmValues in $(ls openshift_helm_$\{_project}_*.yaml 2> /dev/null) ; do eval $(head -1 $_helmValues) && _log_ "$_displayedAction $_HPE5G_name with chart $_HPE5G_template $_HPE5G_options on project $_project" && tail -n +2 $_helmValues > _tmp_$_helmValues && _helmAction &>> $logfile && rm -f $_helmValues _tmp_$_helmValues &>> $logfile || _fail_ "$_displayedAction Helm instance on project $_project" ; done
	# Undeployment: wait for pods termination  
	while [[ "$_ocAction" == "delete" ]] && _log_ "Waiting 30s for terminating pods on project $_project" && sleep 30 && oc get pods 2> /dev/null | grep -e Terminating &>> $logfile ; do : ; done
	# If undeployment, indulge 5 seconds to stabilize, then delete the project if no pods, otherwise log a status
	[[ "$_ocAction" == "delete" ]] && sleep 5s && test -n "$(oc get pods --namespace $_project 2>&1 >/dev/null)" && _log_ "No remaining pods in project $_project: deleting" && oc delete project $_project &>> $logfile || oc get all --namespace $_project &>> $logfile 
done
oc login -u $oc_user &>> $logfile || _fail_ "Cannot log as $oc_user"
_log_ "$_displayedAction completed: check $logfile"
`;
return _shellTemplate
	.replace(/~PROJECT_DESCRIPTION~/g,"From HPE5g automated deployer "+document.getElementById("vnfDescriptorWizardVersion").innerHTML+" on: "+Date()+" "+document.getElementById("quickDescription").value)
	.replace(/~PROJECTS~/g,hpe5gResources.projects.join(' '))	// Resolve the list of projects
	.replace(/~IMAGES_INSECURE_PROJECTS~/g,hpe5gResources.openshiftFunctions.map(function(e){if(e.insecureURL())return e.project;}).join(' '))	// Resolve the list of projects per image
	.replace(/~IMAGES_INSECURE_URLS~/g,hpe5gResources.openshiftFunctions.map(function(e){if(e.insecureURL())return e.URL;}).join(' '))	// Resolve the list of URLs per image
	.replace(/~IMAGES_INSECURE~/g,hpe5gResources.openshiftFunctions.map(function(e){if(e.insecureURL())return e.image+':'+e.tag;}).join(' '))	// Resolve the list of insecure images
;}

// Return the untemplated deployment scripts, one per project
// File naming convention for custom apps scripts: openshift_project_<project>.sh
function hpe5gUntemplatedDeploymentsScript(){
	var result="\n# CustomApps deployment scripts";
	Object.keys(hpe5gResources.untemplatedDeployments).forEach(function(project){
		result+="\ncat > openshift_project_"+project+".sh << 'EOF"+project+"'";
		result+="\n#!/bin/bash";
		result+="\n"+hpe5gResources.untemplatedDeployments[project].join(" && ")+" || exit 1";
		result+="\nexit 0";
		result+="\nEOF"+project;
		result+="\nchmod a+x openshift_project_"+project+".sh\n";
	});
	return result;
}

// Return the Helm values files, one per helm instance: header and footer open and close the template, which is idented with tab
function hpe5gHelmValues(header, footer, tab){
	var result="";
	hpe5gResources.openshiftFunctions.forEach(function(networkFunction){
		if(networkFunction.helmChartValues == undefined)return;
		var helmValues="\n"+networkFunction.helmChartValues.content;
		if(header != undefined)result+=header(networkFunction.project, networkFunction.name, networkFunction.helmChart, networkFunction.helmChartOptions);
		if(tab != undefined)helmValues=helmValues.replace(/\n/g, "\n"+tab);	// indentation of objects compared to the project header
		result+=helmValues;
		if(footer != undefined)result+=footer(networkFunction.project, networkFunction.name);
	});
	return result;
}

// Return the OpenShift resources templates, one per project: header and footer open and close the template, which is idented with tab
// If singleProject is provided, returns only the template for this project
function hpe5gNetworkFunctions(header, footer, tab, singleProject){
	var templateHeader=
`
apiVersion: template.openshift.io/v1
kind: Template
metadata:
  name: ~PROJECT~
  annotations:
    description: '`+document.getElementById("quickDescription").value+`'
objects:`;
	var result="";
	hpe5gResources.projects.forEach(function(project){
		if(singleProject && project != singleProject)return;
		// List of NetworkFunctions deployed on openshift 
		// Replace in the provided template:
		// - name, image, project, volume and replicas with the actual values for this function
		// - dependencies names with the actual name, defined in the template as ~<requirement>_NAME~
		var _header=templateHeader;
		hpe5gResources.openshiftFunctions.forEach(function(networkFunction){
		var deployment='';
		if(networkFunction.project != project)return;
		if(hpe5gResources.defaults[networkFunction.type] && hpe5gResources.defaults[networkFunction.type]['template'])deployment+=hpe5gResources.defaults[networkFunction.type]['template']
		if(networkFunction.pipeline)deployment+=networkFunction.pipeline;
		if(!deployment)return;
		if(header && _header.length>0)result+=header(project);
		deployment=_header+deployment.replace(/\n/g, "\n  ");	// indentation of objects compared to the header
		if(tab != undefined)deployment=deployment.replace(/\n/g, "\n"+tab);	// indentation of objects compared to the project header
		_header=''; // only one header per project
		deployment=deployment
		.replace(/~NAME~/g,networkFunction.name)
		.replace(/~PROJECT~/g,networkFunction.project)
		.replace(/~IMAGE~/g,networkFunction.image)
		.replace(/~IMAGE_STREAM~/g,networkFunction.imageStream())
		.replace(/~REPLICAS~/g,networkFunction.replicas);
		if(networkFunction.storage){
			deployment=deployment
			.replace(/~STORAGE~/g,networkFunction.storage)
			.replace(/~VOLUME~/g,networkFunction.volume)
			.replace(/~PERSISTENCE_START~|~PERSISTENCE_END~/mg,'');
		}else{
			deployment=deployment.replace(/~PERSISTENCE_START~[\s\S]*?~PERSISTENCE_END~/mg,'');
		}
		
		if(hpe5gResources.depends && hpe5gResources.depends[networkFunction.type])hpe5gResources.depends[networkFunction.type].forEach(function(requirement){
			// The required type can be a simple string or a table of aliases, the first element being the actual required type
			var actualRequirement=requirement;
			if(typeof requirement != "string")actualRequirement=requirement[0];
			var ereg=new RegExp("~"+actualRequirement+"_NAME~","g");
			deployment=deployment.replace(ereg, networkFunction.resolve(requirement));
			});
		result+=deployment;
		});
		if(footer != undefined && _header.length==0)result+=footer(project);
	});
	return result;
}

// ===========================
// OpenShift ansible inventory build
// ===========================
// If no target is specified, publish the inventory in the user output area (or errors)
// Otherwise, just return the same to the caller
function buildInventory(target, engine){
	var quickDescription = document.getElementById("quickDescription");
	quickDescription.setAttribute("value", quickDescription.value);
	document.title = "CMS5G Core Stack "+ quickDescription.value;
	
	consistency.init();
	var warnings = "";
	vnfPorts = new Array();
	
	var openshift = "# -------------------------------------------------------------";
	openshift += "\n# "+quickDescription.value;
	openshift += "\n# CMS HPE 5g openshift inventory generated by the builder "+document.getElementById("vnfDescriptorWizardVersion").innerHTML;
	openshift += "\n# Build date: "+Date();
	openshift += "\n# -------------------------------------------------------------";
	openshift += "\n";
	openshift += "\nansible_become=yes";
	// Immutable part from the environment
	if(target == 'openstack'){
	openshift += "\n# Openstack";
	openshift += "\nopenshift_cloudprovider_kind=openstack";
	openshift += "\nopenshift_cloudprovider_openstack_auth_url=\"{{ lookup('env','OS_AUTH_URL') }}\"";
	openshift += "\nopenshift_cloudprovider_openstack_username=\"{{ lookup('env','OS_USERNAME') }}\"";
	openshift += "\nopenshift_cloudprovider_openstack_password=\"{{ lookup('env','OS_PASSWORD') }}\"";
	openshift += "\nopenshift_cloudprovider_openstack_tenant_id=\"{{ lookup('env','OS_PROJECT_ID') }}\"";
	openshift += "\nopenshift_cloudprovider_openstack_tenant_name=\"{{ lookup('env','OS_PROJECT_NAME') }}\"";
	openshift += "\n# Global Proxy Configuration";
	openshift += "\n# These options configure HTTP_PROXY, HTTPS_PROXY, and NOPROXY environment";
	openshift += "\n# variables for docker and master services.";
	openshift += "\nopenshift_http_proxy=\"{{ lookup('env','OPENSHIFT_HTTP_PROXY') }}\"";
	openshift += "\nopenshift_https_proxy=\"{{ lookup('env','OPENSHIFT_HTTPS_PROXY') }}\"";
	openshift += "\nopenshift_no_proxy='.localdomain'";
	openshift += "\n# Most environments do not require a proxy between OpenShift masters, nodes, and";
	openshift += "\n# etcd hosts. So automatically add those host names to the openshift_no_proxy list.";
	openshift += "\n# If all of your hosts share a common domain you may wish to disable this and";
	openshift += "\n# specify that domain above.";
	openshift += "\nopenshift_generate_no_proxy_hosts=True";
	openshift += "\nansible_ssh_user=\"{{ lookup('env','CLOUD_DEFAULT_USER') }}\"";
	}

	hpe5gResources.init();
	vnfResources.forEach(function(e,i,t){
		openshift += e.build(target, engine);
		warnings += e.check;
	});
	warnings += hpe5gResources.compile();
	warnings += consistency.check();
	openshift += "\n"
	if(warnings != ""){
		userOutput(warnings);
		return "";
	}

	if(target == undefined){
		userOutput(openshift);	
		
		var blobDesc = new Blob([openshift], {type: "text/plain;charset=utf-8"});
		var a = document.createElement('a');
		a.href = window.URL.createObjectURL(blobDesc);
	    a.download = "hpe5g.properties";
	    document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
	return openshift;
}


//=================================
//OpenShift network functions build
//=================================
// Return a shell script deploying resources on OpenShift
// Two options: oc (openshift cli) or curl (openshift rest api) based
// The curl options support multiple targeted clusters, defined in Clusters.targeted array
// If Clusters.targeted is empty, the oc options is used ; otherwise oc and helm are invoked on the single target cluster defined in the user context
function buildNetworkFunctions(){
	hpe5gResources.init();

	// Check the hpe5gResources sections + Builds and Clusters (or get the errors)
	var check = '';
	['Builds', 'CustomApps', 'Clusters'].concat(hpe5gResources.sections).forEach(function(section){
		window[section].build();
		check += window[section].check;
	});
	check += hpe5gResources.compile();
	if(check){userOutput(check); return '';}
	
  if(!hpe5gResources.projects.length)return '';
  
	var shell='';
	var warningMessage='';
	
	if(hpe5gResources.adminList.length > 0){
		warningMessage='Resource(s) requiring special privileges might jeopardize the deployment:'+hpe5gResources.adminList;
		if(!Misc.getValue('headless') && !confirm(warningMessage)){userOutput(warningMessage); return '';}
	}

	if(Clusters.targeted == undefined || Clusters.targeted.length == 0){
      function catHeader(project){return `
# File naming convention for Network functions: openshift_project_<project>.yaml
_templateYaml=openshift_project_`+project+`.yaml
cat > $_templateYaml << 'EOFILE'`
  };
    	function catHelmValuesHeader(project, name, template, options){
        return `
# File naming convention for Helm instances: openshift_helm_<project>_<name>.yaml and a first line setting the context as bash variables: _HPE5G_name= _HPE5G_template= _HPE5G_options=
_templateYaml=openshift_helm_`+project+`_`+name+`.yaml
cat > $_templateYaml << 'EOFILE'
_HPE5G_name=`+name+` _HPE5G_template=`+template+` _HPE5G_options='`+options+`'`
    	}
      function catFooter(project){return `
EOFILE
# Cluster specific variables resolution:
sed -i "s/~LOCAL_STORAGE_NODES~/$_localStorageNodes/" $_templateYaml`
      };
    	
    	shell+=shellBody('oc');
    	shell+=hpe5gNetworkFunctions(catHeader, catFooter);
    	shell+=hpe5gHelmValues(catHelmValuesHeader, catFooter);
		  shell+=hpe5gUntemplatedDeploymentsScript();
    	shell+=hpe5gDeploymentScript(warningMessage);
	}else{
		shell+=shellBody('curl');
		
		if(hpe5gHelmValues().length > 0){check+='\nHelm based deployments not supported on OpenShift REST API, only on CLI' ;}
		if(Object.keys(hpe5gResources.untemplatedDeployments).length > 0){check+='\nCustom Apps deployments not supported on OpenShift REST API, only on CLI' ;}
		if(check){userOutput(check); return '';}

		Clusters.targeted.forEach(function(cluster){
			hpe5gResources.projects.forEach(function(project){
				// Get the resources to deploy as a Json string
				var jsonPayload=undefined;
				try{
					jsonPayload=JSON.stringify(YAML.parse(hpe5gNetworkFunctions(undefined,undefined,undefined,project)));
				}catch(e){check+="Parsing exception received on project "+project+": "+e;  return;}
				// Create the project if it does not exist or fail in case of deletion
				shell+='\n_log_ "Checking project '+project+' on cluster '+cluster.name+'"';
				shell+='\nuntil curl -f -v -k -X GET -H "Authorization: Bearer '+cluster.token+'" -H "Accept: application/json" -H "Content-Type: application/json" https://'+cluster.endpoint+'/apis/project.openshift.io/v1/projects/'+project+'  &>> $logfile ; do ';
				shell+='\n$_deploy || _fail_ "Cannot check if project '+project+' exists on cluster '+cluster.name+'"';
				shell+='\n_log_ "Creating project '+project+' on cluster '+cluster.name+'" && curl -f -v -k -X POST -d @- -H "Authorization: Bearer '+cluster.token+'" -H "Accept: application/json" -H "Content-Type: application/json" https://'+cluster.endpoint+'/apis/project.openshift.io/v1/projectrequests  &>> $logfile <<HPE_EOF';
				shell+=`
{
  "apiVersion": "project.openshift.io/v1",
  "kind": "ProjectRequest",
  "metadata": {
    "name": "`+project+`"
  },
  "displayName": "`+document.getElementById("quickDescription").value+`",
  "description": "From HPE5g automated deployer `+document.getElementById("vnfDescriptorWizardVersion").innerHTML+" on: "+Date()+`"
}
HPE_EOF`;
				shell+='\nif [ $? != 0 ] ; then _fail_ "Cannot create project '+project+' on cluster '+cluster.name+'" ; fi';
				shell+='\nsleep 2 ; done';

                // Create the REST API secret for this project if it does not exist
                var secretName=project+'-restapi';
                shell+='\n_log_ "Checking secret '+secretName+' for project '+project+' on cluster '+cluster.name+'"';
                shell+='\nuntil curl -f -v -k -X GET -H "Authorization: Bearer '+cluster.token+'" -H "Accept: application/json" -H "Content-Type: application/json" https://'+cluster.endpoint+'/api/v1/namespaces/'+project+'/secrets/'+secretName+' &>> $logfile ; do ';
                shell+='\n_log_ "Creating secret '+secretName+' for project '+project+' on cluster '+cluster.name+'" && curl -f -v -k -X POST -d @- -H "Authorization: Bearer '+cluster.token+'" -H "Accept: application/json" -H "Content-Type: application/json" https://'+cluster.endpoint+'/api/v1/namespaces/'+project+'/secrets &>> $logfile <<HPE_EOF';
                shell+=`
{
  "kind": "Secret",
  "apiVersion": "v1",
  "metadata": {
    "name": "`+secretName+`"
  },
  "stringData": {
    "NAME": "`+secretName+`"
  }
}
HPE_EOF`;
                shell+='\nif [ $? != 0 ] ; then _fail_ "Cannot create secret '+secretName+' for project '+project+' on cluster '+cluster.name+'" ; fi';
                shell+='\nsleep 2 ; done';
                
                // Deploy/update/undeploy the template instance: use the first resource name in this project as the template name to allow subsequent deployment in the same project without duplicating the template name
                var templateInstanceName=hpe5gResources.openshiftFunctions.find(function(f){return f.project == project;}).name;
                shell+='\n_log_ "$_displayedAction resources for project '+project+' on cluster '+cluster.name+'"';
                shell+='\n_httpVerb=POST _httpTarget=""';
                shell+='\nif curl -f -v -k -X GET -H "Authorization: Bearer '+cluster.token+'" -H "Accept: application/json" -H "Content-Type: application/json" https://'+cluster.endpoint+'/apis/template.openshift.io/v1/namespaces/'+project+'/templateinstances/'+templateInstanceName+' &>> $logfile ; then _httpVerb=PUT; _httpTarget=/'+templateInstanceName+'; fi';
                shell+='\nif $_deploy ; then curl -f -v -k -X $_httpVerb -d @- -H "Authorization: Bearer '+cluster.token+'" -H "Accept: application/json" -H "Content-Type: application/json" https://'+cluster.endpoint+'/apis/template.openshift.io/v1/namespaces/'+project+"/templateinstances$_httpTarget &>> $logfile <<'HPE_EOF'";
                shell+=`
{
  "kind": "TemplateInstance",
  "apiVersion": "template.openshift.io/v1",
  "metadata": {
    "name": "`+templateInstanceName+`"
  },
  "spec": {
    "secret": {
      "name": "`+secretName+`"
    },
    "template":`+jsonPayload+`
  }
}
HPE_EOF`;
				shell+='\nif [ $? != 0 ] ; then _fail_ "$_displayedAction resources for project '+project+' on cluster '+cluster.name+'" ; fi';
				
				shell+='\n# Poll the TemplateInstance until the condition types report status True at a 15 seconds period limited to two minute.';
				shell+='\n_cmd_with_retry "_getTemplateInstanceStatus '+cluster.token+' '+cluster.endpoint+' '+project+' '+templateInstanceName+'" Processing 120 15';
				shell+='\n# If the TemplateInstance status is true, but not Ready, fail with the error message; otherwise report success';
				shell+='\nif [ $? == 0 ] && [[ "$(_getTemplateInstanceStatus '+cluster.token+' '+cluster.endpoint+' '+project+' '+templateInstanceName+')" != \'"Ready"\' ]] ; then _fail_ $(_getTemplateInstanceMessage '+cluster.token+' '+cluster.endpoint+' '+project+' '+templateInstanceName+') ; fi';
				shell+='\nelse curl -f -v -k -X DELETE -H "Authorization: Bearer '+cluster.token+'" -H "Accept: application/json" -H "Content-Type: application/json" https://'+cluster.endpoint+'/apis/template.openshift.io/v1/namespaces/'+project+'/templateinstances/'+templateInstanceName+' &>> $logfile';
				shell+='\nif [ $? != 0 ] ; then _fail_ "$_displayedAction resources for project '+project+' on cluster '+cluster.name+'" ; fi';
				shell+='\nfi';
				shell+='\n_log_ "$_displayedAction resources for project '+project+' successfully completed on cluster '+cluster.name+'"';

			});
		});
	}
	if(check.length != 0){userOutput(check); return '';}
	return shell;
}

// Build a shell script named hpe5g.sh and drop it in the Download directory
function shellHeader(){
var shell=`#! /bin/bash
_usage() {
    echo "
HPE 5G resources automated deployer: `+document.getElementById("vnfDescriptorWizardVersion").innerHTML+`
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
$0 -n \\"ocp1 ocp2\\" -f \\"flavor1 flavor2\\" -x ext-net
"
}

# Default parameters
default_stack=`+Misc.getValue('default_project')+`
oc_stack=$default_stack
oc_network=`+Misc.getValue('default_openstack_network_root')+`
OS_env=`+Misc.getValue('default_openstack_env')+`
_deploy=$([[ "`+Misc.getValue('default_action')+`" != "undeploy" ]] && echo true || echo false)
_displayedAction=$($_deploy && echo Deploying || echo Undeploying)
state=$($_deploy && echo present || echo absent)
_headless=`+Misc.getValue('headless')+`
_preview=

_defaultName=$default_stack
unset OCP FIPAPI FIPAPP
ETCHOSTS=true
EXTNET=`+Misc.getValue('extnet')+`
DOMAIN=localdomain
WORKERS=3
MASTERS=3
FLAVOR=v4.m16.d25
FLAVORWORKER=$FLAVOR
EXTDNS=8.8.8.8
NBVOLUMES=10
`; 

if(OpenShiftNodes.instances && OpenShiftNodes.instances.name.length)shell+=`
_defaultName=(`+OpenShiftNodes.instances.name.join(' ')+`)
OCP=(`+OpenShiftNodes.instances.name.join(' ')+`)
ETCHOSTS=(`+OpenShiftNodes.instances.etchosts.join(' ')+`)
EXTNET=(`+OpenShiftNodes.instances.extnet.join(' ')+`)
OS_env=(`+OpenShiftNodes.instances.osenv.join(' ')+`)
DOMAIN=(`+OpenShiftNodes.instances.domain.join(' ')+`)
FIPAPI=(`+OpenShiftNodes.instances.fipapi.join(' ')+`)
FIPAPP=(`+OpenShiftNodes.instances.fipapp.join(' ')+`)
WORKERS=(`+OpenShiftNodes.instances.workers.join(' ')+`)
MASTERS=(`+OpenShiftNodes.instances.masters.join(' ')+`)
FLAVOR=(`+OpenShiftNodes.instances.flavor.join(' ')+`)
FLAVORWORKER=(`+OpenShiftNodes.instances.flavorWorker.join(' ')+`)
EXTDNS=(`+OpenShiftNodes.instances.extdns.join(' ')+`)
NBVOLUMES=(`+OpenShiftNodes.instances.nbVolumes.join(' ')+`)`;

if(BaremetalNodes.clusters && Object.keys(BaremetalNodes.clusters).length)shell+=`
_defaultName=(`+Object.keys(BaremetalNodes.clusters).join(' ')+`)
OCPBM=(`+Object.keys(BaremetalNodes.clusters).join(' ')+`)
OCPBMNODES=('`+Object.keys(BaremetalNodes.clusters).map(function(ocp){  return BaremetalNodes.clusters[ocp].localStorageNode  }).join("' '")+`')
OCPBMOFF=("`+Object.keys(BaremetalNodes.clusters).map(function(ocp){  return BaremetalNodes.clusters[ocp].powerOff  }).join('" "')+`")`;

shell+=`
RHELSECRET='`+Misc.getValue('rhel_pullsecret')+`'

while [[ "$#" -gt 0 ]]; do case $1 in
  -d|--deploy) _deploy=true; _displayedAction="Deploying"; state=present ; OCP=($\{2:-$\{OCP[@]:-$_defaultName}}) ; shift;;
  -u|--undeploy|--destroy) _deploy=false ; _displayedAction="Undeploying"; state=absent ; OCP=($\{2:-$\{OCP[@]:-$_defaultName}}); shift;;
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
  if (( $\{#_cut} > $_max )) ; then
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
  local RED='\\033[0;31m'
  local NC='\\033[0m' # No Color
  _log_ "$\{RED}WARNING$\{NC}: $*"
}

_fail_() {
  _log_ "FATAL ERROR: $*.  Now exiting... Check $logfile"
  test -f $logfile && echo Last lines of $logfile >&2 && tail $logfile >&2
  exit 1
}

# Clean log file
> $logfile
`;
  return shell;
}

function outputInstallerShell(){
	var shellOpenStack='';
	var shellOpenShift='';
  var shellTerraform='';
  var shellBaremetal='';
	Nodes.cloudNodes=undefined;

  // OCP4 clusters if any
  if(!OpenShiftNodes.isEmpty()){
    shellTerraform=buildOCP4Deployer();
    if(!shellTerraform)return false;
  }
  if(!BaremetalNodes.isEmpty()){
    shellBaremetal=buildOCP4BaremetalDeployer();
    if(!shellBaremetal)return false;
  }
  // OpenStack resources if any
  if(!Nodes.isEmpty()){
    shellOpenStack=buildHeatStackDeployer();
    if(!shellOpenStack)return false;
  }

	// Add OpenShift resources except if an OpenShift cluster was deployed before: the OCP deployment includes the resources deployment
  if(OpenShiftNodes.isEmpty() && BaremetalNodes.isEmpty() && (!Nodes.cloudNodes || !Nodes.cloudNodes.some(function(e){return e.isEms;}))){
		shellOpenShift=buildNetworkFunctions();
		if(hpe5gResources.projects.length && !shellOpenShift)return false;
	}
	var shell=shellHeader()+shellTerraform+shellBaremetal+shellOpenStack+shellOpenShift+"\nexit 0";
	
	// Show to the user and save to hpe5g.sh
    userOutput(shell);
	// Stop there if headless, ie no user interface
	if(Misc.getValue('headless'))return true;
	
	var blobShell = new Blob([shell], {type: "text/plain;charset=utf-8"});
	var a = document.createElement('a');
	a.href = window.URL.createObjectURL(blobShell);
    a.download = "hpe5g.sh";
    document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	
	return true;
}
