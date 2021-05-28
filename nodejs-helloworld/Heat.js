// =============================
// OpenShift openstack template build
// =============================
function buildHeatTemplate(){
	var oc_version=document.getElementById("oc_version").value;
	
	// Build the inventory for openstack (or get the errors) and do not publish
	// Required soon enough to get openstack specific variables properly setup
  var openshift = buildInventory('openstack');
	if(openshift.length == 0)return '';
  var useHeatVolumes = Misc.getValue('openstack_volume_size');
    
	var n0="\n";
	var quickDescription = document.getElementById("quickDescription");
	var heat="heat_template_version: 2013-05-23"
	  heat+=n0+"description: '"+quickDescription.value+"'";
  	heat+=n0+"parameters:";
	heat+=n0+"  NetworkRoot:";
    heat+=n0+"    type: string";
    heat+=n0+"    label: Private network";
    heat+=n0+"    description: 3 dot separated bytes defining the 24 first bits of the internal networks, e.g. 192.168.100";
    heat+=n0+"    default: 192.168.100";
	heat+=n0+"  Image:";
    heat+=n0+"    type: string";
    heat+=n0+"    description: The name of the image used to instantiate storage on nodes";
    heat+=n0+"    default: 'Centos 7.6'";
  	heat+=n0+"  ExternalNetwork:";
    heat+=n0+"    type: string";
    heat+=n0+"    description: The name of the external public network used to connect floating IPs";
    heat+=n0+"    default: "+Misc.getValue('extnet');
    heat+=n0+"  SecurityGroup:";
    heat+=n0+"    type: string";
    heat+=n0+"    description: The name of the security group attached to the instances";
    heat+=n0+"    default: "+Misc.getValue('openstack_security_group');
    heat+=n0+"  AvailabilityZone:";
    heat+=n0+"    type: string";
    heat+=n0+"    label: Availability zone";
    heat+=n0+"    description: The name of the zone hosting the nodes";
    heat+=n0+"    default: nova";
    heat+=n0+"  flavorTiny:";
    heat+=n0+"    type: string";
    heat+=n0+"    description: The name of the openstack flavor used to build tiny nodes";
    heat+=n0+"    default: "+Flavors['openstack']['flavorTiny'].name;
    heat+=n0+"  flavorSmall:";
    heat+=n0+"    type: string";
    heat+=n0+"    description: The name of the openstack flavor used to build small nodes";
    heat+=n0+"    default: "+Flavors['openstack']['flavorSmall'].name;
    heat+=n0+"  flavorStandard:";
    heat+=n0+"    type: string";
    heat+=n0+"    description: The name of the openstack flavor used to build standard nodes";
    heat+=n0+"    default: "+Flavors['openstack']['flavorStandard'].name;
	heat+=n0+"  flavorPerformance:";
    heat+=n0+"    type: string";
    heat+=n0+"    description: The name of the openstack flavor used to build performance nodes";
    heat+=n0+"    default: "+Flavors['openstack']['flavorPerformance'].name;
  	heat+=n0+"  flavorLarge:";
    heat+=n0+"    type: string";
    heat+=n0+"    description: The name of the openstack flavor used to build large nodes";
    heat+=n0+"    default: "+Flavors['openstack']['flavorLarge'].name;
	heat+=n0+"  key_name:";
    heat+=n0+"    type: string";
    heat+=n0+"    description: the ssh key injected in the instances for remote access";
    heat+=n0+"    default: ''";
    if(useHeatVolumes){
	heat+=n0+"  VolumeSize:";
    heat+=n0+"    type: number";
    heat+=n0+"    description: The size in Gb of the volumes attached to the nodes.";
    heat+=n0+"    default: "+useHeatVolumes;
	}
	heat+=n0;
	heat+=n0+"resources:";
	
	// Create networks from Networks.heatNetworks array: 
	// The networks are to be created in the interface number order to ensure that ethX is actually connected to interface X
	// One common router
	heat+=n0+"  Router:";
    heat+=n0+"    type: OS::Neutron::Router";
    heat+=n0+"    properties:";
    heat+=n0+"      admin_state_up: True";
    heat+=n0+"      name: { get_param : 'OS::stack_name' }";
	heat+=n0+"  Gateway:";
    heat+=n0+"    type: OS::Neutron::RouterGateway";
    heat+=n0+"    properties:";
    heat+=n0+"      network: { get_param: ExternalNetwork }";
    heat+=n0+"      router_id: { get_resource: Router }";

	var mgmtName = Networks.getNickname(Networks.heatNetworks['MGMT']); 
  for(var i = Networks.heatMinNetwork; i <= Networks.heatMaxNetwork; i++){
	var interfaceName = Networks.getNickname(i);	// network name, Networks.heatMaxNodes addresses large
	var cidr = Networks.heatMaxNodes*(i-Networks.heatMinNetwork);		// first address in this network
	var gateway = cidr + 1;	// gateway IP for this network
	heat+=n0+"  "+interfaceName+":";
    heat+=n0+"    type: OS::Neutron::Net";
    heat+=n0+"    properties:";
	heat+=n0+"      name: {list_join: [ '-', ['"+interfaceName+"', { get_param : 'OS::stack_name' }]]}";
	heat+=n0+"  "+interfaceName+"-subnet:";
    heat+=n0+"    type: OS::Neutron::Subnet";
    heat+=n0+"    properties:";
    heat+=n0+"      name: {list_join: [ '-', ['"+interfaceName+"', { get_param : 'OS::stack_name' }]]}";
    heat+=n0+"      enable_dhcp: True";
    heat+=n0+"      network: { get_resource: "+interfaceName+" }";
    heat+=n0+"      cidr: { list_join: [ '.', [{ get_param : NetworkRoot}, '"+cidr+"/"+Networks.heatCidrLength+"']]}";
    heat+=n0+"      gateway_ip: { list_join: [ '.', [{ get_param : NetworkRoot}, '"+gateway+"']]}";
    }

	// Connect the management network to the router for floating IPs  
	heat+=n0+"  Router-gw-int:";
    heat+=n0+"    type: OS::Neutron::RouterInterface";
    heat+=n0+"    properties:";
    heat+=n0+"      router_id: { get_resource: Router }";
    heat+=n0+"      subnet_id: { get_resource: "+mgmtName+"-subnet }";
    
    // addr will resolve all ip addresses parameters as a reference to their relative port
    var addr=""; 
    
    var nodesNames = Nodes.cloudNodes.map(function(e){return e.name;});
    
    // For each node: create the ports and optional associated floating IP on all networks, the volume and the instance
    nodesNames.forEach(function(name, indexNode){
    	// Create one port on every network to ensure proper interface numbering, but connect only used interfaces
    	// Prepare the ports declared in the instance as yaml instructions in this variable: port
    	var port="";
      // Prepare the UPF interface definitions as a table in this variable: UPFports
      var UPFports =new Array();
    	for(var iNetwork = Networks.heatMinNetwork; iNetwork <= Networks.heatMaxNetwork; iNetwork++){
			// VIP processing in Heat/OpenStack: 
			// - a VIP is instantiated as a port
			// - a VIP is declared as allowed_address_pairs on the load balancer nodes
	    	var interfaceName = Networks.getNickname(iNetwork);	
	    	var interfaceUp = "True";
	    	if(Nodes.cloudNodes[indexNode].interfaces.indexOf(iNetwork) == -1)interfaceUp = "False";
	    	heat+=n0+"  "+name+"-"+interfaceName+"-port:";
	    	heat+=n0+"    type: OS::Neutron::Port";
	    	heat+=n0+"    properties:";
	      	heat+=n0+"      admin_state_up : "+ interfaceUp;
	      	heat+=n0+"      network: { get_resource: "+interfaceName+" }";
          heat+=n0+"      security_groups: [{ get_param: SecurityGroup }]";

	      	// if this node has VIPs, add allowed_address_pairs accordingly
	      	if(Nodes.cloudNodes[indexNode].hasVIP){
	      		var allowed_address_pairs_header=n0+"      allowed_address_pairs:";
	      		// Search for VIPs on this interface on all nodes
	      		nodesNames.forEach(function(nameVIP, indexVIP){
	      			// if this node is a VIP
	      			if(Nodes.cloudNodes[indexVIP].isVIP){
	      				// This node is a VIP: add an allowed address for all concerned interfaces
	      				for(var iVIP = Networks.heatMinNetwork; iVIP <= Networks.heatMaxNetwork; iVIP++){
	      					// if this VIP is not defined on this interface or disconnected, continue
	      					if(iNetwork != iVIP || interfaceUp != "True")continue;
	      					// Enable this address in the firewall
	      					heat+=allowed_address_pairs_header;
	      					allowed_address_pairs_header=""; 
	      					heat+=n0+"        - ip_address: {get_attr: ["+nameVIP+"-"+Networks.getNickname(iVIP)+"-port, fixed_ips, 0, ip_address]}";
	      				} // add an allowed address for all concerned interfaces
	      			} // if this node is a VIP
	      		}); // Search for VIPs on this interface
	      	}// if this node has VIPs
	      	
	      	port+=n0+"        -";
	      	port+=n0+"          port: { get_resource: "+name+"-"+interfaceName+"-port}";
	      	
	      	// Resolve ip address for this port on this node as ~<node>_<network>~
          if(interfaceUp == "True"){
          var p="~"+name+"_"+interfaceName+"~";
          addr+=n0+p+": {get_attr: ["+name+"-"+interfaceName+"-port, fixed_ips, 0, ip_address]}";
         if(Nodes.cloudNodes[indexNode].isUPF)UPFports.push(Nodes.UPFports(iNetwork-Networks.heatMinNetwork, p));
          }
      	}
      	if(Nodes.cloudNodes[indexNode].interfaces.indexOf(heatPublicInterface) != -1){
	   		heat+=n0+"  "+name+"-"+mgmtName+"-floatingIP:";
	    	heat+=n0+"    type: OS::Neutron::FloatingIP";
	    	heat+=n0+"    properties:";
	      	heat+=n0+"      floating_network: { get_param: ExternalNetwork }";
	      	heat+=n0+"  "+name+"-"+mgmtName+"-floatingIPassociation:";
	    	heat+=n0+"    type: OS::Neutron::FloatingIPAssociation";
	    	heat+=n0+"    properties:";
	      	heat+=n0+"      port_id: { get_resource: "+name+"-"+mgmtName+"-port }";
	      	heat+=n0+"      floatingip_id: { get_resource: "+name+"-"+mgmtName+"-floatingIP }";
	      	// Resolve public ip addresses for this node
	      	addr+=n0+"~"+name+"_pub~: {get_attr: ["+name+"-"+mgmtName+"-floatingIP, floating_ip_address]}";
      	}
      	
      	// if this node is a VIP, neither volume nor instance are needed
      	if(!Nodes.cloudNodes[indexNode].isVIP){
        if(Nodes.cloudNodes[indexNode].volume){
        heat+=n0+"  "+name+"-Volume:";
        heat+=n0+"    type: OS::Cinder::Volume";
        heat+=n0+"    properties: ";
        heat+=n0+"      source_volid: "+Nodes.cloudNodes[indexNode].image;
        heat+=n0+"      name: {list_join: [ '-', ['"+name+"', { get_param : 'OS::stack_name' }]]}";
        heat+=n0+"      size: { get_param: VolumeSize }";
        }
      	heat+=n0+"  "+name+":";
      	heat+=n0+"    type: OS::Nova::Server";
      	heat+=n0+"    properties:";
      	heat+=n0+"      name: "+name;
      	if(Nodes.cloudNodes[indexNode].volume){
      	heat+=n0+"      block_device_mapping: [{ device_name: 'vda', volume_id : { get_resource: "+name+"-Volume } }]";
      	}else{
      	heat+=n0+"      image: "+Nodes.cloudNodes[indexNode].image; 
      	}
      	heat+=n0+"      flavor: { get_param: "+Nodes.cloudNodes[indexNode].flavor+" }";
      	heat+=n0+"      availability_zone: { get_param: AvailabilityZone }";
      	heat+=n0+"      key_name: { get_param: key_name }";
      	heat+=n0+"      networks:";
      	heat+=port;
    	}  	// if this node is a VIP, neither volume nor instance are needed
    	
      // if UPFports definition is to be injected
      if(UPFports.length){
      heat+=n0+"      config_drive: True";
      heat+=n0+"      user_data_format: 'RAW'";
      heat+=n0+"      user_data:";
      heat+=n0+"        str_replace:";
      heat+=n0+"          template: |";
      heat+=n0+"            #!/bin/bash";     
    
      // File dropped on the UPF as startup configuration
      heat+=Nodes.UPFconfig(Nodes.cloudNodes[indexNode].fqdn, UPFports).replace(/\n/g, "\n"+  
                     "            ");
      // Resolve ip addresses parameters preparation, differed when all ports are cumuluated in addr
      heat+=n0+"          params:~all_addresses_resolution~";
      } // UPF ports definition injection
      
      if(Nodes.cloudNodes[indexNode].isUPFrouter){
      heat+=n0+"      config_drive: True";
      heat+=n0+"      user_data_format: 'RAW'";
      heat+=n0+"      user_data:";
      heat+=n0+"        str_replace:";
      heat+=n0+"          template: |";
      heat+=n0+"            #!/bin/bash";     
    
      // File dropped on the UPF as startup configuration
      heat+=Nodes.UPFrouterConfig(Nodes.cloudNodes[indexNode].fqdn).replace(/\n/g, "\n"+  
                     "            ");
      // Resolve ip addresses parameters 
      heat+=n0+"          params:~all_addresses_resolution~";
      } // UPF router configuration injection
      
     	// On the ems (first master), push: the persistent volumes definition and the deployment script hpe5g.sh
		  // Exclude the openshift templates since their cumulated sizes could exceed the maximum allowed as raw data
		  // Openshift templates are passed as specific outputs, one per project
     	if(Nodes.cloudNodes[indexNode].isEms){
      heat+=n0+"      config_drive: True";
      heat+=n0+"      user_data_format: 'RAW'";
		  heat+=n0+"      user_data:";
		  heat+=n0+"        str_replace:";
	  	heat+=n0+"          template: |";
	  	heat+=n0+"            #!/bin/bash";	  	
		
	    // File dropped on the ems ready for deployment
	    heat+=n0+"            cat > /home/centos/openshift_volumes.yaml << 'EOFILE'";
	    // OpenShift system level functions: volumes
	    heat+=n0+'            kind: Template';
	    heat+=n0+'            apiVersion: template.openshift.io/v1';
	    heat+=n0+'            metadata:';
	    heat+=n0+'              name: system';
	    heat+=n0+'              annotations:';
	    heat+=n0+'                description: persistent volumes for '+document.getElementById("quickDescription").value;
	    heat+=n0+'            objects:';

		//  list of PersistentVolumes for openshift persistent storage as an OpenShift template ready to create
	    PersistentVolumes.openshiftVolumes.forEach(function(volume, i){
	    heat+=n0+'              - kind: "PersistentVolume"';
	    heat+=n0+'                apiVersion: "v1"';
	    heat+=n0+'                metadata:';
	    heat+=n0+'                  name: "'+volume.name+'"';
	    heat+=n0+'                spec:';
	    heat+=n0+'                  capacity:';
	    heat+=n0+'                    storage: "'+volume.size+'Gi"';
	    heat+=n0+'                  accessModes:';
	    heat+=n0+'                    - "'+volume.access+'"';
		heat+=n0+'                  persistentVolumeReclaimPolicy: '+volume.reclaim;
	    heat+=n0+'                  cinder:';
	    heat+=n0+'                    fsType: "'+volume.type+'"';
	    heat+=n0+'                    volumeID: "'+volume.cinder+'"';
	    });
	    heat+=n0+"            EOFILE";
	    heat+=n0+"            chown centos:centos /home/centos/openshift_volumes.yaml && chmod a+r /home/centos/openshift_volumes.yaml";

		// Shell script dropped on the ems node ready to deploy the volumes, projects, and hpe5g network functions 
		heat+=n0+"            cat > /home/centos/hpe5g.sh << 'EOFILE'";
		heat+=n0.concat(shellHeader(),shellBody('oc'),hpe5gUntemplatedDeploymentsScript(),hpe5gDeploymentScript())
		.replace(/\n/g, "\n"+  
	             '            ');	// fix the descriptor indentation as expected by Heat
		heat+=n0+"            EOFILE";
		heat+=n0+"            chown centos:centos /home/centos/hpe5g.sh && chmod a+rx /home/centos/hpe5g.sh";
	 	// Resolve cinder volumes Ids
	 	heat+=n0+"          params:";
	 	CinderVolumes.cloudVolumes.forEach(function(volume, i){
	    heat+=n0+"            ~cinderVolumeIdOf"+volume.name+"~: {get_resource: "+volume.name+"}";
	 	});
		// Resolve ip addresses parameters 
    heat+="~all_addresses_resolution~";    
	  } // if this node is the ems
    }); // For each node: create the resources
	// At that point, all ports are known, addresse resolution may happen
  addr=addr.replace(/\n/g, "\n"+  
         "            "); // fix the indentation as expected by Heat;    
  heat=heat.replace(/~all_addresses_resolution~/g, addr);
  
	// For each CinderVolume
	CinderVolumes.cloudVolumes.forEach(function(volume){
	heat+=n0+"  "+volume.name+":";
    heat+=n0+"    type: OS::Cinder::Volume";
    heat+=n0+"    properties: ";
    heat+=n0+"      name: "+volume.name;
    heat+=n0+"      size: "+volume.size;
    heat+=n0+"      description: "+volume.description;
	}); 
	
    // Add outputs:
    heat+=n0+"outputs:";
	// if an ems exists, publish the ansible inventory
	if(Nodes.cloudNodes.some(function(e){return e.isEms;})){
    heat+=n0+"  openshift_inventory:";
    heat+=n0+"    description: the ansible inventory deploying the openshift cluster";
    heat+=n0+"    value:";
    heat+=n0+"      str_replace:";
    heat+=n0+"        template: |";
	heat+=n0+"            "+openshift.replace(/\n/g, "\n"+  
		            "            ");	// fix the descriptor indentation as expected by tosca
	// Resolve ip addresses parameters 
    heat+=n0+"        params:"+addr.replace(/\n/g, "\n"+  
		     "          ");	// fix the descriptor indentation as expected by Heat
	}
    //  list of public nodes
    heat+=n0+"  public_nodes:";
    heat+=n0+"    description: List of hosts as a name, fqdn, public ip address and groups membership";
    heat+=n0+"    value:";
    // For each non VIP node having a public IP address, required for Ansible client access: publish the name, fqdn, public IP address and group 'base' plus 'ems' for the last node
    nodesNames.forEach(function(name, indexNode){ if(Nodes.cloudNodes[indexNode].isVIP || Nodes.cloudNodes[indexNode].interfaces.indexOf(heatPublicInterface) == -1)return;
    heat+=n0+"      -";
    heat+=n0+"        name: "+name;
    heat+=n0+"        fqdn: "+Nodes.cloudNodes[indexNode].fqdn;
    heat+=n0+"        ipaddress: {get_attr: ["+name+"-"+mgmtName+"-floatingIP, floating_ip_address]}";
    heat+=n0+"        groups: base";
    if(Nodes.cloudNodes[indexNode].isEms){heat+=",ems";}
    if(Nodes.cloudNodes[indexNode].isTester){heat+=",tester";}
    heat+=n0+"        python: "+Nodes.cloudNodes[indexNode].python;
    });
    //  list of all ports with their ip addresses
    heat+=n0+"  ports:";
    heat+=n0+"    description: List of IP addresses for all ports on all hosts";
    heat+=n0+"    value:"+addr.replace(/\n/g, "\n"+  
                   "      "); // fix the descriptor indentation
  // Misc section values
    heat+=n0+"  misc:";
    heat+=n0+"    description: set of miscellaneous properties used by the ansible deployment";
    heat+=n0+"    value:";
    heat+=n0+"      insecure_registries: '"+hpe5gResources.insecureRegistriesList+"'";
    heat+=n0+"      oc_version: "+oc_version;
    Misc.output.forEach(function(item, index){
    heat+=n0+"      "+item.name+": "+item.value;   	
    });
    
	// Add OpenShift templates to deploy if an ems is available
	heat+=n0+"  openshift_templates:";
    heat+=n0+"    description: set of OpenShift templates ready for deployment";
    heat+=n0+"    value:";
    if(Nodes.cloudNodes && Nodes.cloudNodes.some(function(e){return e.isEms;})){
    // OpenShift network functions and Helm instances, per project
	// File naming convention for Network functions and services: openshift_project_<project>.yaml
	// File naming convention for Helm instances: openshift_helm_<project>_<name>.yaml and a first line setting the context as bash variables: _HPE5G_name= _HPE5G_template= _HPE5G_options=
	function heatHeader(project){return "\nopenshift_project_"+project+":";}
	function heatHelmValuesHeader(project, name, template, options){
		return "\nopenshift_helm_"+project+"_"+name+":\n  _HPE5G_name="+name+" _HPE5G_template="+template+" _HPE5G_options='"+options+"'";
	}
	
	// List of NetworkFunctions deployed on openshift
	heat+=hpe5gNetworkFunctions(heatHeader,undefined,'  ').replace(/\n/g, "\n"+  
		     '      ');	// fix the descriptor indentation as expected by Heat
    // List of HelmCharts deployed on openshift
    heat+=hpe5gHelmValues(heatHelmValuesHeader,undefined,'  ').replace(/\n/g, "\n"+  
    	     '      ');	// fix the descriptor indentation as expected by Heat
	}
	
    return heat;
}

