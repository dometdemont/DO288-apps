//===========================
// Builds
//===========================
var Builds = new vnfResource("Builds", [
	{name:'Type', type:'choice', width: '100px', choices:['pipeline','custom-app']}, 
	{name:'Name', type:'text', width:'100px'},
	{name:'GIT URL', type:'text', width:'400px'},
	{name:'directory', type:'text', width:'200px'},
	{name:'branch', type:'text', width:'120px'},
	{name:'sshKey', type:'file', width:'120px'}
	]
	);

Builds.help = function(){return `OpenShift builds:
The OpenShift builds defined in this section rely on custom git projects as:
- GIT URL: github project URL, eg: git@github.hpe.com:CMS-5GCS/automated-deployer.git         
- directory: (optional) directory in the github project hosting the code     
- branch: (optional) git branch to use, eg: master        
- sshKey: (optional) private ssh key enabling access the git repository                
Two types of OpenShift builds can be defined:        
- jenkins pipelines available for continuous integration of hpe5g resources:        
    The Jenkins environment variable _NAME is made available to the pipeline ; it is set to the name of the resource to which this pipeline is attached.         
    This is useful to dynamically discover OpenShift resources like routes, services ,etc.        
    Example of route retrieval in a Jenkins stage: openshift.selector( 'route/\${_NAME}').object().spec.host         
    Three examples are provided by https://github.hpe.com/CMS-5GCS/automated-deployer/pipelines :            
    - get_oc_resources: display the OpenShift current project and existing resources        
    - manual_approval: expect the end  user to explicitly approve the build        
    - autotest: non regression tests for the automated deployer itself    
- custom applications available as dynamic types in the CustomApps section for instanciation.        
`
}

//================================================================
// Template fragment defining a build config 
// either as a Jenkins pipeline or as a custom app or any un templated deployment
//================================================================
Builds.makeTemplate = function(name, type, uri, dir, branch, sshKey){
if(!uri)return;
var result='';
switch(type){
	case 'pipeline':
if(sshKey.content)result+=`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-`+name+`
    namespace: ~PROJECT~
  type: Opaque
  data:
    ssh-privatekey: `+btoa(sshKey.content);
result+=`
- kind: BuildConfig
  apiVersion: build.openshift.io/v1
  metadata:
    name: "~NAME~-`+name+`"
  spec:
    source:`;
		if(dir)result+=`
      contextDir: `+dir;
		if(sshKey.content)result+=`
      sourceSecret:
        name: ~NAME~-`+name;
result+=`
      git:
        uri: `+uri;
if(branch)result+=`
        ref: `+branch;
result+=`
    strategy:
      jenkinsPipelineStrategy:
        type: JenkinsPipeline
        env:
          - name: "_NAME"
            value: ~NAME~`
;
	break;
	case 'custom-app':
		// Custom app deployment is not available as template, only from oc new-app CLI
		// Build a one line shell script invoking this command if the parameter 'apply' is received or the related deletion if a parameter 'delete' is received
		result+='( [[ "$1" == "delete" ]] && oc delete all --selector app=~NAME~ ) || ( [[ "$1" == "apply" ]]';
		if(sshKey.content)result+=" && oc create secret generic ~NAME~-"+name+" --type=kubernetes.io/ssh-auth --from-literal=ssh-privatekey='"+sshKey.content+"'";
		result+=' && oc new-app --name ~NAME~';
		if(sshKey.content)result+=' --source-secret=~NAME~-'+name;
		result+=' '+uri;
		if(branch)result+='#'+branch;
		if(dir)result+=' --context-dir '+dir;
		result+=' && oc expose svc/~NAME~ )';
	break;
	default:
    // Other deployments not available in template, only from oc CLI
    // Make sure the template exists
    if(!hpe5gResources.defaults[type] || !hpe5gResources.defaults[type]['template'])return;
    // Build a one line shell script invoking this command if the parameter 'apply' is received or the related deletion if a parameter 'delete' is received
    result+='oc $1 -f - << EOF'+name;
    result+=hpe5gResources.defaults[type]['template']
    result+='EOF'+name;
    result+='\n[ $? = 0 ]';
	break;
}
	
Builds.templates[type][name]=result;
};

Builds.getTemplate = function(type, name){
	if(!Builds.templates || !Builds.templates[type] || !Builds.templates[type][name])return '';
	return Builds.templates[type][name];
}
Builds.getNames = function(type){
	if(!Builds.templates || !Builds.templates[type])return [];
	return Object.keys(Builds.templates[type]);
}

