//===========================
// HPE5G resources
//===========================
//Each resource should provide:
//- a type: to be listed in the nvfResource type member: nudsf-dr, ignite...
//- a set of default values defined in hpe5gResources.defaults[type] for: image, tag, template
//- a list of dependencies on other functions defined as a table in hpe5gResources.depends[type], eg nudsf type depends on ignite type
//- for types requiring admin privileges, a true boolean in hpe5gResources.admin[type] so that the user is aware an prevented from failing deployments
//The provided templates can use placeholders replaced at instantation time for:
//- name: ~NAME~
//- project: ~PROJECT~
//- image: ~IMAGE~
//- replicas: ~REPLICAS~
//- requirement on other function types: ~<type>_NAME~: eg ~ignite_NAME~ will be replaced by the ignite instance name in this project
// Resources are not directly instantiated from hpe5gResource but from a class inherited from hpe5gResource, to allow spliting resources in Network functions and other services
var hpe5gResource = function(title, columns, userFiles){
	vnfResource.call(this, title, columns, userFiles);
};
hpe5gResource.prototype = vnfResource.prototype;
hpe5gResource.prototype.constructor = hpe5gResource;


hpe5gResource.prototype.help = function(){return `Attributes:
- Type: the type of the resource to deploy
- Name: one word resource name for this instance
- Project: the OpenShift project hosting this resource instance
- URL, Image and tag: the docker image to use for this resource    
  Default valid values are provided when fields are left blank.
- insecure: check this box if this URL points to insecure registries    
  Images from insecure registries are pulled then pushed to the internal registry using docker, properly configured.        
  Otherwise, images are directly pulled by the OpenShift image stream from their original URL.
- Storage, Volume: the storage size with its unit (like 1Gi) and the OpenShift persistent volume used by this resource
- Replicas: number of replicas deployed for this instance.
- Dependencies: comma separated list of resources names resolving this function dependencies within this project.    
  If undefined, the first resource in the project providing the required type is used.
- Pipeline: create a Jenkins pipeline for this function from the Builds section definition
	
`;
}

