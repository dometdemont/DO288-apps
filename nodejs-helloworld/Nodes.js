// ===========================
// Nodes resource
// ===========================
var Nodes= new vnfResource("Nodes", [
	{name:'MGMT fqdn', type:'text', width: '120px'}, 
	{name:'MGMT IP addr', type:'text', width: '120px'},
	{name:'PUBLIC IP addr', type:'text', width: '120px'},  
  {name:'DATA1 fqdn', type:'text'}, 
  {name:'DATA1 IP addr', type:'text'}, 
  {name:'DATA2 fqdn', type:'text'}, 
  {name:'DATA2 IP addr', type:'text'}, 
  {name:'DATA3 fqdn', type:'text'}, 
  {name:'DATA3 IP addr', type:'text'}, 
  {name:'DATA4 fqdn', type:'text'}, 
  {name:'DATA4 IP addr', type:'text'}, 
  {name:'UPF', type:'bool'}, 
  {name:'UPFrouter', type:'bool'},
  {name:'Master', type:'bool'},
	{name:'Etcd', type:'bool'},
	{name:'Worker', type:'bool'},
	{name:'Tester', type:'bool'},
	{name:'Flavor', width:'120px', type:'choice', choices:['','flavorTiny','flavorSmall', 'flavorStandard', 'flavorLarge','flavorPerformance']},
	{name:'Image', type:'text', width: '200px'}, 
  {name:'Volume', type:'bool'}, 
  {name:'Python3', type:'bool'}
	]
	);
	
Nodes.help = function(){
	return `OpenStack Nodes and roles definition and assignment
- MGMT fqdn: The domain name used in fqdn should be consistent with the infrastructure settings: on OpenStack, the domain is typically: localdomain
- MGMT IP addr: use a question mark on OpenStack (dynamic allocation)
- PUBLIC IP addr: external IP address for this nodes; use a question mark on OpenStack (dynamic allocation)
- DATA1-4 fqdn: the name of this node on the DATA1-4 network interface
- DATA1-4 IP addr: the IP address of this node on the DATA1-4 network interface; use a question mark on OpenStack (dynamic allocation)
- UPF: Casa UPF node: receives a specific configuration file /fdsk/startup-config defining network interfaces, NRF and mobile network and country codes
  - network interfaces are retrieved at runtime from OpenStack resources instantiation
  - NRF is defined in the Misc section as an IP address, a port and an interface number; 
    the IP address specified in the Misc section can be a templated variable referring to an OpenShift API floating IP as ~ocp_API~ where ocp is the name of the OpenShift cluster defined in the OpenShiftNodes section 
  - mobile network and country codes are defined in the Misc section
- Master/Etcd/Worker: the role(s) played by this node in the OpenShift 3.x cluster    
  If no box is checked, the node is instantiated but not part of the OpenShift cluster, available for any specific usage.
- Tester: node hosting the nodejs application used as HPE network functions tester    
  This application is cloned from github using the Misc section entries tester_git_url and optionally tester_deploy_key
- Flavor: shortcut defining the resources allocated for this node; mapping to the actual flavor for the target infrastructure is based on the Flavors section
- Image or Volume: depending on the Volume boolean: either 
  - name of the qcow2 image if Volume is unchecked, or 
  - ID of the volume used to instantiate this node in OpenStack. The volume size is set in the Misc section, openstack_volume_size property
- Python3: check this box if this image is running Python3, so that ansible can manage the compatibility break

NOTE: all IP addresses dynamically allocated are available in the OpenStack Heat ouput, attribute ports, with the naming: "~node_network~": "IP address"
Example with 3 nodes large, medium, small on 4 networks MGMT/DATA1-3
{
  "~large_mgmt~": "192.168.199.5", 
  "~large_pub~": "30.118.0.22", 
  "~medium_data2~": "192.168.199.73", 
  "~small_data2~": "192.168.199.88", 
  "~small_data3~": "192.168.199.102", 
  "~medium_pub~": "30.118.0.77", 
  "~medium_data3~": "192.168.199.121", 
  "~small_pub~": "30.118.0.86", 
  "~small_mgmt~": "192.168.199.13", 
  "~large_data2~": "192.168.199.75", 
  "~large_data3~": "192.168.199.103", 
  "~small_data1~": "192.168.199.38", 
  "~medium_mgmt~": "192.168.199.16", 
  "~large_data1~": "192.168.199.44", 
  "~medium_data1~": "192.168.199.49"
} 
-  
`;
}

