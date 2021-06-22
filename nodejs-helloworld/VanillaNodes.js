// ===========================
// VanillaNodes resource
// ===========================
var VanillaNodes= new vnfResource("VanillaNodes", [
  {name:'Name', type:'text', width: '80px'}, 
  {name:'Cloud', width:'120px', type:'choice', choices:['azure']},
  {name:'Nodes', type:'text', width: '60px'},
  {name:'Flavor', width:'120px', type:'choice', choices:['flavorTiny','flavorSmall', 'flavorStandard', 'flavorLarge','flavorPerformance']},
  {name:'Location', type:'text', width: '120px'}, 
  {name:'sshKey', type:'file', width:'120px'}
  ]
  );
  
VanillaNodes.help = function(){
  return `Vanilla Kubernetes clusters definitions
Prerequisites:
- jq command line     
Azure specific prerequisites:
- az command line
- az login successful

Attributes:
- Name : name of the kubernetes vanilla cluster to deploy
- Cloud: the cloud type for this instance
- Nodes: the number of nodes to deploy for this kubernetes instance
- Flavor: shortcut defining the resources allocated for those nodes; mapping to the actual flavor for the target infrastructure is based on the Flavors section    
  List of Azure flavors: https://docs.microsoft.com/en-us/azure/virtual-machines/sizes-general    
  or: az vm list-sizes --location _location_ | jq .[].name    
  details: az vm list-sizes --location _location_  | jq '.[] | select(.name == "_flavor_")'    
- Location: where the resources will be deployed in the infrastructure; for instance, on Azure: southindia, eastus, northeurope, westeurope, eastasia, etc.    
  Full list retrieved by: az account list-locations | jq .[].name
- sshKey: (optional) public ssh key dropped on the kubernetes nodes for advanced investigation through ssh access    
  Default: Azure to generate SSH public and private key files if missing. The keys will be stored in the ~/.ssh directory. 
`
}
VanillaNodes.build = function(target){
  var nameIndexes = VanillaNodes.nameIndexes;
  var result = "";
  VanillaNodes.check="";
  var table = document.getElementById("VanillaNodes");
  var rowCount = table.rows.length;
  VanillaNodes.instances =new Object;
  VanillaNodes.instances.name=new Array();
  VanillaNodes.instances.cloud=new Array();
  VanillaNodes.instances.nodes=new Array();
  VanillaNodes.instances.flavor=new Array();
  VanillaNodes.instances.location=new Array();
  VanillaNodes.instances.sshKey=new Array();
  
  for(var i=1; i < rowCount; i++){
    if(result==""){
      result += "\n"
      result += "\n# ------------------------------- #";
      result += "\n# VanillaNodes definition       #";
      result += "\n# ------------------------------- #";
      }
    var row = table.rows[i];
    var name=VanillaNodes.getAndSetValue(row, nameIndexes, 'Name', "aks-"+i);
    var cloud=VanillaNodes.getAndSetSelection(row, nameIndexes, 'Cloud', 0);
    var nodes=VanillaNodes.getAndSetValue(row, nameIndexes, 'Nodes', "3");
    var flavor=VanillaNodes.getAndSetSelection(row, nameIndexes, 'Flavor');
    var location=VanillaNodes.getAndSetValue(row, nameIndexes, 'Location', "westeurope");
    var sshKey=VanillaNodes.getFileObject(row, "sshKey");
    
    if(!name)VanillaNodes.check+="\nVanillaNodes section: missing Name attribute";
    var nodesNumber = Number(nodes);
    if(isNaN(nodesNumber)){
      VanillaNodes.check+="\nVanillaNodes section: illegal value for nodes on "+name+" : "+nodes+"; expecting integer";
    }else if(nodesNumber<3)VanillaNodes.check+="\nVanillaNodes section: illegal value for nodes on "+name+" : "+nodes+"; 3 minimum required";
    if(!flavor)VanillaNodes.check+="\nVanillaNodes section: "+name+" missing Flavor attribute";
    // Convert to the actual flavor name
    flavor=Flavors[cloud][flavor].name
    
    result+="\nVanilla kubernetes "+name+" made of "+nodes+" nodes flavor "+flavor+" in "+location+(sshKey.hasContent()?" with ssh key "+sshKey.content.trunc(50):"")
    VanillaNodes.instances.name.push(name);
    VanillaNodes.instances.cloud.push(cloud);
    VanillaNodes.instances.nodes.push(nodes);
    VanillaNodes.instances.flavor.push(flavor);
    VanillaNodes.instances.location.push(location);
    VanillaNodes.instances.sshKey.push(sshKey.hasContent()?sshKey.content:'');
  }
    
  if(!VanillaNodes.check)return result;
  
  // Errors: cleanup and report
  VanillaNodes.instances=null;
  return VanillaNodes.check;
};
