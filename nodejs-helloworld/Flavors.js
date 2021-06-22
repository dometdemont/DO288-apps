//===========================
//Flavors settings
//===========================
var Flavors = new vnfResource("Flavors", [
	{name:'Infrastructure', width:'100px', type:'choice', choices:['openstack', 'azure']},
	{name:'Flavor', width:'120px', type:'choice', choices:['flavorTiny', 'flavorSmall', 'flavorStandard', 'flavorLarge', 'flavorPerformance']},
	{name:'name', type:'text', width:'200px'}
	]
	);
//OpenStack profiles default values
Flavors['openstack'] = new Array();
Flavors['openstack']['flavorTiny'] = {name: 'v1.m2'};
Flavors['openstack']['flavorSmall'] = {name: 'v2.m2'};
Flavors['openstack']['flavorStandard'] = {name: 'v2.m8'};
Flavors['openstack']['flavorLarge'] = {name: 'v4.m8'};
Flavors['openstack']['flavorPerformance'] = {name: 'v4.m16'};
Flavors['azure'] = new Array();
Flavors['azure']['flavorTiny'] = {name: 'Standard_B2ms'};
Flavors['azure']['flavorSmall'] = {name: 'Standard_B4ms'};
Flavors['azure']['flavorStandard'] = {name: 'Standard_D4s_v3'};
Flavors['azure']['flavorLarge'] = {name: 'Standard_D8s_v3'};
Flavors['azure']['flavorPerformance'] = {name: 'Standard_D32_v4'};

Flavors.help = function(){
var help=`Infrastructure flavors:
Default flavor of a node is defined by the roles played on this node:
- Small: Etcd
- Standard: Worker
- Large: Master    
Those default values can be overriden at the node level in the Nodes section.    
Flavors are identified by name, made available by the infrastructure administrator    
Examples:    
`;
	// Table built with spaces for alignment, thanks to padStart
	var colLength=20;
	['Infrastructure', 'Flavor', 'Name'].forEach(function(column){
		help+=column.padStart(colLength);
	});
	help+="    ";
	['openstack', 'azure'].forEach(function(infrastructure){
		['flavorTiny','flavorStandard', 'flavorSmall','flavorLarge','flavorPerformance'].forEach(function(flavor){
      var name=Flavors[infrastructure][flavor].name;
      if(!name)name="<undefined>";
  		help+="\n"+infrastructure.padStart(colLength);
  		help+=flavor.padStart(colLength);
  		help+=name.padStart(colLength)+"    ";
		});	
	});
	help+="\n";
	return help;
}

Flavors.build = function(target){
	var nameIndexes = Flavors.nameIndexes;
	var result = "";
	Flavors.check="";
	var table = document.getElementById("Flavors");
	var rowCount = table.rows.length;
	
	for(var i=1; i < rowCount; i++){
		if(result==""){
			result += "\n"
			result += "\n# ------------------------------- #";
			result += "\n# Flavors customization           #";
			result += "\n# ------------------------------- #";
			}
		var row = table.rows[i];
		var infra=Flavors.getAndSetSelection(row, nameIndexes, 'Infrastructure');
		var flavor=Flavors.getAndSetSelection(row, nameIndexes, 'Flavor');
		switch(infra){
			case 'openstack': case 'azure':
				Flavors[infra][flavor].name=Flavors.getAndSetValue(row, nameIndexes, 'name', Flavors[infra][flavor].name, "Flavor name for "+flavor+" on "+infra);
				result+="\n# "+infra+" "+flavor+": name="+Flavors[infra][flavor].name;
				break;
			default:
				Flavors.check += "\nFlavors section: setting flavors is not supported on infrastructure : "+infra;
				break;
		}
	}
	
	if(Flavors.check != "")return Flavors.check;
	return result;
};