// Build the Nodes section of the descriptor
// - target is the optional infrastructure: openstack
// - engine is the optional underlying engine: ansible
// If the target is set, the unknown ip addresses defined as question marks are prepared as place holders for replacement at deployment time 
// The place holder format depends on the type of engine:
Nodes.build = function(target, engine){
	var oc_version=document.getElementById("oc_version").value;
	
	// Consistency checks reset
	consistency.initSingle();
	Nodes.check = "";
	
	var nameIndexes = Nodes.nameIndexes;
	var result = "\n";
	var table = document.getElementById("Nodes");
	var rowCount = table.rows.length;
	
	var cloudNodes = new Array();
	var masterNodes = new Array();
	var workerNodes = new Array();
	var etcdNodes = new Array();
	var testerNodes = new Array();
	
	result += "\n# ------------------------------- #";
	result += "\n# Nodes and roles definition      #";
	result += "\n# ------------------------------- #";
	for(var i=1; i < rowCount; i++){
		
		var row = table.rows[i];
		
		// Read the network definitions 'MGMT', 'PUBLIC'
		var nodeName		=	Nodes.getAndSetValue(row, nameIndexes, 'MGMT fqdn');
		var nodeIpAddr		=	Nodes.getAndSetValue(row, nameIndexes, 'MGMT IP addr');
		var nodePubIpAddr	=	Nodes.getAndSetValue(row, nameIndexes, 'PUBLIC IP addr');
		if(nodeName == "" || nodeIpAddr == ""){
			Nodes.check += "\nNodes section: MGMT FQDN and IP address are required";
			break;
		}
    var nodeData1Name  = Nodes.getAndSetValue(row, nameIndexes, 'DATA1 fqdn');
    var nodeData1IpAddr  = Nodes.getAndSetValue(row, nameIndexes, 'DATA1 IP addr');
    var nodeData2Name  = Nodes.getAndSetValue(row, nameIndexes, 'DATA2 fqdn');
    var nodeData2IpAddr  = Nodes.getAndSetValue(row, nameIndexes, 'DATA2 IP addr');
    var nodeData3Name  = Nodes.getAndSetValue(row, nameIndexes, 'DATA3 fqdn');
    var nodeData3IpAddr  = Nodes.getAndSetValue(row, nameIndexes, 'DATA3 IP addr');
    var nodeData4Name  = Nodes.getAndSetValue(row, nameIndexes, 'DATA4 fqdn');
    var nodeData4IpAddr  = Nodes.getAndSetValue(row, nameIndexes, 'DATA4 IP addr');

		// Read the roles definition
    var isUPF  = Nodes.getAndSetChecked(row, nameIndexes, 'UPF');
    var isUPFrouter  = Nodes.getAndSetChecked(row, nameIndexes, 'UPFrouter');
		var isMaster	=	Nodes.getAndSetChecked(row, nameIndexes, 'Master');
		var isWorker	=	Nodes.getAndSetChecked(row, nameIndexes, 'Worker');
		var isEtcd		=	Nodes.getAndSetChecked(row, nameIndexes, 'Etcd');
		var isTester	=	Nodes.getAndSetChecked(row, nameIndexes, 'Tester');
    var python3  = Nodes.getAndSetChecked(row, nameIndexes, 'Python3');
		
		// Read the preferred image and flavor
		var image=Nodes.getAndSetValue(row, nameIndexes, 'Image', 'Cent OS 7');
    var volume=Nodes.getAndSetChecked(row, nameIndexes, 'Volume');
		var flavor=Nodes.getAndSetSelection(row, nameIndexes, 'Flavor');

    // Only OpenShift 3 can be deployed as a set of individual nodes from the Nodes section
    Nodes.check+=checkDependency(isMaster || isEtcd || isWorker, [oc_version.startsWith('3')], "Nodes: the node "+nodeName," cannot be deployed as a member of an OpenShift "+oc_version+" cluster: select version 3.x in the Build pane, or use the OpenShiftNodes section");
    
		// co-location checks
		Nodes.check += checkDependency(isEtcd, [isWorker && isMaster, !isWorker ],  "Nodes: on node "+nodeName,", etcd and worker roles colocation requires a master role as well.");
		Nodes.check += checkDependency(isMaster, [isWorker && isEtcd, !isWorker ],  "Nodes: on node "+nodeName,", master and worker roles colocation requires an etcd role as well.");
		// Tester requirements checks
		Nodes.check += checkDependency(isTester, [Misc.search('Property','tester_nodejs_version') && Misc.search('Property','tester_git_url')], "Nodes vs Misc: on node "+nodeName,", the tester role requires two entries in Misc: tester_nodejs_version and tester_git_url"); 
    Nodes.check += checkDependency(isMaster, [!isUPF],  "Nodes: on node "+nodeName,", master and UPF roles colocation is not supported.");
    Nodes.check += checkDependency(isUPFrouter, [!isUPF],  "Nodes: on node "+nodeName,", UPF router and UPF roles colocation is not supported.");
		
    // Trace this new node as a comment
    result+="\n# "+nodeName+"@"+nodeIpAddr+(nodePubIpAddr?"@"+nodePubIpAddr:"")+(isUPF?" Casa UPF":"")+(isUPFrouter?" Casa UPF router":"")+(isMaster||isWorker||isEtcd?" OpenShift"+oc_version:"")+(isMaster?"-master":"")+(isWorker?"-worker":"")+(isEtcd?"-etcd":"")+(isTester?" tester":"")+" running "+(volume?"volume ":"image ")+image+" on flavor: "+(flavor?flavor:"default")+(python3?" with Ansible interpreter Python3":"");
    
		// Collect the short name of this node in the short names array for openstack template build
		var shortName = nodeName.substr(0, nodeName.indexOf('.'));
		var theCloudNode = new cloudNode(shortName, nodeName);
		
		switch(target){
		  case 'openstack': case 'vmware':
			// IP addresses will be known at instantiation time: 
			// Replace undefined values with place holders resolved later
			// Push the network interface number in the interfaces list for this node
			if(nodeIpAddr == "?")		{nodeIpAddr="~"+shortName+		"_mgmt~";	theCloudNode.interfaces.push(Networks.heatNetworks['MGMT']);}
			if(nodePubIpAddr == "?")	{nodePubIpAddr="~"+shortName+	"_pub~";	theCloudNode.interfaces.push(heatPublicInterface);}
      if(nodeData1IpAddr == "?") {nodeData1IpAddr="~"+shortName+  "_data1~"; theCloudNode.interfaces.push(Networks.heatNetworks['DATA1']);}
      if(nodeData2IpAddr == "?") {nodeData2IpAddr="~"+shortName+  "_data2~"; theCloudNode.interfaces.push(Networks.heatNetworks['DATA2']);}
      if(nodeData3IpAddr == "?") {nodeData3IpAddr="~"+shortName+  "_data3~"; theCloudNode.interfaces.push(Networks.heatNetworks['DATA3']);}
      if(nodeData4IpAddr == "?") {nodeData4IpAddr="~"+shortName+  "_data4~"; theCloudNode.interfaces.push(Networks.heatNetworks['DATA4']);}
			break;
		}
		
		var nodeNames		= new Array();
		var nodeIpAddresses	= new Array();
		nodeNames['MGMT'] 		=	nodeName;
		nodeIpAddresses['MGMT']	=	nodeIpAddr;
    nodeNames['DATA1']   = nodeData1Name;
    nodeIpAddresses['DATA1'] = nodeData1IpAddr;
		nodeNames['DATA2']   = nodeData2Name;
    nodeIpAddresses['DATA2'] = nodeData2IpAddr;
    nodeNames['DATA3']   = nodeData3Name;
    nodeIpAddresses['DATA3'] = nodeData3IpAddr;
    nodeNames['DATA4']   = nodeData4Name;
    nodeIpAddresses['DATA4'] = nodeData4IpAddr;
    
		// Push this node as per the defined roles with the most demanding flavor, using the public IP address if defined, or the fqdn otherwise
		// NOTE: the master is always a worker node but with specific labels
		// Depending on the OpenShift version, the inventory varies
		function oc_node(host, ip, type){
			var result='';
			switch(oc_version){
			case '3.11': result=host+" openshift_ip="+ip+" openshift_node_group_name='"+type+"'"; break;
			case '3.9': 
				result=host+" openshift_hostname="+ip+" openshift_ip="+ip;
				if(type.indexOf('node-config-compute') != 0)result+=" openshift_node_labels=\"{'region': 'infra', 'zone': 'default'}\"";
				if(type.indexOf('node-config-infra') != 0)result+=" openshift_schedulable=true";
			}
			return result;
		}
		var hostEntry=nodePubIpAddr;
		if(!hostEntry)hostEntry=nodeName
		if(isEtcd){
			if(!isWorker && !isMaster)workerNodes.push(oc_node(hostEntry, nodeIpAddr, 'node-config-infra'));
			etcdNodes.push(hostEntry); 
			theCloudNode.flavor='flavorSmall';
		}
		if(isWorker && !isMaster){
			workerNodes.push(oc_node(hostEntry, nodeIpAddr, 'node-config-compute')); 
			theCloudNode.flavor='flavorStandard';
		}
		if(isMaster){
			// Take the first master node as the ems
			if(masterNodes.length == 0)theCloudNode.isEms = true;
			masterNodes.push(hostEntry); 
			if(!isEtcd && !isWorker)workerNodes.push(oc_node(hostEntry, nodeIpAddr, 'node-config-master'));
			if(isEtcd && !isWorker)workerNodes.push(oc_node(hostEntry, nodeIpAddr, 'node-config-master-infra')); 
			if(isEtcd && isWorker)workerNodes.push(oc_node(hostEntry, nodeIpAddr, 'node-config-all-in-one'));
			theCloudNode.flavor='flavorLarge';
		}
    theCloudNode.isUPF=isUPF;
    theCloudNode.isUPFrouter=isUPFrouter;
		theCloudNode.isTester=isTester;
    theCloudNode.python=python3?"/usr/bin/python3":"/usr/bin/python";
		
		// Default image from the user environment
		theCloudNode.image="{ get_param: Image }";
		
		// Force the preferred image and flavor if defined
		if(flavor)theCloudNode.flavor=flavor;
		if(image)theCloudNode.image=image;
    if(volume)theCloudNode.volume=volume;
		
		// For infrastructure where IP addresses are statically allocated (vmware, static)
		theCloudNode.ipAddresses = nodeIpAddresses;
		
		// co-location and dependency checks
			
		cloudNodes.push(theCloudNode); 
	}
	// End of for loop on the list of nodes
	
	// Allow non OpenShift deployment, instances only
	if(masterNodes.length+workerNodes.length+etcdNodes.length > 0){
	if(masterNodes.length < 1)Nodes.check += "\nNodes section: missing at least one master node";
	if(workerNodes.length < 1)Nodes.check += "\nNodes section: missing at least one worker node";
	if(etcdNodes.length < 1)Nodes.check += "\nNodes section: missing at least one etcd node";
	
	// Inventory roles sections
	result += "\n[masters]";
	result += "\n"+masterNodes.join("\n");
	result += "\n[nodes]";
	result +="\n"+workerNodes.join("\n");
	result += "\n[etcd]";
	result +="\n"+etcdNodes.join("\n");

	// Ansible variables
	result += "\n[OSEv3:vars]";
	result += "\nopenshift_deployment_type=origin";
	result += "\nopenshift_disable_check=memory_availability,disk_availability,docker_image_availability";
	result += "\nopenshift_ip="+masterNodes[0];
	result += "\nansible_service_broker_install=false";
	result += "\nopenshift_master_cluster_hostname="+masterNodes[0];
	result += "\nopenshift_master_cluster_public_hostname="+masterNodes[0];
	result += "\nopenshift_public_hostname="+masterNodes[0];
	result += "\nopenshift_metrics_hawkular_hostname="+etcdNodes[0];
	result += "\nopenshift_metrics_install_metrics=true";
	result += "\nopenshift_metrics_image_version=v"+oc_version;
	result += "\ntemplate_service_broker_selector={\"region\":\"infra\"}";
	result += "\n[OSEv3:children]";
	result += "\nmasters";
	result += "\nnodes";
	result += "\netcd";
	}

	// Make the list of nodes for availableHeat template  
	Nodes.cloudNodes = cloudNodes.slice();
	
	// check the network width limitation compared to the number of non VIP openstack nodes
	var nonVipHeatNodes = cloudNodes.length;
	if(nonVipHeatNodes > Networks.heatMaxNodes)Nodes.check += "\nNodes vs Networks section: too many nodes for openstack deployments: found: "+nonVipHeatNodes+"; with a netmask "+Networks.heatMask+", the limit is : "+Networks.heatMaxNodes;
	
	// local check
	if(Nodes.check != "")result = Nodes.check;

	return result;
}

