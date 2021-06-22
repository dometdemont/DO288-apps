// ===========================
// OpenShiftNodes resource
// ===========================
var OpenShiftNodes= new vnfResource("OpenShiftNodes", [
  {name:'Name', type:'text', width: '80px'}, 
  {name:'Cloud', width:'120px', type:'choice', choices:['openstack','azure']},
  {name:'Domain', type:'text', width: '80px'},
  {name:'OSenv', type:'text', width: '100px'},
  {name:'ext-net', type:'text', width: '120px'},  
  {name:'ext-dns', type:'text', width: '120px'},  
  {name:'FIPAPI', type:'text', width: '120px'},
  {name:'FIPAPP', type:'text', width: '120px'},
  {name:'Masters', type:'text', width: '60px'},
  {name:'Workers', type:'text', width: '60px'},
  {name:'etc-hosts', type:'bool', width: '60px'},
  {name:'Flavor', width:'120px', type:'choice', choices:['flavorTiny','flavorSmall', 'flavorStandard', 'flavorLarge','flavorPerformance']},
  {name:'Worker flavor', width:'120px', type:'choice', choices:['flavorTiny','flavorSmall', 'flavorStandard', 'flavorLarge','flavorPerformance']},
  {name:'#Volumes', type:'text', width: '60px'}, 
  {name:'UPF', type:'text', width: '120px'}, 
  {name:'UPF router', type:'text', width: '120px'}
  ]
  );
  
