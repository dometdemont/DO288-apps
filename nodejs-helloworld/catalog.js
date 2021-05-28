//=================================
//Catalog of resources
//=================================
var catalogDoc=
`The catalog is an internal object defining the types and attributes of the CMS5G Core Stack resources deployable from the assistant on an OpenShift cluster.
It consists in four sections:
  - types
  - dependencies
  - values
  - admin

1. types:
  Define the name of each type of resource managed by the assistant.
  Each name must fall in one of those categories: `+hpe5gResources.sections.join()+`
2. dependencies:
  Define for each type the list of required resources by their type names.   
  If a dependency can be resolved by different types, a list can be provided as a json table.    
  The placeholder used in templates is the first element in this list.    
  Example: telegraf can play an influxdb type, and can be deployed as an indirect service or a helm chart.    
    The udsf resource requiring both ignite and influxdb resources can specify this dependencies list:   
	"nudsf-dr": ["ignite",["influxdb","telegraf","telegraf-chart"]]   
    The udsf template has to use the placeholders ~ignite_NAME~ and ~influxdb_NAME~ to enable the dependencies resolution at deployment time.    
3. values:
  Define for each type the values used as default for the resources attributes. The list of attributes offering default values depends on the resource category:
    - IndirectServices,NetworkFunctions,DirectServices: URL, image, tag, template
    - Operators: template
    - HelmCharts: chart    
4. admin:
  Define for each type if it requires special privileges for deployment (optional, default to false)    
  If true, a warning is emitted to inform the user that the deployment may fail if run without admin privileges.    

<a name="dependenciesResolution"></a>
###Template parameters and dynamic dependencies resolution
The template attribute in the values section is a YAML description of the OpenShift template used for deploying the resource. It must/may include those placeholders:
  - must: 
      - ~NAME~ is the name of the resource
      - ~PROJECT~ is the name of the OpenShift project (namespace)
  - may:
      - ~IMAGE~ is the name of the docker image
      - ~REPLICAS~ is the number of replicas
      - ~dependency_NAME~ is a reference to the actual name of a dependency for this resource.    
      This placeholder allows dynamic resolution of dependencies between resources. For instance, in the udsf template, the datasource service name ~ignite_NAME~ will be dynamically resolved as the actual name of the ignite instance in this project for this deployment.
      - ~VOLUME~ if the persistent storage can be hosted on a specific volume; this placeholder is replaced with "volumeName: the_volume_name" at build time
      - ~PERSISTENCE_START~conditional_sequence~PERSISTENCE_END~ useful to manage resources with optional persistent storage like ignite: 
    		the conditional sequence is removed when no persistent storage is defined by the user for this resource    
     
Those placeholders are processed at build time with the actual values defined by the user.
Templates can also be loaded as files from the GUI using the Import Yaml template button in the Catalog fieldset. See the online help for more details.  
`;
function catalogHelp(){userOutput(catalogDoc+`
User interface buttons:
Display:
  Output a human readable view of the current catalog. The depth and length of the view can be tuned with the 'depth' and 'ellipsis' drop down boxes.
Export Json catalog:
  Output the current catalog in JSON format and save the same as a file in the download folder of the browser named: hpe5g.catalog.json
Import Json catalog: 
  Loads a custom catalog from a user provided JSON file; the user is prompted to either override or extend the current catalog.
Import Yaml template
  Loads a custom yaml file to override the template attribute of a type existing in the catalog; the user is prompted to provide the name of the type to override.
  This feature is useful for loading very long or complex yaml templates compared to providing the same as json payload in the catalog.
  This yaml file must be formatted as the body of an OpenShift template, ie a table of resources definitions like:
- kind: ServiceAccount
	apiVersion: v1
	metadata:
	  name: ~NAME~
	  namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: v1
  ....
- kind: xxx
  ...
`)};

var yamlImport = new userLoadedFile("yamlImport", "Import Yaml template...", importYaml);
if(!yamlImport.isDefined())document.getElementById("catalogArea").appendChild(yamlImport.getDomElement());
function importYaml(){
	var userYaml;
	var check="";
	var type=prompt("To which type this template applies?");
	if(!hpe5gResources.defaults[type])check+="Type "+type+" not found in the current catalog; please update the catalog beforehand";
	else try{
		userYaml=YAML.parse(yamlImport.content);
  		hpe5gResources.defaults[type]['template']=yamlImport.content
	}catch(e){check+="Parsing exception received: "+e; }
	userOutput(check ? check : objToString(userYaml));
}

