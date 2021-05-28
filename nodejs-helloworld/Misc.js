
//===========================
//Miscellaneous settings
//===========================
var MiscItems = [
  {name: 'rhel_pullsecret', comment: "User secret provided by RedHat for deploying an OpenShift 4.x cluster; visit https://cloud.redhat.com/openshift/install/pull-secret", value:'{"auths":{"cloud.openshift.com":{"auth":"b3BlbnNoaWZ0LXJlbGVhc2UtZGV2K2RvbWV0ZGVtb250MXhjMXp2N3VhbjNhbTloamNrb2h1Y2tscTBjOlM2QVc3WUlCSDFMRFhSRkhBNU1WM1dOWUFNQjRSTDk4MU1JRE1PQzFYQUVBMDRLWlRKNVk3SzQwUFFVODlOOUo=","email":"dominique.domet-de-mont@hpe.com"},"quay.io":{"auth":"b3BlbnNoaWZ0LXJlbGVhc2UtZGV2K2RvbWV0ZGVtb250MXhjMXp2N3VhbjNhbTloamNrb2h1Y2tscTBjOlM2QVc3WUlCSDFMRFhSRkhBNU1WM1dOWUFNQjRSTDk4MU1JRE1PQzFYQUVBMDRLWlRKNVk3SzQwUFFVODlOOUo=","email":"dominique.domet-de-mont@hpe.com"},"registry.connect.redhat.com":{"auth":"NDM4MTY3MHx1aGMtMVhjMVp2N1VhTjNBbTloSmNrb2h1Y0tMcTBjOmV5SmhiR2NpT2lKU1V6VXhNaUo5LmV5SnpkV0lpT2lJMk4yUmpOMlZtWTJNMU5qSTBPVEZsT1RneVpXTTBOVGM1TUdGa1pUQTNaQ0o5Lkp2dWsybEo2Q3dLLTY5WnBkbDg1enk0RFUtdzV3aTVPWE5aZ0hDUDBlbXNCVmZDXzkzN3Fhdk5OZDZqdjRBU0NSRllPb3ZCTmxYTEhJbjA5amhIaTJiZDRfQ2xwMVhBaTdPYWVwN21qc0x5NVdrSEZHU3lHcU02RU43Y1N3bmFRWm00Q3lDNmNHaFItbVhtYnVDUTdYdWl0MVJCNEh5X0laZHV6dUhOa3hmam5aX2ZmWHNRb1ZVTmoxdW44bFlZMjQzLXpOMkpvN0p2M3MwZkZYYnBnbzBtMUNia284MzIzRWhGc3h5SFM5UXNYWUk3VDRJX21JRnBHMTZSVGotUGUyalluNjVJTnBxVFF4Y0FQaHpuQkxLYUNwd01Yb2F2V0hPMXpRWEs1QTF2dGR3Z1VUZEh0VWplX3FYUm13ZUQwYkVOeDRiVHgySGx2X0RlcnZuMEVfc3ZuRU4zVlpkNEc0VFNHZlo2d1c1LVlvSjJxZkdxeGVqeVZWdThqeDFyazFWRk52NERXaDd4amlTZ2I5d3dNTWVWVW9pSXFMZUN2NTZzUW4ycTRUdUpmdDNIVGR2UXhBSldHQWtGbDBFVUJKT0R2aGZrWGtSTWtjbmk5RVdiZVU0NWYwUThhQ1NmeG84anBzNE80endUMUxSQlVTVE5ZekN3bjhrTFdYR2FkaGo1aHdDNW9XNjlzUW5wYmpEY2JWR0dCSkdhNUtRREJpNmRVNzFoUTY3cThncUZ1UHhOaXJCcFNleTg0VWxtMS1PVjBzVXN4dnRwaVYxWFFvUVJrcHRVNnNBMFJaMTE2c25JT0gxR2piWm9paTB6M2hJbUltcmRPeG1ReHhYcC1nTWhsc2txcDZRVGtSWFdPZ0lyYWJ0UkNvV2pRc3JZb1EyZFNiRzBBODNB","email":"dominique.domet-de-mont@hpe.com"},"registry.redhat.io":{"auth":"NDM4MTY3MHx1aGMtMVhjMVp2N1VhTjNBbTloSmNrb2h1Y0tMcTBjOmV5SmhiR2NpT2lKU1V6VXhNaUo5LmV5SnpkV0lpT2lJMk4yUmpOMlZtWTJNMU5qSTBPVEZsT1RneVpXTTBOVGM1TUdGa1pUQTNaQ0o5Lkp2dWsybEo2Q3dLLTY5WnBkbDg1enk0RFUtdzV3aTVPWE5aZ0hDUDBlbXNCVmZDXzkzN3Fhdk5OZDZqdjRBU0NSRllPb3ZCTmxYTEhJbjA5amhIaTJiZDRfQ2xwMVhBaTdPYWVwN21qc0x5NVdrSEZHU3lHcU02RU43Y1N3bmFRWm00Q3lDNmNHaFItbVhtYnVDUTdYdWl0MVJCNEh5X0laZHV6dUhOa3hmam5aX2ZmWHNRb1ZVTmoxdW44bFlZMjQzLXpOMkpvN0p2M3MwZkZYYnBnbzBtMUNia284MzIzRWhGc3h5SFM5UXNYWUk3VDRJX21JRnBHMTZSVGotUGUyalluNjVJTnBxVFF4Y0FQaHpuQkxLYUNwd01Yb2F2V0hPMXpRWEs1QTF2dGR3Z1VUZEh0VWplX3FYUm13ZUQwYkVOeDRiVHgySGx2X0RlcnZuMEVfc3ZuRU4zVlpkNEc0VFNHZlo2d1c1LVlvSjJxZkdxeGVqeVZWdThqeDFyazFWRk52NERXaDd4amlTZ2I5d3dNTWVWVW9pSXFMZUN2NTZzUW4ycTRUdUpmdDNIVGR2UXhBSldHQWtGbDBFVUJKT0R2aGZrWGtSTWtjbmk5RVdiZVU0NWYwUThhQ1NmeG84anBzNE80endUMUxSQlVTVE5ZekN3bjhrTFdYR2FkaGo1aHdDNW9XNjlzUW5wYmpEY2JWR0dCSkdhNUtRREJpNmRVNzFoUTY3cThncUZ1UHhOaXJCcFNleTg0VWxtMS1PVjBzVXN4dnRwaVYxWFFvUVJrcHRVNnNBMFJaMTE2c25JT0gxR2piWm9paTB6M2hJbUltcmRPeG1ReHhYcC1nTWhsc2txcDZRVGtSWFdPZ0lyYWJ0UkNvV2pRc3JZb1EyZFNiRzBBODNB","email":"dominique.domet-de-mont@hpe.com"}}}'},
  {name: 'public_sshKey', comment: "Public SSH key injected in baremetal nodes part of an OpenShift cluster, for debugging purpose", value:'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDD7NHyHQT3pfG6yfpmQFSBjYe0x7t3qosl0sd880GHDbOkEZy9q5qMxYkQS41QCNzbx6RLrfz5eQawyWx0ADfY/YHaCKrjtFjd1hsP/svOBycJcOscGRjgmHt5ONDxqQGNgIpPOk/HOZn5oJEeJ8Bmk8hFdrsfl5m5f3IHg29jXmfL6bjaGGuWhD1xTKQEAk12DzObqvngalTO5+JPNoxSn2M7bYKZykP+vWQICyHTc8IRnwExyEmI4wEONOrMh13S2AdDpP9aoVCoTk+1Q8sJCmjO49g/uJlusfVTiVTBHTGycxWCcGG2uQ1BfwYJ/vp/8y9A/LVXmjYzYUIjBiBT Generated-by-Nova'},
  {name: 'anyuid', value: 'false', comment: "true|false: relax security on the OpenShift cluster before deploying resources by granting all containers the root privilege and approving pending certificates (not recommended)"},
  {name: 'extnet', value: 'ext-net', comment: "Name of the OpenStack external network used to connect the public addresses of the instances defined in the Nodes section"},
  {name: 'UPFpassword', value: 'R7VgbZPass.y4yDukYdA8/', comment: "Encrypted password set in the Casa UPF startup configuration file; used to allow/deny the user entering the configuration mode"},
  {name: 'UPFNRFip', value: '10.33.102.198', comment: "NRF ip address used by UPF; supports variable like ~myocp_API~ where myocp is the name of an OpenShift instance defined in the OpenShiftNodes section"},
  {name: 'UPFNRFinterface', value: '0', comment: "the network interface number to use to access NRF"},
  {name: 'UPFNRFport', value: '32600', comment: "NRF port used by UPF"},
  {name: 'UPFmcc', value: '405', comment: "mobile country code used by UPF"},
  {name: 'UPFmnc', value: '53', comment: "mobile network code used by UPF"},
  {name: 'UPFtac', value: '10000,10001,2711,2710', comment: "Comma separated list of tac provisioned for the UPF"},
  {name: 'UPFcidr', value: '30.30.30.0/24', comment: "UPF PDU session ip address range as a CIDR"},
  {name: 'UPFnat', value: 'DATA1', comment: "UPF network name for network address translation from UPF router to UPF"},
  {name: 'UPFrouted', value: 'upf', comment: "UPF instance short name target of the address translation performed by the UPF router(s)"},
	{name: 'headless', value: '', comment: "if not empty: do not assume a user for answering prompts and downloading files: use default values without prompting and do not save any file."},
	{name: 'default_project', value: 'hpe5g', comment: "The default OpenShift project/namespace for deploying resources"},
	{name: 'default_action', value: 'deploy', comment: "The default installer action: deploy or undeploy"},
	{name: 'default_openstack_env', value: 'RHOS12.env', comment: "The default OpenStack environment file name"},
	{name: 'default_openstack_network_root', value: '192.168.199', comment: "The default OpenStack network root as 3 unique digits like 192.168.199"},
  {name: 'openstack_security_group', value: 'default', comment: "Name of the OpenStack security group controlling network permissions to the instances"},
  {name: 'openstack_volume_size', value: '', comment: "Size in Gb of the specific volume allocated to each OpenStack instance:\n\t\tIn that case, the OpenStack image must refer to a volume ID used for cloning.\n\t\tDefault: local storage sized according to the flavor and initialiazed with the image."},
  {name: 'tester_nodejs_version', value: 'v11.10.1', comment: "Nodejs version used to run the CMS5G Core Stack tester tool"},
  {name: 'tester_git_url', value: 'git@10.74.128.22:cms5g/E2E-Testing.git', comment: "Git project URL delivering the CMS5G Core Stack tester tool"},
  {name: 'tester_deploy_key', value: '/home/centos/automated-deployer/tester/id_rsa', comment: "Optional git deploy key to clone the project delivering the CMS5G Core Stack tester tool"}
	];