hpe5gResource.prototype.build = function(target){
	var nameIndexes = this.nameIndexes;
	var result = "";
	this.check="";
	var table = document.getElementById(this.title);
	var rowCount = table.rows.length;

	for(var i=1; i < rowCount; i++){
		if(result==""){
			result += "\n"
			result += "\n# --------------------------------";
			result += "\n# "+this.title+" definition";
			result += "\n# -------------------------------- ";
			}
		var row = table.rows[i];
		var type=this.getAndSetSelection(table.rows[i], nameIndexes, 'Type');
		if(!hpe5gResources.types[this.title] || hpe5gResources.types[this.title].indexOf(type) < 0){this.check += "\n"+this.title+": "+type+" is unknown in the catalog"; continue;}
    var name=this.getAndSetValue(row, nameIndexes, 'Name', hpe5gResources.defaults[type]['Name']?hpe5gResources.defaults[type]['Name']:type+"-"+i);
		var project=this.getAndSetValue(row, nameIndexes, 'Project',hpe5gResources.defaults[type]['Project']?hpe5gResources.defaults[type]['Project']:Misc.getValue('default_project'));
		var URL=this.getAndSetValue(row, nameIndexes, 'URL',hpe5gResources.defaults[type]['URL']);
		var insecure=Nodes.getAndSetChecked(row, nameIndexes, 'insecure');
		var image=this.getAndSetValue(row, nameIndexes, 'Image',hpe5gResources.defaults[type]['image']);
		var tag=this.getAndSetValue(row, nameIndexes, 'Tag', hpe5gResources.defaults[type]['tag']);
		var storage=this.getAndSetValue(row, nameIndexes, 'Storage', hpe5gResources.defaults[type]['storage']);
		var volume=this.getAndSetValue(row, nameIndexes, 'Volume');
		var displayChart="";
		var chart=this.getAndSetValue(row, nameIndexes, 'Chart', hpe5gResources.defaults[type]['chart']);
		var chartVersion=this.getAndSetValue(row, nameIndexes, 'Version', hpe5gResources.defaults[type]['version']);
		var chartOptions=this.getAndSetValue(row, nameIndexes, 'Options');
		var values=this.getFileObject(row, "Values");
		if(chart)displayChart=" with chart "+chart;
		if(chartVersion)chartOptions+=" --version "+chartVersion;
		if(chartOptions)displayChart+=" "+chartOptions;
		this.check += checkDependency(this.title=='HelmCharts', [values && values.hasContent() && chart.length>0], this.title+" "+name,", Helm chart and values are required");
		var displayVolume="";
		var replicas=this.getAndSetValue(row, nameIndexes, 'Replicas', hpe5gResources.defaults[type]['Replicas']?hpe5gResources.defaults[type]['Replicas']:"");
		if(!replicas)replicas="1";
		var dependenciesList=this.getAndSetValue(row, nameIndexes, 'Dependencies');
		var dependencies=undefined;
		if(dependenciesList)dependencies=dependenciesList.split(/[\s,]+/);
		if(name.search(/[A-Z_]/g) >= 0){this.check += "\n"+this.title+" "+name+" : upper case and underscore characters are not supported";}
		if(!project){this.check += "\n"+this.title+" "+name+" : project is required";}
		var displayImage="";
		if(!image){
			if(hpe5gResources.defaults[type]['image'])this.check += "\n"+this.title+" "+name+" : image is required";
		}else{displayImage=" running image: "+image+":"+tag;}
		if(storage)displayVolume+=" with "+storage+" storage";
		if(volume !=''){
			if(!PersistentVolumes.search('Name', volume))this.check += "\n"+this.title+" "+name+": "+volume+" is undefined in the PersistentVolumes section";
			else displayVolume+=" on volume: "+volume;
		}
		// Name must be unique accross all hpe5g resources
		if(NetworkFunctions.count('Name', name) + DirectServices.count('Name', name) + IndirectServices.count('Name', name) + Operators.count('Name', name) > 1)this.check += "\n"+this.title+": resource name "+name+" is duplicated across sections "+hpe5gResources.sections.join();
		this.check += checkDependency(hpe5gResources.defaults[type]['storage'] != undefined, [storage.length>0], this.title+" "+name,", Storage is required");
		
		var pipeline=this.getAndSetValue(row, nameIndexes, 'Pipeline');
		if(pipeline.search(/[A-Z_]/g) >= 0){this.check += "\n"+this.title+" "+name+" pipeline "+pipeline+": upper case and underscore characters are not supported";}
		var pipelineTemplate=Builds.getTemplate('pipeline', pipeline);
		this.check += checkDependency(pipeline, [pipelineTemplate], this.title+" "+name+": pipeline "+pipeline, " is undefined in the Builds section");
		
		var replicasNumber = Number(replicas);
		if(isNaN(replicasNumber) && !replicas.startsWith('${')){
			this.check += "\n"+this.title+": illegal replicas value for "+name+" : "+replicas+"; expecting integer";
			continue;
		} 
		var displayReplicas="";
		if(replicas)displayReplicas=replicas+ " replica(s) of type: ";
		
		// Record this provider to resolve dependencies later per type and per project
		if(!hpe5gResources.provides[type])hpe5gResources.provides[type] = new Array();
		if(!hpe5gResources.provides[type][project])hpe5gResources.provides[type][project]=new Array();
		hpe5gResources.provides[type][project].push(name);
		
		hpe5gResources.openshiftFunctions.push(
  		new openshiftFunction(type, name, image, tag, project, storage, volume, replicas, dependencies, URL, chart, values, chartOptions, pipelineTemplate));
		
		if(insecure && hpe5gResources.insecureRegistries.indexOf(URL) < 0)hpe5gResources.insecureRegistries.push(URL);
		
		if(hpe5gResources.admin && hpe5gResources.admin[type])hpe5gResources.adminList+="\n- "+name+":\tsection: "+this.title+"\tproject: "+project+"\ttype: "+type;
		
		result+="\n#- "+name+": "+displayReplicas+type+" on project: "+project+displayImage+displayVolume+displayChart;
	}
	
	if(this.check != "")return this.check;
	return result;
};

