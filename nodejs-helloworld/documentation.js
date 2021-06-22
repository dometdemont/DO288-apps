
function deploymentHelp(){userOutput(welcomeMsg+OpenStackHelp);}
var OpenStackHelp=
`
Quick user guide for deploying an OpenShift cluster in an OpenStack HPE lab infrastructure using ansible: 

- OpenStack tenant
    - Get a tenant on OpenStack    
     Typical quota: 25 vCPUs, 50Gb RAM, 100Gb disk
    - in the default security group, allow all ports for TCP and UDP ingress: Networks/Security Groups/default/Manage Rules/Add Rule
    - create an ssh key pair: Compute/Key Pairs/Create Key Pair, eg mykey
    - save the private key, eg mykey.pem

- Ansible controller
    - create a network and a router connected to the external network
    - create an instance connected to this network: Compute/Instances/Launch Instance    
     from image CentOS 8.x,   
      with 20 Gb disk,   
       4 vCPUs,   
       8Gb RAM   
       embedding this ssh key,   
       and associated with a floating (public) IP, eg 30.118.0.26
    - connect to this VM as user centos with the saved ssh key eg:   
    ssh -i mykey.pem centos@30.118.0.26
    - install git httpd-tools java-1.8.0-openjdk-headless and pip from epel repository:     
     sudo  yum install -y epel-release     
     sudo  yum install -y git httpd-tools java-1.8.0-openjdk-headless python3 python3-pip --enablerepo='epel'
    - install openstack client, ansible, shade, passlib, decorator and cryptography:    
     sudo  pip3 install python-openstackclient===5.4.0 shade passlib decorator===4.4.0 ansible===2.7.4 cryptography==2.5
    - clone the CMS5G Core Stack automated deployer from git:     
     git clone git@github.hpe.com:CMS-5GCS/automated-deployer.git
    - move to this directory    
     cd automated-deployer
    - retrieve in this directory the private ssh key file and set ssh compliant access rights eg :    
     chmod 0600 *.pem 
 
- OpenStack target definition
    - get your tenant and project information from OpenStack portal: project/API access/view credentials
    - copy and update an example of environment definition file provided with the project, eg OKDRHOS13.env: 
      - export OS_IDENTITY_API_VERSION=3
      - export OS_AUTH_URL="https://30.118.132.11:13000/v3"
      - export OS_PASSWORD="xxxx"
      - export OS_PROJECT_ID="b5f5a70ae58d4405a780aac02094a264"
      - export OS_PROJECT_NAME="d3mRHOS13"
      - export OS_USERNAME="d3m"
    - set the ssh key to use:
      - export CLOUD_SSH_KEY_PAIR="mykey"
      - export CLOUD_SSH_KEY="/home/centos/openshift-ansible/mykey.pem"
    - set the name of the external network offering public access
  	  - export CLOUD_EXTERNAL_NETWORK=ext-net
    - set the default image to used:
      - export CLOUD_IMAGE="Cent OS 7"
    - retrieve the infrastructure certificate: e.g. grenoble-infra-root-ca_gs118.crt 

- Define the resources to deploy and build the installer
    - retrieve and open in a browser the assistant hpe5g.html or start from an example file provided by the git project like five.html
    - define the nodes, roles and resources, 
    - click the Installer button: the installer is downloaded, 
    - retrieve and run the installer on the ansible console. 

- Enjoy OpenShift     
The first master public IP address is available as $openshift_ip: eg 30.118.0.24
    - Connect to OpenShift GUI on this master node port 8443, eg: Browse https://$openshift_ip:8443
    - accept the security warning and log on with any name and password
    - approve the self signed certificate for the metrics display engine Hawkular by clicking the warning link in another tab
    - connect to the master, connect with the user name used in the GUI
     - ssh -i $CLOUD_SSH_KEY centos@$openshift_ip	
     - oc login -u <user>
    - invoke the deployment script: ./hpe5g.sh

- Undeploy
     - run the same installer with the --undeploy option

Conversely, OpenShift 4.x clusters are defined in the OpenShiftNodes section of the automated deployer assistant. Such deployments do not require ansible but the openshift installer and client, plus a pull secret, all retrieved from RedHat download site: https://cloud.redhat.com/openshift/install/openstack/installer-provisioned
- openshift-install and oc are to be available in the console path with the target version
- the pull secret has to be defined in the Misc section of the assistant: rhel_pullsecret
`;
 
// Compile the Help text of a selection of sections and catalog in a markdown document 
function deploymentDoc(){
	var result=`
<a name="SectionsDetails"></a>
## Sections detailed specifications
This chapter is a compilation of the detailed sections specifications.
`;
	['Misc', 'Networks','OpenShiftNodes','BaremetalNodes','VanillaNodes','Nodes','Flavors','Clusters','Builds', 'CustomApps', 'TemplateParameters', 'NetworkFunctions','DirectServices','IndirectServices','Operators','HelmCharts'].forEach(function(section){
		result+="\n### "+section+"\n"+window[section].help();
		if(hpe5gResources.types[section])result+="\n"+section+" supported types: "+hpe5gResources.types[section]+"\n";
	});
	
	result+=`
<a name="CatalogSpecification"></a>
## Catalog specification\n`+catalogDoc+`
<a name="OpenStackHelp"></a>
## OpenStack deployment help\n`+OpenStackHelp;

	userOutput(result);
	var blobDesc = new Blob([result], {type: "text/plain;charset=utf-8"});
	var a = document.createElement('a');
	a.href = window.URL.createObjectURL(blobDesc);
    a.download = "hpe5g.md";
    document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}