// Hides unused networks columns
Nodes.hideUnused = function(){
	['PUBLIC', 'DATA1', 'DATA2', 'DATA3', 'DATA4'].forEach(function(interface){
		// Check consistency first: reject hiding Networks interfaces with non empty columns in Nodes
		var fqdnColName=interface+' fqdn'; var ipAddrColName=interface+' IP addr';
		var nUsed=Nodes.count(fqdnColName)+Nodes.count(ipAddrColName) ; 
		var checkInterface = checkDependency(! Networks.search('network', interface), [nUsed== 0], 'Networks vs Nodes: ', 'Missing '+interface+' network interface definition : required '+nUsed+' times in the Nodes table.');
		if(checkInterface == ""){
			Nodes.display(fqdnColName, Networks.search('network', interface));
			Nodes.display(ipAddrColName, Networks.search('network', interface));
		}else Networks.check+=checkInterface;
	});
	
  // Hide OpenShift 3 specific check boxes if target is OpenShift 4
  var oc_version=document.getElementById("oc_version").value;
  Nodes.display('Master', oc_version!="4.x"); Nodes.display('Etcd', oc_version!="4.x"); Nodes.display('Worker', oc_version!="4.x")
};

// Special nodes
// UPF:
// UPF is a network function running as an OpenStack instance, instantiated from a specific image. This instance expects a startup configuration file /fdsk/startup-config
// name: the hostname of this UPF instance
// UPFports: definition of the network ports as a block of text, built from the Nodes.UPFport function
// From the Misc section:
// - UPFpassword: the password
// - UPFNRFip: the NRF IP address
// - UPFNRFinterface: the network interface number to use to access NRF 
// - UPFNRFport: the NRF port
// - UPFmcc/mnc: mobile codes
// - UPFcidr: PDU range
Nodes.UPFconfig = function(name, UPFports){
  // NRF end point: default from the Misc section, prefer the FIP API of the associated OpenShift cluster
  var nrfFip=Misc.getValue('UPFNRFip');
  // is this UPF node associated to an OCP instance?
  var iOCP=OpenShiftNodes.instances.UPF.indexOf(name);
  if(iOCP>=0){
    // Use the FIP API of this OCP
    nrfFip="~"+OpenShiftNodes.instances.name[iOCP]+"_API~";
  }
  var mcc=Misc.getValue('UPFmcc');
  var mnc=Misc.getValue('UPFmnc');
  var tac=Misc.getValue('UPFtac');
  // tac is a list of comma separated values: each value results in one lie in the user-plane-service section: tai mcc mnc tac
  var tacList="user-plane-service upf";
  tac.split(',').forEach(function(t){tacList+="\n tai mcc "+mcc+" mcn "+mnc+" tac "+t});
return `
cat > /fdsk/startup-config << CASA_STARTUP_CONFIG
! CASA-MOBILE system running configuration
!
hostname "`+name+`"
!
password encrypted `+Misc.getValue('UPFpassword')+`
!
!
`+UPFports.join('')+`
interface loopback `+UPFports.length+`

ip route 0.0.0.0/0

gtpu-profile gtp-u-prof0
   echo-disable
   end

pfcp-profile hb-prof0
   heartbeat disable
   end

`+tacList+`

 access
   interface name gige 0/3
   gtpu-profile gtp-u-prof0
   exit
 pfcp
   interface name gige 0/1
   pfcp-profile hb-prof0
   exit
 nrf-agent
   interface name gige 0/`+Misc.getValue('UPFNRFinterface')+`
   nrf-addr ip `+nrfFip+`
   nrf-port `+Misc.getValue('UPFNRFport')+`
   exit
 identity
   plmn mcc `+Misc.getValue('UPFmcc')+` mnc `+Misc.getValue('UPFmnc')+`
   locality locality_1
   smf-service-areas srv_area_1
   smf-service-areas srv_area_2
   smf-service-areas srv_area_3
   fqdn `+name+`
   exit
 network-slice sst 1 sd ab2112
   dnn inet1
     ip pool smf-pool1 type ipv4 `+Misc.getValue('UPFcidr')+`
     ip pool smf-pool1-ipv6 type ipv6 2002:2207:2323::/56
     exit
   exit
 exit

!end of configuration
CASA_STARTUP_CONFIG`;
}
// UPF router nating traffic from mgmt interface to upf on the nat interface
Nodes.UPFrouterConfig= function(name){
  // Target upf defaults to the Misc section entry
  //  If this router is associated to an OCP, use the UPF associated to this same OCP
  var upf=Misc.getValue('UPFrouted');
  var iOCP=OpenShiftNodes.instances.UPFrouter.indexOf(name);
  if(iOCP>=0){
    upf=OpenShiftNodes.instances.UPF[iOCP];
  }
  // Reduce to the short name
  if(upf.indexOf('.')>=0)upf=upf.substr(0, upf.indexOf('.'));
  var mgmt=Networks.devices['MGMT'];
  var nat=Networks.devices[Misc.getValue('UPFnat')];
  var upfip="~"+upf+"_"+Networks.getNickname(Networks.heatNetworks[Misc.getValue('UPFnat')])+"~";
return `
cat > /etc/network/interfaces.d/60-cloud-init.cfg << EOF_CLOUD_INIT
auto `+nat+`
iface `+nat+` inet dhcp
  post-up ip route add `+Misc.getValue('UPFcidr')+` via `+upfip+`
EOF_CLOUD_INIT
service networking restart
sysctl -w net.ipv4.ip_forward=1
iptables -t nat -A POSTROUTING -o `+mgmt+` -j MASQUERADE
iptables -A FORWARD -i `+mgmt+` -o `+nat+` -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A FORWARD -i `+nat+` -o `+mgmt+` -j ACCEPT`;
}
// Template for one UPF network interface
// i is an integer identifying the interface number
// ip is the IP address on this interface
Nodes.UPFports = function(i, ip){ 
  return `
interface gige 0/`+i+`
  ip address `+ip+" "+Networks.heatMask+`
  auto negotiate
  no shutdown
`;
}

    