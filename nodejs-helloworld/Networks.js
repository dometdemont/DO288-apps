// ==================
// Network interfaces
// ==================
var Networks = new vnfResource("Networks", [
	{name:'network', type:'choice', width: '80px', choices:['MGMT', 'PUBLIC', 'DATA1','DATA2','DATA3','DATA4']}, 
	{name:'interface', type:'text', width: '80px'}, 
	{name:'mask', type:'text', width: '120px', value:'255.255.255.224'}
  ]
	);
	
Networks.help = function(){
	return `Network interfaces names and associated masks and resources 
- network:
    - MGMT is mandatory: all nodes should be connected to the MGMT interface
    - PUBLIC: optional external IP address of nodes visible through an address translation (mandatory for OpenStack nodes)
    - DATA1-4: optional private networks
- interface: name of the network interface on the target, consisting in a common root text and a positif integer, typically eth1, eth2, etc. or ens3, ens4, ens5...
  All interfaces must have a common root name, typically mixing eth and ens is not supported.
- mask: Netmasks should be consistent across networks    
  The first netmask in the table sets the network width for all networks.     
  This width defines the maximum number of nodes and networks; it should be in the range 0 to 8, ie:    
    - from mask 255.255.255.0: width: 8, 1 network, 256 nodes
    - to mask 255.255.255.255: width: 1, 256 networks, 1 node
    - recommended: 255.255.255.224: width: 5, 8 networks, 32 nodes
`
}
// Implementation notes:
// Networks are stored in the Networks.heatNetworks table indexed by the network name, as a list of integers which is the numeric part of the interface name
// This integer is used to order the networks instanciation in the infrastructure to ensure that the user naming matches the actual naming on the targets
// Typically, networks are to be created as eth0, eth1, eth2, eth3 order to make sure that the interfaces are named accordingly on the targets.
// Conversely, if eth3 is created first, it will be assigned the name eth0 on the target.  
// The min and max interface number are available in heatMinNetwork and heatMaxNetwork respectively.
// Networks are associated with a nick name in the getNickName function: this nick name is used to name the networks and ports in the infrastructure.
// The associated interface names are stored in the Networks.devices table indexed by the network name
// The PUBLIC interface is a placeholder for setting FIPs on OpenStack; its associated interface number is -1 (heatPublicInterface)
// Example:
// MGMT on eth0, DATA1 on eth1
// Networks.heatNetworks['MGMT']=0  Networks.heatNetworks['DATA1']=1 Networks.heatNetworks['PUBLIC']=-1
// Networks.devices['MGMT']='eth0'  Networks.devices['DATA1']='eth1'
Networks.getNickname = function(iNetwork){
  var nickname='';
  if(Networks.heatNetworks['MGMT'] == iNetwork) nickname="mgmt";
  if(Networks.heatNetworks['DATA1'] == iNetwork) nickname="data1";
  if(Networks.heatNetworks['DATA2'] == iNetwork) nickname="data2";
  if(Networks.heatNetworks['DATA3'] == iNetwork) nickname="data3";
  if(Networks.heatNetworks['DATA4'] == iNetwork) nickname="data4";
  return nickname;  
}
        