//Class implementing a network function: name, image (including the tag), URL (hosting the image), pipeline, Helm chart 
var openshiftFunction = function(aType, aName, anImage, aTag, aProject, aStorage, aVolume, aReplicas, aDependency, aURL, anHelmChart, anHelmChartValues, anHelmChartOptions, aPipeline){
	this.type=aType;
	this.name=aName;
	this.image=anImage;
  this.tag=aTag;
	this.URL=aURL;
	this.project=aProject;
	this.storage=aStorage;
	this.volume="";
	if(aVolume != undefined && aVolume.length > 0)this.volume="volumeName: "+aVolume;
	this.replicas=aReplicas;
	this.dependency=aDependency;
	this.helmChart=anHelmChart; this.helmChartValues=anHelmChartValues; this.helmChartOptions=anHelmChartOptions;
	this.pipeline=aPipeline;
	// Insecure registries are managed by docker; secured registries are pulled directly from the URL
	this.insecureURL = function(){return hpe5gResources.insecureRegistries.indexOf(this.URL) >= 0;}
	this.imageStream = function(){
		var _imageStream=this.URL;
		if(_imageStream&&this.image)_imageStream+='/';
		_imageStream+=this.image;
		if(this.tag)_imageStream+=':';
    _imageStream+=this.tag;
    if(this.insecureURL())_imageStream='docker-registry.default.svc:5000/'+this.project+'/'+this.image+':'+this.tag;
		return _imageStream;
	}
}

// Resolve dependency of a given resource on a specific type: accept multiple candidates silentlty, just take the first one
// The required type can be a simple string or a table of aliases 
openshiftFunction.prototype.resolve = function(requirement){
	var candidates, result;
	var types = new Array();
	var self = this;
	if(typeof requirement == "string"){types.push(requirement);}else{types=requirement;}
	types.some(function(type){
      candidates=undefined;
      if(hpe5gResources.provides[type])candidates=hpe5gResources.provides[type][self.project];
      if(candidates)
      	// If the user has listed preferred resources resolving dependencies, use the first of those preferred names
      	if(self.dependency)result=candidates.filter(value => -1 !== self.dependency.indexOf(value))[0];
      	// otherwise, use the first candidate
      	else result=candidates[0];
      // Stop there if resolved
      return result;
	});
	return result
}

//==========================
// Deployed 5G resources
//==========================
// Composite object holding the deployed 5G resources
var hpe5gResources=new Object;
// Array of sections names holding 5G resources
hpe5gResources.sections=['DirectServices','IndirectServices','OperatorSources','Operators','NetworkFunctions','HelmCharts'];
// Array of types per section: hpe5gResources.types[section]:[types]
// Array of types, each holding a boolean tracking the admin privilege requirement for this type: hpe5gResources.admin[type]:boolean
hpe5gResources.admin=new Array();
hpe5gResources.defaults=new Array();
hpe5gResources.defaultCatalog="";

// Reset the list of resources, to be called before building them
hpe5gResources.init = function(){
	hpe5gResources.openshiftFunctions=new Array();	// array of instances of the class openshiftFunction, the actually OpenShift resources deployed by this session
	hpe5gResources.provides=new Array();			// array of instances names actually providing a specific type for a project: hpe5gResources.provides[type][project]:[names]
	hpe5gResources.projects=new Array();			// array of projects names deployed by this session
	hpe5gResources.adminList="";
	hpe5gResources.insecureRegistries=new Array();	// array of URLs pointing to insecure registries
	hpe5gResources.insecureRegistriesList="";
  hpe5gResources.untemplatedDeployments=new Array();  // array of resources deployed out of an OpenShift application template, typically customApps, OperatorsCatalogs
}

