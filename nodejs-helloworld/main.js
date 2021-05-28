//====================================
// Main javascript entry point
//====================================

// Import silently the default catalog 
importCatalog(hpe5gResources.defaultCatalog, true);

//Add the 'import session' control if missing
var importedSession = new userLoadedFile("importedSession", "Import...", importSession);
if(!importedSession.isDefined())document.getElementById("controlArea").appendChild(importedSession.getDomElement());

// Display only used sections
vnfResources.forEach(function(e,i,t){e.display(!e.isEmpty())});

// Restore dynamic javascript variables based on the ID of variables of class userLoadedFile
var userLoadedFiles = Array.prototype.slice.call( document.getElementsByClassName("userLoadedFile") );
userLoadedFiles.forEach(function(e, i){window[e.id] = new userLoadedFile(e.id);});

hpe5gResources.init();

//Welcome message when starting with an empty session
if(Nodes.isEmpty() && NetworkFunctions.isEmpty() && IndirectServices.isEmpty() && DirectServices.isEmpty() && Operators.isEmpty() && HelmCharts.isEmpty()){
var welcomeMsg=`Welcome to the CMS5G Core stack automated deployer assistant.

To deploy resources, click on the section names in the Summary line or import an existing session using the file chooser button.
For more help, click the section specific or general Help button.

Resources deployment on top of OpenShift:`;
hpe5gResources.sections.forEach(function(section){
	welcomeMsg+="\n- "+section+": ";
	welcomeMsg+=hpe5gResources.types[section].join();
});
welcomeMsg+=
`

Once resources are defined, several deployment options are available:
- Installer: builds an installer as a shell script. This installer has to be invoked on the console connected to the OpenShift cluster as an OpenShift user to deploy the resources.
  If the resources to deploy include the OpenShift cluster itself, the installer has to be invoked from an ansible controller: refer to the OpenStack section in the general Help.
- HPE5gApp: builds the application definition deployable using the hpe5g operator. This operator has to be installed beforehand from https://quay.io/cnr registryNamespace: dometdemont
- REST API: refer to the github project README  
`;  

userOutput(welcomeMsg);
}