Networks.build = function(target, engine){
	var nameIndexes = Networks.nameIndexes;
	var result = '\n';
	Networks.check = "";
	var table = document.getElementById('Networks');
	var rowCount = table.rows.length;
	Networks.heatNetworks = new Array();
	Networks.devices = new Array();
	Networks.heatMaxNetwork = 0;
  Networks.heatMinNetwork = 256;
	var networkCount = Number(Networks.count('interface'));
	if(target == 'openstack')networkCount--; // For openstack target, do not count the public interface in the quota, it is a 'pseudo interface', not actually instantiated
	Networks.heatWidth = undefined;
  Networks.prefix=undefined;
	
	if(Networks.count('network', 'MGMT') != 1)Networks.check += "\nNetworks: one and only one MGMT is required";
	Networks.check += checkDependency(target == 'openstack', [Networks.count('network', 'PUBLIC') > 0 ],  "Networks: missing PUBLIC pseudo interface; ", "required for OpenStack Heat target");
	['DATA1', 'DATA2', 'DATA3', 'DATA4'].forEach(function(name){
		if(Networks.count('network', name) > 1)Networks.check += "\nNetworks: concurrent definitions of "+name+" detected";
	});

	result += '\n# ------------------------------- #';
	result += '\n# Network interfaces definition   #';
	result += '\n# ------------------------------- #';
  var ethN=0;
  var defaultPrefix='eth';
	for(var i=1; i < rowCount; i++){
    var networkName=Networks.getAndSetSelection(table.rows[i], nameIndexes, 'network');
		var networkDevice=Networks.getAndSetValue(table.rows[i], nameIndexes, 'interface',networkName!='PUBLIC'?defaultPrefix+ethN++:'');
		var networkMask=Networks.getAndSetValue(table.rows[i], nameIndexes, 'mask');
		
		if(networkName == ""){
			Networks.check += "\nNetworks: undefined network name for interface " + networkDevice;
			continue;
		}
    if(!Networks.prefix){
      // Prefix undefined: use the first one as the rule
      defaultPrefix=Networks.prefix=networkDevice.substring(0, networkDevice.search(/\d/));
    }
    
		// Check netmask consistency but allow the legacy placeholder
		if(networkMask != "@netmask@")networkMask.split('.').forEach(function(e,i,t){
			var aByte = Number(e);
			if(isNaN(aByte) || aByte < 0 || aByte > 255 )Networks.check += "\nNetworks: invalid netmask " + networkMask + " for interface " + networkDevice + "; expecting positive integer <= 255, found "+e;
		});
		if(networkDevice != ""){
			result += '\n#'+networkName+'_DEVICE='+networkDevice;
			result += '\n#'+networkName+'_NETMASK='+networkMask;
			Networks.devices[networkName]=networkDevice;
			
			// Ensure consistency prefix and extract the interface number
        if(!networkDevice.startsWith(defaultPrefix))Networks.check += "\nNetworks: " + networkDevice + " has an inconsistent prefix: " + defaultPrefix +" expected";
        var candidate = networkDevice.substr(defaultPrefix.length);
        var interfaceNumber = Number(candidate);
        if(isNaN(interfaceNumber)){
          Networks.check += "\nNetworks: illegal value for interface number "+networkName+" : "+candidate+"; expecting integer";
          continue;
        } 
        if(target == 'azure' && engine == 'ansible' || target == 'openstack' || target == 'kubernetes'){
				// openstack deployments: all networks have the same width: guess it from the first netmask proposed 
				if(Networks.heatWidth ==  undefined){
					// Use the 4th byte of the mask as the source for network width
					var cidr=Number(networkMask.split('.')[3]);
					// Use the closest integer
					Networks.heatWidth = Math.floor(Math.log(256 - cidr)/Math.log(2));
					Networks.heatMaxInterfaces=Math.pow(2, 8-Networks.heatWidth);
					Networks.heatCidrLength=Number(32-Networks.heatWidth).toString();
					Networks.heatMaxNodes=Math.pow(2, Networks.heatWidth);
					Networks.heatMask="255.255.255."+Number(256-Networks.heatMaxNodes).toString();
					if(networkCount > Networks.heatMaxInterfaces)Networks.check += "\nNetworks: network count limited by the netmask "+Networks.heatMask+" for "+target+" target to " + Networks.heatMaxInterfaces + ": found " + networkCount;
				}
				Networks.heatNetworks[networkName] = interfaceNumber;
				Networks.heatMinNetwork = Math.min(Networks.heatMinNetwork,interfaceNumber);
        Networks.heatMaxNetwork = Math.max(Networks.heatMaxNetwork,interfaceNumber);
				if(networkMask !== Networks.heatMask)Networks.check += "\nNetworks: netmask for "+target+" target cannot be larger than " + Networks.heatMask + ": found " + networkMask + " on interface " + networkName;
			}
		}
	}
	
	Networks.check += checkDependency(target == 'kubernetes' || target == 'azure' || target == 'aws', [Networks.heatMaxNetwork == 0], "Networks: "+target+" infrastructure is limited to one single network; found ", Networks.heatMaxNetwork + 1); 

	// update visible networks in the nodes table
	Nodes.hideUnused();

	// local check
	if(Networks.check != "")result = Networks.check;
	
	return result;
}