// Compile the resources from the various resources sections: build the list of projects, registries, and cross check dependencies 
hpe5gResources.compile = function(){
	// Build the list of projects as a concatenation of hpe5g resources and custom apps projects, removing duplicates
	hpe5gResources.projects=Array.from(new Set(hpe5gResources.openshiftFunctions.map(function(e){return e.project;}).concat(Object.keys(hpe5gResources.untemplatedDeployments))));
	if(hpe5gResources.insecureRegistries.length > 0)hpe5gResources.insecureRegistriesList += '"'+hpe5gResources.insecureRegistries.join('","')+'"';
	
	// Check cross functions dependencies
	var check="";
	hpe5gResources.openshiftFunctions.forEach(function(networkFunction){
		// Check if all dependencies for this network function type are satisfied on this project
		if(hpe5gResources.depends && hpe5gResources.depends[networkFunction.type])hpe5gResources.depends[networkFunction.type].forEach(function(requirement){
			if(networkFunction.resolve(requirement))return;
			check += "\nNetworkFunctions: "+networkFunction.name+" missing dependency "+requirement+" on project "+networkFunction.project;
			if(networkFunction.dependency)check+=" in the provided list: "+networkFunction.dependency;
		});
    });
	
	// Insecure registries not managed out of a full stack deployment since this requires a docker configuration on all nodes in /etc/docker/daemon.json
	if((!Nodes.cloudNodes || !Nodes.cloudNodes.some(function(e){return e.isEms;})) && hpe5gResources.insecureRegistriesList){
		check += "\nInsecure registries not managed out of a full stack deployment; this requires a docker configuration on all nodes performed during OpenShift deployment:"+hpe5gResources.insecureRegistriesList;
	}
  return check;
}

//===========================
//NetworkFunctions
//===========================
var NetworkFunctions = new hpe5gResource("NetworkFunctions", [
	{name:'Type', type:'choice', width: '100px', choices: function(){return hpe5gResources.types['NetworkFunctions'];}}, 
	{name:'Name', type:'text', width:'80px'},
	{name:'Project', type:'text', width:'60px'},
	{name:'URL', type:'text', width:'200px'},
	{name:'insecure', type:'bool'},
	{name:'Image', type:'text', width:'120px'},
	{name:'Tag', type:'text', width:'120px'},
	{name:'Storage', type:'text', width:'60px'},
	{name:'Volume', type:'text', width:'60px'},
	{name:'Replicas', type:'text', width:'40px'},
	{name:'Dependencies', type:'text', width:'100px'},
	{name:'Pipeline', type:'text', width:'100px'}
	]
	);
//===========================
//DirectServices
//===========================
var DirectServices = new hpe5gResource("DirectServices", [
	{name:'Type', type:'choice', width: '100px', choices: function(){return hpe5gResources.types['DirectServices']}}, 
	{name:'Name', type:'text', width:'80px'},
	{name:'Project', type:'text', width:'60px'},
	{name:'URL', type:'text', width:'200px'},
	{name:'insecure', type:'bool'},
	{name:'Image', type:'text', width:'120px'},
	{name:'Tag', type:'text', width:'120px'},
	{name:'Storage', type:'text', width:'60px'},
	{name:'Volume', type:'text', width:'60px'},
	{name:'Replicas', type:'text', width:'40px'},
	{name:'Dependencies', type:'text', width:'100px'},
	{name:'Pipeline', type:'text', width:'100px'}
	]
	);
DirectServices.help = function(){return hpe5gResource.prototype.help()+
`NOTES:
- redis default admin password is the name of the instance.
  redis-nopwd deploys a redis instance without password 
- ignite on persistent storage deploys three volumes:
  - work
  - wal
  - walarchive   
As a consequence, the total claimed storage size is 3x the user defined size.
- ignite recommended values for udsf legacy versions are: 
  - URL: docker.io/apacheignite
  - Image: ignite
  - tag: 2.7.5
`;}
//===========================
//IndirectServices
//===========================
var IndirectServices = new hpe5gResource("IndirectServices", [
	{name:'Type', type:'choice', width: '100px', choices: function(){return hpe5gResources.types['IndirectServices']}}, 
	{name:'Name', type:'text', width:'80px'},
	{name:'Project', type:'text', width:'60px'},
	{name:'URL', type:'text', width:'200px'},
	{name:'insecure', type:'bool'},
	{name:'Image', type:'text', width:'120px'},
	{name:'Tag', type:'text', width:'120px'},
	{name:'Storage', type:'text', width:'60px'},
	{name:'Volume', type:'text', width:'60px'},
	{name:'Replicas', type:'text', width:'40px'},
	{name:'Dependencies', type:'text', width:'100px'},
	{name:'Pipeline', type:'text', width:'100px'}
	]
	);
