//===========================
// Clusters
//===========================
var Clusters = new vnfResource("Clusters", [
	{name:'Name', type:'text', width:'80px'},
	{name:'Endpoint', type:'text', width:'300px'},
	{name:'Token', type:'text', width:'300px'},
	{name:'Targeted', type:'bool'},
	]
	);

Clusters.help = function(){return `OpenShift clusters candidate for deployment through OpenShift RESTful API:
- Name: nickname of this cluster
- Endpoint: OpenShift API endpoint for this cluster.   
  Typically retrieved from a session with: oc config current-context | cut -d/ -f2 | tr - .
- Token: security token for this cluster identifying an authorized user    
  Typically retrieved from a session with: oc whoami -t
- Targeted: check this box to deploy the defined resources to this cluster
`
}

var targetedCluster = function(aName, anEndpoint, aToken){
	this.name=aName;
	this.endpoint=anEndpoint;
	this.token=aToken;
}

Clusters.build = function(target){
	var nameIndexes = Clusters.nameIndexes;
	var result="";
	Clusters.check = "";
	Clusters.targeted = new Array();
	var table = document.getElementById("Clusters");
	var rowCount = table.rows.length;
	
	for(var i=1; i < rowCount; i++){
		if(result==""){
			result += "\n# ------------------------------- #";
			result += "\n# Clusters                        #";
			result += "\n# ------------------------------- #";
			};
		var row = table.rows[i];
		var name=Clusters.getAndSetValue(row, nameIndexes, 'Name', "cluster-"+i);
		var endpoint=Clusters.getAndSetValue(row, nameIndexes, 'Endpoint', '$(oc config current-context | cut -d/ -f2 | tr - .)');
		var token=Clusters.getAndSetValue(row, nameIndexes, 'Token', '$(oc whoami -t)');
		var targeted=Nodes.getAndSetChecked(row, nameIndexes, 'Targeted');
		if(targeted){
			if(endpoint.length == 0 || token.length == 0){Clusters.check+="\nClusters section: targeted cluster "+name+" requires both Endpoint and Token definitions"; continue;}
			Clusters.targeted.push(new targetedCluster(name, endpoint, token));
		}
		result+="\n#- "+name+" cluster at endpoint "+endpoint+" with token "+token+" targeted: "+targeted;
	}

	if(Clusters.check != "")return Clusters.check;
	return result;
};
