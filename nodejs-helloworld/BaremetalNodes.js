// ===========================
// BaremetalNodes resource
// ===========================
var BaremetalNodes= new vnfResource("BaremetalNodes", [
  {name:'FQDN', type:'text', width: '200px'}, 
  {name:'Role', width:'120px', type:'choice', choices:['master','worker']},
  {name:'IPMI address', type:'text', width: '120px'},
  {name:'IPMI user', type:'text', width: '120px'},
  {name:'IPMI password', type:'text', width: '120px'},
  {name:'API VIP', type:'text', width: '120px'},
  {name:'Ingress VIP', type:'text', width: '120px'},
  {name:'Baremetal CIDR', type:'text', width: '120px'},
  {name:'Provisioning CIDR', type:'text', width: '120px'},
  {name:'Boot MAC address', type:'text', width: '120px'},
  {name:'Boot interface', type:'text', width: '120px'},
  {name:'Boot device', type:'text', width: '120px'}
  ]
  );
  
BaremetalNodes.help = function(){
  return `Hardware servers part of an OpenShift cluster on bare metal
Each server must be connected to 2 networks on the same interfaces:
- baremetal network: a rootable network
- provisioning network: non-routable network used for provisioning the underlying operating system;  no other DHCP servers should run on the same broadcast domain.  
FQDN: the fully qualified domain name of this server on the baremetal network: this name must be resolved by a domain name server. It consists in three parts:
- the node short name
- the OpenShift cluster name
- the domain
Role: 3 masters minimum per OpenShift cluster; workers are optional: if missing, master nodes play both master and worker roles
IPMI address, user and password: ILO remote control for this server
API/Ingress VIP: virtual IP addresses for the API endpoint and wildcard ingress endpoint respectively
Baremetal/Provisioning CIDR: The public CIDR (Classless Inter-Domain Routing) of the networks. For example, 10.0.0.0/24
Boot MAC address and interface: IP address and network interface of this node on the provisioning network
Boot device: Linux path to the block device used for installing the OS, eg /dev/sdb
`;
}
  