function outputHeatTemplate(){
 	var heat=buildHeatTemplate();
 	if(!heat)return false;
 	
 	// Show to the user and save to hpe5g.yaml
    userOutput(heat);
	
	// Stop there if headless, ie no user interface
	if(Misc.getValue('headless'))return true;
	
	var blobHeat = new Blob([heat], {type: "text/plain;charset=utf-8"});
	var a = document.createElement('a');
	a.href = window.URL.createObjectURL(blobHeat);
    a.download = "hpe5g.yaml";
    document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	return true;
}

//=================================
//Heat Stack deployer
//=================================
//Return a shell script deploying the Heat stack
function buildHeatStackDeployer(){
var heatTemplate=buildHeatTemplate();
if(!heatTemplate)return '';
var shell=`
_success_() {
	test -f $oc_stack.json && cat $oc_stack.json
}

# Ensure ansible availability and OpenStack environment setting
which ansible-playbook > /dev/null || _fail_ Missing ansible-playbook: please install ansible-playbook before deploying on OpenStack
test -f $OS_env && source $OS_env &>> $logfile || _fail_ Missing or failing OpenStack environment file $OS_env 
test -f $CLOUD_SSH_KEY || _fail_ Missing $CLOUD_SSH_KEY file: please review CLOUD_SSH_KEY environment variables in the OpenStack environment definition file $OS_env

# Environment expected by Ansible based deployments
export CLOUD_EXTERNAL_NETWORK=$\{CLOUD_EXTERNAL_NETWORK:-$EXTNET}
export ANSIBLE_REMOTE_USER=$CLOUD_DEFAULT_USER
export ANSIBLE_PRIVATE_KEY_FILE=$CLOUD_SSH_KEY

# Create the Heat stack file
cat > $oc_stack.yaml << 'EOFTEMPLATE' 2>> $logfile || _fail_ Cannot create $oc_stack.yaml
`+heatTemplate+`
EOFTEMPLATE

_log_ "$_displayedAction stack $oc_stack on OpenStack with network root $oc_network"
test -f $oc_stack.yaml || _fail_ "Missing Heat template $oc_stack.yaml"

# Apply the templated variables resolution to the Heat template, typically the API and APP floating IPs used in UPF
if test -n "$_templatedVariablesResolution" ; then 
  eval sed -i $oc_stack.yaml "$_templatedVariablesResolution" &>> $logfile || _fail_ OCP4 templated variables resolution sed -i $oc_stack.yaml "$_templatedVariablesResolution"
fi

# Clear the ssh known hosts cache
> ~/.ssh/known_hosts

# Clean the openshift ansible inventory to make sure it is not reused when missing in the current deployment
rm -f openshift-ansible/inventory/$oc_stack.yaml 2> /dev/null
> $oc_stack.json
ansible-playbook  hpe5g.ansible.yml --extra-vars "stack_name=$oc_stack the_template=$oc_stack.yaml the_network=$oc_network cachePatch=$PWD/ the_state=$state" &>> $logfile || _fail_ "OpenStack $_displayedAction of $oc_stack"
_log_ "$_displayedAction stack $oc_stack on OpenStack completed"
if [ $state == "present" ] ; then
 if test -f openshift-ansible/inventory/$oc_stack.yaml ; then
  _log_ "$_displayedAction OpenShift on stack $oc_stack using openshift-ansible/inventory/$oc_stack.yaml"
  if [ "$logfile" != "/dev/stdout" ] ; then _log_ "This takes a while, follow-up available in $logfile" ; fi
  ansible-playbook --extra-vars "openshift_epel_rpm_url=epel-release" -b -i openshift-ansible/inventory/$oc_stack.yaml openshift-ansible/playbooks/prerequisites.yml &>> $logfile && 
  ansible-playbook -b -i openshift-ansible/inventory/$oc_stack.yaml openshift-ansible/playbooks/deploy_cluster.yml &>> $logfile  || _fail_ "OpenShift cluster deployment" 
  eval $(grep ^openshift_ip openshift-ansible/inventory/$oc_stack.yaml) &>> $logfile && 
  ssh  -i $CLOUD_SSH_KEY centos@$openshift_ip "sudo cat /etc/origin/master/admin.kubeconfig" &>> $logfile > $oc_stack.kubeconfig  || _fail_ "Cannot retrieve kubeconfig from $openshift_ip /etc/origin/master/admin.kubeconfig"
  export KUBECONFIG=$oc_stack.kubeconfig && oc login -u guest -p guest &>> $logfile || _fail_ "Cannot login as guest with kubeconfig $oc_stack.kubeconfig to the cluster at $openshift_ip"
  _log_ "$_displayedAction OpenShift on stack $oc_stack completed: KUBECONFIG=$oc_stack.kubeconfig ; GUI https://$openshift_ip:8443"  
`;
 // OpenShift is deployed, ready or resource deployment, unless insecure registries are required by the deployed resources
 if(!hpe5gResources.insecureRegistriesList ){shell+=buildNetworkFunctions();}
 // Otherwise, invite the user to run the embedded installer
 else shell+=`
  _log_ "- Connect to OpenShift GUI as guest/guest" 
  _log_ "https://$openshift_ip:8443" 
  _log_ "- Connect to the first master" 
  _log_ "ssh -i $CLOUD_SSH_KEY centos@$openshift_ip" 
  _log_ "Login as guest: " 
  _log_ "oc login -u guest -p guest" 
  _log_ "Deploy HPE network functions:" 
  _log_ "./hpe5g.sh --log hpe5g.log" 
`;
shell+=`
 fi
 _success_
else
  # Undeployment of the OpenShift cluster done: exit now
  exit 0
fi
`;
return shell;
}