OpenShiftNodes.help = function(){
  return `OpenShift 4.x clusters definitions
Prerequisites:
- rhel_pullsecret: all OpenShift clusters are deployed using the RedHat secret provided in the Misc section
- openshift-install and oc available at deployment time in the path with the target OpenShift version
- jq command line 
Azure specific prerequisites:
- a DNS zone to be used as the domain for the OpenShift instances; from this DNS zone is inferred the related resource group and region
- az command line
- DNS lookup utility dig
- az login successful
- optional: azure service principal stored in ~/.azure/osServicePrincipal.json ; otherwise, it is created and removed upon undeployment

Attributes:
- Name : name of the OpenShift instance to deploy
- Cloud: the cloud type for this OpenShift instance
- Domain: domain name of the OpenShift instance to deploy
  On Azure, this domain must exist as a DNS zone
  default: localdomain
- OSenv: name of the file providing the infrastructure environment. 
  For Azure, this file can be typically used for setting the PATH to point to the target openshift and oc CLI
  For OpenStack , this environment is typically retrieved from the GUI: Project/API access      
  By default, this file prompts the user for a password; to make the deployment unattended, replace the prompt with the actual password in the variable OS_PASSWORD
      Mandatory additional variables:
      - OS_CACERT: path to a file providing a specific cacert in case the SSL cert is signed by an unknown CA
      Extensions supported as additional variables: 
      - Proxy URLs for OpenShift cluster
      OPENSHIFT_HTTP_PROXY
      OPENSHIFT_HTTPS_PROXY
      OPENSHIFT_NO_PROXY
      - name of the ssh key pair defined in the OpenStack project, pushed to the OpenShift nodes for remote access (useful to connect to openshift nodes)
      OS_SSH_KEY_PAIR
- ext-net: (OpenStack only) name of the external network in the OpenStack infrastructure to connect this instance to; default: ext-net
- ext-dns: (OpenStack only) external domain name server; default 8.8.8.8
- FIPAPI/APP: (OpenStack only) floating IPs preallocated to the OpenShift cluster for the API and APP endpoints respectively. By default, those IPs are dynamically allocated if undefined or defined as a question mark(?). 
- Masters: number of masters: default 3
- Workers: number of workers : default 3
- etc-hosts: boolean enabling /etc/hosts update (requires sudo privilege) 
- Flavor/Worker flavor: shortcut defining the resources allocated for this OpenShift instance nodes; mapping to the actual flavor for the target infrastructure is based on the Flavors section
- #Volumes: (OpenStack only) quota of volumes on this OpenStack project; admin privileges required at run time if greater than the current quota; default 10
- UPF/UPF router: names of the nodes defined in the Nodes section, playing the UPF and UPF router roles for this OpenShift cluster respectively

Outputs:
For each OpenShift cluster, two floating IPs are exported as templated variables resolved at deployment time, available for other resources reference:
- ~name_API~: the cluster API floating IP
- ~name_APP~: the cluster Application floating IP
Example:
- myocp is an OpenShift cluster deployed in this section, hosting an NRF network function
- a UPF node is defined in the Nodes section
- the UPFNRFip entry in the Misc section can be set to ~myocp_API~ to make the UPF instance pointing to the NRF instance deployed in myocp cluster.

For each OpenShift cluster, the installer outputs an auth directory holding the kubeconfig file and kubeadmin password in a directory named like the cluster.
Example:
- myocp is an OpenShift cluster deployed in this section
- kubeconfig is in ./myocp/auth/kubeconfig
- kubadmin password is in ./myocp/auth/kubeadmin-password 
`;
}
OpenShiftNodes.build = function(target){
  var nameIndexes = OpenShiftNodes.nameIndexes;
  var result = "";
  OpenShiftNodes.check="";
  var table = document.getElementById("OpenShiftNodes");
  var rowCount = table.rows.length;
  OpenShiftNodes.instances =new Object;
  OpenShiftNodes.instances.name=new Array();
  OpenShiftNodes.instances.cloud=new Array();
  OpenShiftNodes.instances.domain=new Array();
  OpenShiftNodes.instances.osenv=new Array();
  OpenShiftNodes.instances.extnet=new Array();
  OpenShiftNodes.instances.extdns=new Array();
  OpenShiftNodes.instances.nbVolumes=new Array();
  OpenShiftNodes.instances.fipapi=new Array();
  OpenShiftNodes.instances.fipapp=new Array();
  OpenShiftNodes.instances.masters=new Array();
  OpenShiftNodes.instances.workers=new Array();
  OpenShiftNodes.instances.flavor=new Array();
  OpenShiftNodes.instances.flavorWorker=new Array();
  OpenShiftNodes.instances.etchosts=new Array();
  OpenShiftNodes.instances.UPF=new Array();
  OpenShiftNodes.instances.UPFrouter=new Array();
  
  for(var i=1; i < rowCount; i++){
    if(result==""){
      result += "\n"
      result += "\n# ------------------------------- #";
      result += "\n# OpenShiftNodes definition       #";
      result += "\n# ------------------------------- #";
      }
    var row = table.rows[i];
    var name=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'Name', "ocp-"+i);
    var cloud=OpenShiftNodes.getAndSetSelection(row, nameIndexes, 'Cloud', 0);
    var domain=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'Domain', "localdomain");
    var osenv=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'OSenv', "FC33.sh");
    var extnet=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'ext-net', cloud=='openstack'?Misc.getValue('extnet'):'');
    var extdns=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'ext-dns', cloud=='openstack'?"8.8.8.8":'');
    var nbVolumes=OpenShiftNodes.getAndSetValue(row, nameIndexes, '#Volumes', cloud=='openstack'?'10':'0');
    var fipapi=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'FIPAPI', '?');
    var fipapp=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'FIPAPP', '?');
    var masters=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'Masters', "3");
    var workers=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'Workers', "3");
    var flavor=OpenShiftNodes.getAndSetSelection(row, nameIndexes, 'Flavor');
    var flavorWorker=OpenShiftNodes.getAndSetSelection(row, nameIndexes, 'Worker flavor');
    var etchosts=OpenShiftNodes.getAndSetChecked(row, nameIndexes, 'etc-hosts', true);
    var upf=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'UPF');
    var upfRouter=OpenShiftNodes.getAndSetValue(row, nameIndexes, 'UPF router');
    
    if(!name)OpenShiftNodes.check+="\nOpenShiftNodes section: missing Name attribute";
    if(!domain)OpenShiftNodes.check+="\nOpenShiftNodes section: "+name+" missing Domain attribute";
    if(!osenv)OpenShiftNodes.check+="\nOpenShiftNodes section: "+name+" missing OSenv attribute";
    OpenShiftNodes.check+=checkDependency(cloud=='openstack', [extnet], "OpenShiftNodes section: ", name+" missing extnet attribute");
    OpenShiftNodes.check+=checkDependency(cloud=='openstack', [extdns], "OpenShiftNodes section: ", name+" missing extdns attribute");
    OpenShiftNodes.check+=checkDependency(cloud=='openstack', [nbVolumes], "OpenShiftNodes section: ", name+" missing nbVolumes attribute");
    var mastersNumber = Number(masters);
    if(isNaN(mastersNumber)){
      OpenShiftNodes.check+="\nOpenShiftNodes section: illegal value for Masters on "+name+" : "+masters+"; expecting integer";
    }else if(mastersNumber<3)OpenShiftNodes.check+="\nOpenShiftNodes section: illegal value for Masters on "+name+" : "+masters+"; 3 minimum required";
    var workersNumber = Number(workers);
    if(isNaN(workersNumber)){
      OpenShiftNodes.check+="\nOpenShiftNodes section: illegal value for Workers on "+name+" : "+workers+"; expecting integer";
    }
    if(!flavor)OpenShiftNodes.check+="\nOpenShiftNodes section: "+name+" missing Flavor attribute";
    // Convert to the actual flavor name
    flavor=Flavors[cloud][flavor].name
    flavorWorker=Flavors[cloud][flavorWorker].name
    OpenShiftNodes.check+=checkDependency(upf, [Nodes.search('MGMT fqdn',upf)], "OpenShiftNodes section: ", name+" missing UPF node named "+upf+" in the Nodes section");
    OpenShiftNodes.check+=checkDependency(upfRouter, [Nodes.search('MGMT fqdn',upfRouter)], "OpenShiftNodes section: ", name+" missing UPF router node named "+upfRouter+" in the Nodes section");
    
    result+="\nOpenShift cluster "+name+"."+domain+" in "+osenv+" environment made of "+masters+" masters of flavor "+flavor+" and "+ workers+" workers of flavor "+flavorWorker+" with up to "+nbVolumes+" volumes and /etc/hosts update "+etchosts;
    if(fipapi)result+=" preallocated FIP API:"+ fipapi;
    if(fipapp)result+=" preallocated FIP APP:"+ fipapp;
    OpenShiftNodes.instances.name.push(name);
    OpenShiftNodes.instances.cloud.push(cloud);
    OpenShiftNodes.instances.domain.push(domain);
    OpenShiftNodes.instances.osenv.push(osenv);
    OpenShiftNodes.instances.extnet.push(extnet);
    OpenShiftNodes.instances.extdns.push(extdns);
    OpenShiftNodes.instances.nbVolumes.push(nbVolumes);
    OpenShiftNodes.instances.fipapi.push(fipapi);
    OpenShiftNodes.instances.fipapp.push(fipapp);
    OpenShiftNodes.instances.masters.push(masters);
    OpenShiftNodes.instances.workers.push(workers);
    OpenShiftNodes.instances.flavor.push(flavor);
    OpenShiftNodes.instances.flavorWorker.push(flavorWorker);
    OpenShiftNodes.instances.etchosts.push(etchosts);
    OpenShiftNodes.instances.UPF.push(upf);
    OpenShiftNodes.instances.UPFrouter.push(upfRouter);
  }
  
  if(OpenShiftNodes.instances.name.length && !Misc.search('Property','rhel_pullsecret'))OpenShiftNodes.check+="\nOpenShiftNodes section: missing the RedHat secret definition in Misc section rhel_pullsecret";
  
  if(!OpenShiftNodes.check)return result;
  
  // Errors: cleanup and report
  OpenShiftNodes.instances=null;
  return OpenShiftNodes.check;
};