BaremetalNodes.build = function(target){
  var nameIndexes = BaremetalNodes.nameIndexes;
  var result = "";
  BaremetalNodes.check="";
  var table = document.getElementById("BaremetalNodes");
  var rowCount = table.rows.length;
  // For each OpenShift cluster
  BaremetalNodes.clusters=new Array();
  var nodes=new Array();
  var powerOff=new Array();
  var masters=new Array();
  var workers=new Array();
  var domains=new Array();
  var apiVIPs=new Array();
  var ingressVIPs=new Array();
  var baremetalCIDRs=new Array();
  var provisioningCIDRs=new Array();
  var bootInterfaces=new Array();
  
  for(var i=1; i < rowCount; i++){
    if(result==""){
      result += "\n"
      result += "\n# ------------------------------- #";
      result += "\n# BaremetalNodes definition       #";
      result += "\n# ------------------------------- #";
      }
    var row = table.rows[i];
    // nodes attributes
    var fqdn=BaremetalNodes.getAndSetValue(row, nameIndexes, 'FQDN', 'node-'+i+'.steel.bm.fc');
    var role=BaremetalNodes.getAndSetSelection(row, nameIndexes, 'Role',0);
    var ipmi=BaremetalNodes.getAndSetValue(row, nameIndexes, 'IPMI address', '10.33.0.'+(14+i));
    var user=BaremetalNodes.getAndSetValue(row, nameIndexes, 'IPMI user', 'admin');
    var password=BaremetalNodes.getAndSetValue(row, nameIndexes, 'IPMI password', 'HP1nvent');
    var mac=BaremetalNodes.getAndSetValue(row, nameIndexes, 'Boot MAC address', '48:df:37:xx:yy:zz');
    var device=BaremetalNodes.getAndSetValue(row, nameIndexes, 'Boot device', '/dev/sdb');
    
    var name=fqdn.split('.'); var shortname=name[0]; var ocp=name[1]; var domain=fqdn.substring((shortname+'.'+ocp+'.').length);
    if(name.length < 3)BaremetalNodes.check+="\nBaremetalNodes: Invalid FQDN "+fqdn+": expecting <node name>.<cluster name>.<domain>";
    if(!masters[ocp])masters[ocp]=new Array();
    if(!workers[ocp])workers[ocp]=new Array();
    if(masters[ocp].indexOf(shortname)<0 && workers[ocp].indexOf(shortname)<0)switch(role){
      case 'master': masters[ocp].push(shortname); break;
      case 'worker': workers[ocp].push(shortname); break;
      default: BaremetalNodes.check+="\nBaremetalNodes: unsupported role "+role+" for "+fqdn+": expecting master or worker";
    }else{
      BaremetalNodes.check+="\nBaremetalNodes: "+shortname+" is duplicated in cluster "+ocp;
    }
    
    if(!powerOff[ocp])powerOff[ocp]=new Array();
    powerOff[ocp].push("ipmitool -I lanplus -U "+user+" -P "+password+" -H "+ipmi+" power off");
    
    if(!domains[ocp]){
      domains[ocp]=domain;
    }else {
      if(domains[ocp] != domain)BaremetalNodes.check+="\nBaremetalNodes: inconsistent domain "+domain+" for node "+shortname+" on cluster "+ocp+" expecting consistent value across nodes: "+domains[ocp];
    }
    var macT=mac.split(':');
    isTwoHex = function(mac_addr){return mac_addr.length == 2 && mac_addr.match("^[0-9a-fA-F]+$")};
    if(macT.length < 6 || !macT.every(isTwoHex))BaremetalNodes.check+="\nBaremetalNodes: Invalid Boot MAC address "+mac+": expecting 6 column separated hex values 00-ff";
    
    // Cluster wide attributes, common to all nodes in one given cluster
    var apiVIP=BaremetalNodes.getAndSetValue(row, nameIndexes, 'API VIP', apiVIPs[ocp]?apiVIPs[ocp]:'10.33.200.'+(90+2*i));
    if(!apiVIPs[ocp])apiVIPs[ocp]=apiVIP;
    if(apiVIPs[ocp] != apiVIP)BaremetalNodes.check+="\nBaremetalNodes: inconsistent apiVIP on node "+fqdn+" for cluster "+ocp+": "+apiVIP+": expecting consistent value across nodes: "+apiVIPs[ocp];
    var ingressVIP=BaremetalNodes.getAndSetValue(row, nameIndexes, 'Ingress VIP', ingressVIPs[ocp]?ingressVIPs[ocp]:'10.33.200.'+(91+2*i));
    if(!ingressVIPs[ocp])ingressVIPs[ocp]=ingressVIP;
    if(ingressVIPs[ocp] != ingressVIP)BaremetalNodes.check+="\nBaremetalNodes: inconsistent ingressVIP on node "+fqdn+" for cluster "+ocp+": "+ingressVIP+": expecting consistent value across nodes: "+ingressVIPs[ocp];
    var baremetalCIDR=BaremetalNodes.getAndSetValue(row, nameIndexes, 'Baremetal CIDR', baremetalCIDRs[ocp]?baremetalCIDRs[ocp]:'10.33.200.0/24');
    if(!baremetalCIDRs[ocp])baremetalCIDRs[ocp]=baremetalCIDR;
    if(baremetalCIDRs[ocp] != baremetalCIDR)BaremetalNodes.check+="\nBaremetalNodes: inconsistent baremetalCIDR on node "+fqdn+" for cluster "+ocp+": "+baremetalCIDR+": expecting consistent value across nodes: "+baremetalCIDRs[ocp];
    var provisioningCIDR=BaremetalNodes.getAndSetValue(row, nameIndexes, 'Provisioning CIDR', provisioningCIDRs[ocp]?provisioningCIDRs[ocp]:'10.33.202.0/24');
    if(!provisioningCIDRs[ocp])provisioningCIDRs[ocp]=provisioningCIDR;
    if(provisioningCIDRs[ocp] != provisioningCIDR)BaremetalNodes.check+="\nBaremetalNodes: inconsistent provisioningCIDR on node "+fqdn+" for cluster "+ocp+": "+provisioningCIDR+": expecting consistent value across nodes: "+provisioningCIDRs[ocp];
    var bootInterface=BaremetalNodes.getAndSetValue(row, nameIndexes, 'Boot interface', bootInterfaces[ocp]?bootInterfaces[ocp]:'ens1f0');
    if(!bootInterfaces[ocp])bootInterfaces[ocp]=bootInterface;
    if(bootInterfaces[ocp] != bootInterface)BaremetalNodes.check+="\nBaremetalNodes: inconsistent bootInterface on node "+fqdn+" for cluster "+ocp+": "+bootInterface+": expecting consistent value across nodes: "+bootInterfaces[ocp];
    
    result+='\n# '+(role+' '+fqdn).padEnd(40)+'IPMI: '+ipmi+'/'+ user+'/'+password+ ' MAC: '+mac+' boot disk: '+device;
    
    if(!BaremetalNodes.clusters[ocp]){
      BaremetalNodes.clusters[ocp] = new Object;
      BaremetalNodes.clusters[ocp].installConfig="apiVersion: v1";
    }
    if(!nodes[ocp])nodes[ocp]="\nhosts:";
    nodes[ocp]+=`
  - name: `+shortname+`
    role: `+role+`
    bmc:
      address: ipmi://`+ipmi+`/
      username: `+user+`
      password: `+password+`
      disableCertificateVerification: True
    bootMACAddress: `+mac+`
    rootDeviceHints:
     deviceName: "`+device+`"`;
  }
  
  // OCP on bare metal requires the RedHat pull secret and a public ssh key
  if(Object.keys(BaremetalNodes.clusters).length){
    if(!Misc.search('Property','rhel_pullsecret'))BaremetalNodes.check+="\nBaremetalNodes section: missing the RedHat secret definition in Misc section rhel_pullsecret";
    if(!Misc.search('Property','public_sshKey'))BaremetalNodes.check+="\nBaremetalNodes section: missing the public ssh key definition in Misc section public_sshKey";
  }
  
  result+='\n# OpenShift clusters summary:';
  // Build the OpenShift installConfig yaml files
  Object.keys(BaremetalNodes.clusters).forEach(function(ocp){
    if(masters[ocp].length<3)BaremetalNodes.check+="\nBaremetalNodes: on cluster "+ocp+", found "+masters[ocp].length+" master(s), expecting three or more.";
    // Prepare the command powering off all nodes
    BaremetalNodes.clusters[ocp].powerOff=powerOff[ocp].join(" && ");
    // Prepare the list of nodes hosting local storage as a json array of short names: workers if any, otherwise masters. Eg: ["drei", "funf", "zwei"]
    BaremetalNodes.clusters[ocp].localStorageNode='["'+(workers[ocp].length?workers[ocp]:masters[ocp]).join('", "')+'"]';
    BaremetalNodes.clusters[ocp].installConfig+=
`
baseDomain: `+domains[ocp]+`
metadata:
  name: `+ocp+`
networking:
  machineCIDR: `+baremetalCIDRs[ocp]+`
  networkType: OVNKubernetes
compute:
- name: worker
  replicas: `+workers[ocp].length+`
controlPlane:
  name: master
  replicas: `+masters[ocp].length+`
  platform:
    baremetal: {}
platform:
  baremetal:
    apiVIP: `+apiVIPs[ocp]+`
    ingressVIP: `+ingressVIPs[ocp]+`
    disableCertificateVerification: True
    provisioningBridge: provisioning
    provisioningNetworkCIDR: `+provisioningCIDRs[ocp]+`
    provisioningNetworkInterface: `+bootInterfaces[ocp]+`
`+nodes[ocp].replace(/\n/g, "\n    ")+
`
pullSecret: '`+Misc.getValue('rhel_pullsecret')+`'
sshKey: '`+Misc.getValue('public_sshKey')+`' 
`;

    result+='\n# '+ocp.padEnd(15)+':'+masters[ocp].length+' masters and '+workers[ocp].length+' worker(s) on domain '+domains[ocp]+' API VIP '+apiVIPs[ocp]+' ingress VIP '+ingressVIPs[ocp]+' CIDRs '+provisioningCIDRs[ocp]+'/'+baremetalCIDRs[ocp]+' boot on '+bootInterfaces[ocp];
  });
  
  if(!BaremetalNodes.check)return result;
  
  // Errors: cleanup and report
  BaremetalNodes.clusters=null;
  return BaremetalNodes.check;
};