IndirectServices.help = function(){return hpe5gResource.prototype.help()+
`NOTES: 
- jenkins recommended values for RedHat OpenShift 3 are : 
  . URL: docker.io/openshift
  . Image: jenkins-2-centos7
  . tag:latest 
- grafana default admin password is the name of the instance.
 `;}
 
//===========================
//OperatorSources
//===========================
var OperatorSources = new vnfResource("OperatorSources", [
  {name:'Type', type:'choice', width: '140px', choices: ['catalog-source','operator-source',]}, 
  {name:'Name', type:'text', width:'100px'},
  {name:'Project', type:'text', width:'200px'},
  {name:'URL', type:'text', width:'400px'}
  ]
);
OperatorSources.help = function(){return `Operator sources instantiation:
- Type: the type of the operator source to instantiate:
  operator-source is supported until OpenShift 4.5 included (kind OperatorSource)
  catalog-source is mandatory starting with OpenShift 4.6 (kind CatalogSource)
- Name: the name of the operator source, typically the account name in quay.io for OperatorSource, the name of the operator for CatalogSource
- Project: the OpenShift project where to deploy this source, typically openshift-marketplace
- URL: location of the account, typically https://quay.io/cnr for OperatorSource, quay.io/<user account>/<operator index>:<version> for CatalogSource
`;
}
OperatorSources.build = function(target){
  var nameIndexes = OperatorSources.nameIndexes;
  var result = "";
  OperatorSources.check="";
  var table = document.getElementById(this.title);
  var rowCount = table.rows.length;
  OperatorSources.deployments = new Object;
  Builds.templates['operator-source']=new Object;
  Builds.templates['catalog-source']=new Object;

  for(var i=1; i < rowCount; i++){
    if(result==""){
      result += "\n"
      result += "\n# --------------------------------";
      result += "\n# OperatorSources definition           ";
      result += "\n# -------------------------------- ";
      }
    var row = table.rows[i];
    var type=this.getAndSetSelection(table.rows[i], nameIndexes, 'Type', 0);
    if(!hpe5gResources.defaults[type] || !hpe5gResources.defaults[type]['template']){this.check += "\n"+this.title+": "+type+" template is unknown in the catalog"; continue;}
    var name=this.getAndSetValue(row, nameIndexes, 'Name', hpe5gResources.defaults[type]['Name']);
    var project=this.getAndSetValue(row, nameIndexes, 'Project',hpe5gResources.defaults[type]['Project']);
    var URL=this.getAndSetValue(row, nameIndexes, 'URL', hpe5gResources.defaults[type]['URL']);
    Builds.makeTemplate(name, type, URL);
    var template=Builds.templates[type][name];
    
    if(!hpe5gResources.untemplatedDeployments[project])hpe5gResources.untemplatedDeployments[project]=new Array();
    hpe5gResources.untemplatedDeployments[project].push(template
    .replace(/~NAME~/g,name)
    .replace(/~PROJECT~/g,project)
    .replace(/~URL~/g,URL));
    
    result+="\n#- "+name+": "+type+" from "+URL+" on project: "+project;
    if(hpe5gResources.admin && hpe5gResources.admin[type])hpe5gResources.adminList+="\n- "+name+":\tsection: OperatorSources\tproject: "+project+"\ttype: "+type;
  }
  
  if(this.check != "")return this.check;
  return result;
};

//===========================
//Operators
//===========================
var Operators = new hpe5gResource("Operators", [
	{name:'Type', type:'choice', width: '200px', choices: function(){return hpe5gResources.types['Operators']}}, 
	{name:'Name', type:'text', width:'140px'},
	{name:'Project', type:'text', width:'140px'},
	{name:'Replicas', type:'text', width:'40px'},
	{name:'Pipeline', type:'text', width:'100px'}
	]
);
Operators.help = function(){return `Operator instantiation:
PREREQUISITE: the operators are installed on the target OpenShift infrastructure.
- Type: the type of the operator to instantiate
- Name: one word resource name for this operator instance
- Project: the OpenShift project hosting this operator instance
- Replicas: number of replicas passsed to this operator instance.
- Pipeline: create a Jenkins pipeline for this operator instance from the Builds section definition
	
`;
}