Builds.templates=new Object;
Builds.build = function(target){
	var nameIndexes = Builds.nameIndexes;
	var result="";
	
	var table = document.getElementById("Builds");
	var rowCount = table.rows.length;
	Builds.templates['pipeline']=new Object;
	Builds.templates['custom-app']=new Object;
	Builds.check = checkDependency(Builds.search('Type', 'pipeline'), [IndirectServices.search('Type', 'jenkins')], "Builds section: ", "pipeline types require a jenkins IndirectService");
	
	for(var i=1; i < rowCount; i++){
		if(result==""){
			result += "\n# ------------------------------- #";
			result += "\n# Builds                          #";
			result += "\n# ------------------------------- #";
			};
		var row = table.rows[i];
		var type=Builds.getAndSetSelection(table.rows[i], nameIndexes, 'Type');
		var name=Builds.getAndSetValue(row, nameIndexes, 'Name', type+"-"+i);
		var gitURL=Builds.getAndSetValue(row, nameIndexes, 'GIT URL', 'https://github.com/dometdemont/DO288-apps');
		var gitDirectory=Builds.getAndSetValue(row, nameIndexes, 'directory');
		var gitBranch=Builds.getAndSetValue(row, nameIndexes, 'branch');
		var sshKey=Builds.getFileObject(row, "sshKey");
		var check='';
		if(!type)check += "\nBuilds section: "+name+": type is required";
		if(!name)check += "\nBuilds section: "+type+" name is required";
		if(name.search(/[A-Z_]/g) >= 0){check += "\nBuilds section: "+name+" : upper case and underscore characters are not supported";}
		if(!gitURL)check += "\nBuilds section: "+type+" "+name+": GIT URL is required";
		if(!Builds.templates[type])check += "\nBuilds section: type "+type+" is not supported; expecting one of: "+Object.keys(Builds.templates).join();
		else if(Builds.templates[type][name])check += "\nBuilds section: "+type+" "+name+" is duplicated";
		Builds.check+=check;
		if(check)continue;
		
		result+="\n#- "+type+" "+name+" build from GIT "+gitURL+"/"+gitDirectory+" branch: "+(gitBranch?gitBranch:"master")+(sshKey.hasContent()?" sshKey: "+sshKey.content.trunc(50):'')
		Builds.makeTemplate(name, type, gitURL, gitDirectory, gitBranch, sshKey);
	}

	if(Builds.check != "")return Builds.check;
	return result;
};

//===========================
//CustomApps
//===========================
var CustomApps = new vnfResource("CustomApps", [
	{name:'Type', type:'choice', width: '140px', choices: function(){Builds.build(); return Builds.getNames('custom-app');}}, 
	{name:'Name', type:'text', width:'100px'},
	{name:'Project', type:'text', width:'60px'},
	{name:'Pipeline', type:'text', width:'100px'}
	]
);
CustomApps.help = function(){return `CustomApps instantiation from GIT using source to image feature:
PREREQUISITE: the Builds section defines the build source in GIT repository for each instantiable application type.
- Type: the type of the build to instantiate as defined by the Name attribute in the Builds section 
- Name: one word resource name for this application instance
- Project: the OpenShift project hosting this application instance
- Pipeline: create a Jenkins pipeline for this application from the Builds section definition
	
`;
}
CustomApps.build = function(target){
	var nameIndexes = CustomApps.nameIndexes;
	var result = "";
	CustomApps.check="";
	var table = document.getElementById(this.title);
	var rowCount = table.rows.length;

	for(var i=1; i < rowCount; i++){
		if(result==""){
			result += "\n"
			result += "\n# --------------------------------";
			result += "\n# CustomApps definition           ";
			result += "\n# -------------------------------- ";
			}
		var row = table.rows[i];
		var type=this.getAndSetSelection(table.rows[i], nameIndexes, 'Type');
		var template=Builds.getTemplate('custom-app', type);
		var name=this.getAndSetValue(row, nameIndexes, 'Name', type+"-"+i);
		var project=this.getAndSetValue(row, nameIndexes, 'Project',Misc.getValue('default_project'));
		if(!template){this.check += "\n"+this.title+": "+type+" is unknown in the Builds section as a custom-app"; continue;}
		var pipeline=this.getAndSetValue(row, nameIndexes, 'Pipeline');
		var pipelineTemplate=Builds.getTemplate('pipeline', pipeline);
		this.check += checkDependency(pipeline, [pipelineTemplate], this.title+" "+name+": pipeline "+pipeline, " is undefined in the Builds section");
		if(pipeline)hpe5gResources.openshiftFunctions.push(new openshiftFunction(type, name, undefined, undefined, project, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, pipelineTemplate));
		
		if(!hpe5gResources.untemplatedDeployments[project])hpe5gResources.untemplatedDeployments[project]=new Array();
		hpe5gResources.untemplatedDeployments[project].push(template.replace(/~NAME~/g,name));
		result+="\n#- "+name+": "+type+" on project: "+project;
	}
	
	if(this.check != "")return this.check;
	return result;
};
