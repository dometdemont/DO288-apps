// ===========================
// CinderVolumes settings
// ===========================
var CinderVolumes = new vnfResource("CinderVolumes", [
	{name:'Name', type:'text', width:'120px'},
	{name:'Size', type:'text', width:'80px'},
	{name:'Description', type:'text', width:'300px'}
	]
	);

CinderVolumes.help = function(){var help="Persistent storage:"+
	"\nList of CinderVolumes allocated for OpenShift persistent storage:"+
	"\n\t- Name: one word CinderVolume name"+
	"\n\t- Size: CinderVolume size expressed in Gbytes"+
	"\n\t- Description: free text CinderVolume description";
	
	return help;
}

CinderVolumes.build = function(target){
	var nameIndexes = CinderVolumes.nameIndexes;
	var result = "";
	CinderVolumes.check="";
	var table = document.getElementById("CinderVolumes");
	var rowCount = table.rows.length;
	
	var cloudVolumes = new Array();

	
	for(var i=1; i < rowCount; i++){
		if(result==""){
			result += "\n"
			result += "\n# ------------------------------- #";
			result += "\n# CinderVolumes definition    #";
			result += "\n# ------------------------------- #";
			}
		var row = table.rows[i];
		var name=CinderVolumes.getAndSetValue(row, nameIndexes, 'Name', "CinderVolume-"+i);
		var size=CinderVolumes.getAndSetValue(row, nameIndexes, 'Size', "20");
		var description=CinderVolumes.getAndSetValue(row, nameIndexes, 'Description');
		
		var sizeNumber = Number(size);
		if(isNaN(sizeNumber)){
			CinderVolumes.check += "\nCinderVolumes: illegal size value for CinderVolume  "+name+" : "+size+"; expecting integer";
			continue;
		} 
		result+="\n#"+name+" "+size+" Gbytes: "+description;
		cloudVolumes.push(new cloudVolume(name, size, description));
	}
	
	// Make the list of CinderVolumes for availableHeat template  
	CinderVolumes.cloudVolumes = cloudVolumes.slice();
	
	if(CinderVolumes.check != "")return CinderVolumes.check;
	return result;
};


// ===========================
// PersistentVolumes settings
// ===========================
var PersistentVolumes = new vnfResource("PersistentVolumes", [
	{name:'Name', type:'text', width:'120px'},
	{name:'Size', type:'text', width:'80px'},
	{name:'Type', type:'choice', width: '80px', choices:['ext3']}, 
	{name:'Access', type:'choice', width: '120px', choices:['ReadWriteOnce','ReadWriteMany','ReadOnlyMany']}, 
	{name:'Reclaim', type:'choice', width: '120px', choices:['Delete','Retain','Recycle']}, 
	{name:'CinderVolume', type:'text', width:'120px'}
	]
	);

PersistentVolumes.help = function(){var help="OpenShift Persistent Volumes:"+
	"\nList of OpenShift Persistent Volumes allocated in OpenStack Cinder volumes:"+
	"\n\t- Name: one word persistent volume name"+
	"\n\t- Size: persistent volume size expressed in Gbytes"+
	"\n\t- Type: file system type"+
	"\n\t- Access: access mode for this persistent volume"+
	"\n\t- CinderVolume: name of the CinderVolume hosting this persistent volume"
	
	return help;
}

PersistentVolumes.build = function(target){
	var nameIndexes = PersistentVolumes.nameIndexes;
	var result = "";
	PersistentVolumes.check="";
	var table = document.getElementById("PersistentVolumes");
	var rowCount = table.rows.length;
	
	var openshiftVolumes = new Array();

	
	for(var i=1; i < rowCount; i++){
		if(result==""){
			result += "\n"
			result += "\n# --------------------------------";
			result += "\n# PersistentVolumes definition";
			result += "\n# -------------------------------- ";
			}
		var row = table.rows[i];
		var name=PersistentVolumes.getAndSetValue(row, nameIndexes, 'Name', "PersistentVolume-"+i);
		var size=PersistentVolumes.getAndSetValue(row, nameIndexes, 'Size', "5");
		var type=PersistentVolumes.getAndSetSelection(table.rows[i], nameIndexes, 'Type', 0);
		var access=PersistentVolumes.getAndSetSelection(table.rows[i], nameIndexes, 'Access', 0);
		var reclaim=PersistentVolumes.getAndSetSelection(table.rows[i], nameIndexes, 'Reclaim', 0);
		var cinder=PersistentVolumes.getAndSetValue(row, nameIndexes, 'CinderVolume', "CinderVolume-"+i);
		if(cinder == undefined || cinder == ''){
			PersistentVolumes.check += "\nPersistentVolumes "+name+" : CinderVolume is required";
			continue;
		}
		if(!CinderVolumes.search('Name', cinder)){
			PersistentVolumes.check += "\nPersistentVolume "+name+": "+cinder+" is undefined in the CinderVolumes section";
			continue;
		}
		
		var sizeNumber = Number(size);
		if(isNaN(sizeNumber)){
			PersistentVolumes.check += "\nPersistentVolumes: illegal size value for volume  "+name+" : "+size+"; expecting integer";
			continue;
		} 
		result+="\n#"+name+" "+size+" Gbytes type: "+type+" access: "+access+" reclaim policy: "+reclaim+" on CinderVolume: "+cinder;
		openshiftVolumes.push(new openshiftVolume(name, size, type, access, reclaim, "~cinderVolumeIdOf"+cinder+"~"));
	}
	
	// Make the list of volumes for availableHeat template  
	PersistentVolumes.openshiftVolumes = openshiftVolumes.slice();
	
	if(PersistentVolumes.check != "")return PersistentVolumes.check;
	return result;
};