//===========================
// TemplateParameters
//===========================
var TemplateParameters = new vnfResource("TemplateParameters", [
  {name:'Required', width:'60px', type:'bool'},
  {name:'Name', type:'text', width:'200px'},
  {name:'Value', type:'text', width:'300px'},
  {name:'Description', type:'text', width:'400px'}
  ]
  );
TemplateParameters.help = function(){ return `Resources customization in the application template output:
- Name: the name of the parameter to replace in the template for each occurence of the reference: $\{Name} or $\{{Name}} for non strings parameters
- Description: human readable description of this parameter
- Value: default value for this parameter
- Required: boolean enforcing the parameter definition  
`;
}
TemplateParameters.build = function(target){
  var nameIndexes = TemplateParameters.nameIndexes;
  var result = "\n";
  TemplateParameters.check = "";
  TemplateParameters.output = new Array();
  var table = document.getElementById("TemplateParameters");
  var rowCount = table.rows.length;
  
  result += "\n# ------------------------------- #";
  result += "\n# TemplateParameters                 #";
  result += "\n# ------------------------------- #";
  
  for(var i=1; i < rowCount; i++){
    var row = table.rows[i];
    var required=TemplateParameters.getAndSetChecked(row, nameIndexes, 'Required');
    var name=TemplateParameters.getAndSetValue(row, nameIndexes, 'Name',"Param-"+i);
    var value=TemplateParameters.getAndSetValue(row, nameIndexes, 'Value', "Param-"+i+"-value");
    var description=TemplateParameters.getAndSetValue(row, nameIndexes, 'Description', "Parameter "+i+" description");
    if(!name)TemplateParameters.check+="\nTemplatePararmeters: "+description+" missing name";
    result += "\n# "+(required?"Required":"Optional")+" parameter "+name+" defaulting to "+value+": "+description;
    TemplateParameters.output.push({name:name, value:value, required:required, description:description});
  }
  if(TemplateParameters.check != "")return TemplateParameters.check;
  return result;
};

//===========================
//HelmCharts
//===========================
var HelmCharts = new hpe5gResource("HelmCharts", [
	{name:'Type', type:'choice', width: '140px', choices: function(){return hpe5gResources.types['HelmCharts']}},
	{name:'Name', type:'text', width:'100px'},
	{name:'Project', type:'text', width:'60px'},
	{name:'Chart', type:'text', width:'200px'},
	{name:'Values', type:'file', width:'200px'},
	{name:'Version', type:'text', width:'60px'},
	{name:'Options', type:'text', width:'120px'},
	{name:'Pipeline', type:'text', width:'100px'}
	]
);
HelmCharts.help = function(){var help=this.title+
`
PREREQUISITE: Helm is installed on the target OpenShift infrastructure and configured to provide the deployed charts.
- Type: the type of the Helm chart to instantiate: used for default values and dependency check against backing services. Use 'generic' to disable checks.
- Name: one word resource name for this chart instance
- Project: the OpenShift project hosting this chart instance
- Chart: name of the chart to deploy; Helm must be configured on the infrastructure to provide this chart
- Values: local file injected in this chart as deployment values
- Version: specify the exact chart version to install. If this is not specified, the latest version is installed
- Options: additional options passed to helm at deployment time as a text string (quotes and double quotes must be backslash escaped)
- Pipeline: create a Jenkins pipeline for this chart instance from the Builds section definition
	
`;
return help;
}


// Build a kubernetes native application template 
function outputAppHpe5g(){
  hpe5gResources.init();

  // Check the hpe5gResources sections (or get the errors)
  var check = '';
  ['Builds', 'CustomApps','TemplateParameters'].concat(hpe5gResources.sections).forEach(function(section){
    window[section].build();
    check += window[section].check;
  });
  check += hpe5gResources.compile();
  if(check){userOutput(check); return '';}

  var result=hpe5gNetworkFunctions();
  
  // Show to the user and save to hpe5gApp.yaml
    userOutput(result);
  // Stop there if headless, ie no user interface
  if(Misc.getValue('headless'))return true;
  
  var blobApp = new Blob([result], {type: "text/plain;charset=utf-8"});
  var a = document.createElement('a');
  a.href = window.URL.createObjectURL(blobApp);
    a.download = "hpe5gApp.yaml";
    document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  return true;
}