var catalogImport = new userLoadedFile("catalogImport", "Import Json catalog...", importCatalog);
if(!catalogImport.isDefined())document.getElementById("catalogArea").appendChild(catalogImport.getDomElement());
function exportCatalog(){
	var catalog=JSON.stringify({types: hpe5gResources.types, dependencies: hpe5gResources.depends, values: hpe5gResources.defaults, admin: hpe5gResources.admin});
	userOutput(catalog);
	// Stop there if headless, ie no user interface
	if(Misc.getValue('headless'))return true;
	
	var blobCatalog = new Blob([catalog], {type: "text/plain;charset=utf-8"});
	var a = document.createElement('a');
	a.href = window.URL.createObjectURL(blobCatalog);
    a.download = "hpe5g.catalog.json";
    document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	return true;
}
function importCatalog(jsonCatalog = catalogImport.content, silent = false){
  var result=false;
  try {
    var catalog = JSON.parse(jsonCatalog); 
    // Catalog sanity check
    var check="";
    var importedTypes = new Array();
    Object.keys(catalog).forEach(function(key) {
    	switch(key){
    	case 'types': 
    		Object.keys(catalog[key]).forEach(function(type) {
        		if(hpe5gResources.sections.indexOf(type)<0){check+="\nLevel 2: "+key+":invalid type "+type+"; expected: "+hpe5gResources.sections.join(); return;}
        		importedTypes = importedTypes.concat(catalog[key][type]);
    		});
    		break;
    	case 'dependencies': case 'values': case 'admin':
    		if(importedTypes.length==0){check+="\nLevel 1: missing types section in first position"; break;}
    		Object.keys(catalog[key]).forEach(function(type) {
    			if(importedTypes.indexOf(type)<0){check+="\nLevel 2: "+key+": unknown type "+type+"; expected: "+importedTypes.join(); return;}
    			// JSON.parse may render emtpy tables as {} with no length defined: force an array in dependencies sections
    			if(key=='dependencies' && catalog[key][type].length == undefined)catalog[key][type]=new Array();
    		});
    		break;
    	default: 
    		check+="\nLevel 1: invalid key "+key+"; expected: types,dependencies,values,admin";
    		break;
    	}
	});
    if(check.length>0)userOutput("Inconsistent imported catalog:"+check);
    else if (silent || confirm("You are about to override the current catalog with imported data. Click Cancel to merge both instead.")) {
  	  hpe5gResources.types=catalog.types; 
  	  // Init sections missing in the imported catalog with an empty table
  	  hpe5gResources.sections.forEach(function(section){if(!hpe5gResources.types[section])hpe5gResources.types[section]=new Array;});
  	  hpe5gResources.depends=catalog.dependencies; 
  	  hpe5gResources.defaults=catalog.values; 
  	  hpe5gResources.admin=catalog.admin;
  	} else {
  	  Object.keys(hpe5gResources.types).forEach(function(section) {hpe5gResources.types[section]=hpe5gResources.types[section].concat(catalog.types[section]);});
  	  hpe5gResources.depends=hpe5gResources.depends?Object.assign(hpe5gResources.depends, catalog.dependencies):catalog.dependencies; 
      hpe5gResources.defaults=hpe5gResources.defaults?Object.assign(hpe5gResources.defaults, catalog.values):catalog.values; 
      hpe5gResources.admin=hpe5gResources.admin?Object.assign(hpe5gResources.admin, catalog.admin):catalog.admin;
  	}
    if(!silent)userOutput(objToString(catalog));
    result=true;
  } catch (ex) {
  	userOutput("JSON parser exception received:\n"+ex);
  }
  return result;
}

// Gratitude to https://stackoverflow.com/questions/1199352/smart-way-to-truncate-long-strings
String.prototype.trunc = String.prototype.trunc ||
function(n){
    return (n != 0 && this.length > n) ? this.substr(0, n-1) + '&hellip;' : this;
};

// Gratitude to https://stackoverflow.com/questions/5612787/converting-an-object-to-a-string
var catalog_display_depth=0;
var catalog_display_ellipse=0;
function objToString(obj, ndeep) {
	if(catalog_display_depth != 0 && ndeep > catalog_display_depth){ return '&hellip;'; }
    if(obj == null){ return String(obj); }
    switch(typeof obj){
      case "string": return String('"'+obj+'"').trunc(catalog_display_ellipse);
      case "function": return obj.name || obj.toString();
      case "object":
        var indent = Array(ndeep||1).join('\t'), isArray = Array.isArray(obj);
        return '{['[+isArray] + Object.keys(obj).map(function(key){
             return '\n\t' + indent + key + ': ' + objToString(obj[key], (ndeep||1)+1);
           }).join(',') + '\n' + indent + '}]'[+isArray];
      default: return obj.toString();
    }
  }
  
function displayCatalog(){
	catalog_display_depth=0;
	var _catalog_display_depthDOM=document.getElementById("catalog_display_depth");
	if(_catalog_display_depthDOM != undefined){
		var candidate = Number(_catalog_display_depthDOM.value);
		if(!isNaN(candidate))catalog_display_depth=candidate;
	}
	catalog_display_ellipse=0;
	var _catalog_display_ellipseDOM=document.getElementById("catalog_display_ellipse");
	if(_catalog_display_ellipseDOM != undefined){
		var candidate = Number(_catalog_display_ellipseDOM.value);
		if(!isNaN(candidate))catalog_display_ellipse=candidate;
	}

	var catalog={types: hpe5gResources.types, dependencies: hpe5gResources.depends, values: hpe5gResources.defaults, admin: hpe5gResources.admin};
	userOutput("Catalog:\n"+objToString(catalog));
}