var Misc = new vnfResource("Misc", [
	{name:'Property', width:'200px', type:'choice', choices:MiscItems.map(function(e){return e.name;})},
	{name:'Value', type:'text', width:'400px'}
	]
	);

Misc.help = function(){
	return "Miscellaneous settings:\n- " + MiscItems.map(function(e){return e.name+": "+e.comment;}).join("\n- ");
}
Misc.getValue = function(name){
	// If a global variable exists, use its value
	if(window[name])return window[name];
	var theDefault=Misc.getDefault(name);
	var theItem;
	if(Misc.output)theItem=Misc.output.find(function(anItem){return anItem.name==name;});
	return theItem ? theItem.value : theDefault.value;
};
Misc.getDefault = function(name){
	var result=MiscItems.find(function(anItem){return anItem.name==name;});
	return result;
};
Misc.build = function(target){
	var nameIndexes = Misc.nameIndexes;
	var result = "\n";
	Misc.check = "";
	Misc.output = new Array();
	var table = document.getElementById("Misc");
	var rowCount = table.rows.length;
	
	result += "\n# ------------------------------- #";
	result += "\n# Miscellaneous properties        #";
	result += "\n# ------------------------------- #";
	
	for(var i=1; i < rowCount; i++){
		var row = table.rows[i];
		var propertyName=Misc.getAndSetSelection(row, nameIndexes, 'Property');
		var theDefault=Misc.getDefault(propertyName);
		var propertyValue=Misc.getAndSetValue(row, nameIndexes, 'Value', theDefault.value, theDefault.comment);
		if(propertyName != ""){
		result += "\n# "+theDefault.comment+": "+propertyValue;
		Misc.output.push({name:propertyName, value:propertyValue});
		}
	}

	if(Misc.check != "")return Misc.check;
	return result;
};