// Display information to the user in the userArea frame
// Keep a copy of the last displayed data in a global variable, accessible to an headless application, free of any HTML rendering
// (typically special characters escaping)
var rawUserOutput;
function userOutput(aText){
	document.getElementById("userArea").innerHTML=aText;
	document.getElementById("endOfUserArea").click();
	rawUserOutput=aText;
}

// Class implementing a unique role
var uniqueRole = function(aName){
	this.v = false;
	this.name = aName;
}
uniqueRole.prototype.init = function(){this.v = false;}
uniqueRole.prototype.v = this.v;
// Set if y, unless already true; in that case, return a duplication alert for role
uniqueRole.prototype.setIfNotOrAlert = function(y){
	if(y){
		if(this.v)return "\nNodes section: role " + this.name + " is duplicated."
		this.v = true;
	}
	return "";
}

// Class implementing a Heat node: a short name, and a flavor, plus a boolean identifying a EMS role receiving OpenShift templates defining the network functions
// Plus a list of network interfaces identified by the integer behind the 'eth' prefix, -1 for the external network used to connect floating IPs
// Plus 2 booleans: isVIP if this node is a VIP and hasVIP if this node hosts VIP(s)
// And a table holding all IP addresses for this node, for infrastructure not allocating dynamically IP addresses (vmware, static)
var heatPublicInterface = -1;   
var cloudNode = function(aName, aFQDN){
	this.flavor = 'flavorStandard';
	this.name = aName;
	this.fqdn = aFQDN;
	this.interfaces = new Array();
	this.isEms = false;
	this.isVIP = false;
	this.hasVIP = false;
	this.ipAddresses = undefined;
	this.domain = aFQDN.substr(aFQDN.indexOf('.')+1);
}

// Class implementing a Heat volume: name, size and description
var cloudVolume = function(aName, aSize, aDescription){
	this.name=aName;
	this.size=aSize;
	this.description=aDescription;
}

// Class implementing a openshift volume: name, size, type, access and cinder volume
var openshiftVolume = function(aName, aSize, aType, anAccess, aReclaim, aCinder){
	this.name=aName;
	this.size=aSize;
	this.type=aType;
	this.access=anAccess;
	this.reclaim=aReclaim;
	this.cinder=aCinder;
}

// Class implementing a port opened as a value, a protocol and a description
var vnfPort = function(aPort, aProtocol, aDescription){
	this.port = aPort;
	this.protocol = 'UDP';
	if(aProtocol != "")this.protocol = aProtocol;
	this.description = aDescription;
}
// List of exposed ports in the whole VNF
var vnfPorts = new Array();

var consistency = new Object;

consistency.initSingle = function (){

}
consistency.init = function (){
	consistency.initSingle();
}

consistency.check = function (){
	// Cross sections consistency checks, cannot be executed locally to the sections
	var warnings = "";
	if(!Networks.search('network','MGMT'))warnings+="\nNetworks section: management interface is mandatory";
	return warnings;
}

// if a is true, check that at least one element of x is true
// Otherwise, return a dependency message for roles
function checkDependency(a, x, roles, message){
	if(message == undefined)message = " are required on the same node";
	if( a && ! x.some(function(e, i, t){return e;} ))
		return "\n" + roles + message;
	return "";
}

// Check if only one element of x is true
// Otherwise, return a mutual exclusive message for roles
function checkUnicity(x, roles, message){
	var xTrue = x.filter(
		function(e, i, t){return e;}
	);
	if(message == undefined)message = " are mutually exclusive";
	if(xTrue.length > 1)return "\n" + roles + message;
	return "";
}

// Check if all or none element(s) of x is true
// Otherwise, return a group inconsistency message for roles
function checkGroupConsistency(x, roles, message){
	var xConsistent = ! x.some(
		function(e, i, t){return e;}
	) || x.every(
		function(e, i, t){return e;}
	);
	if(xConsistent)	return "";
	if(message == undefined)message = " group is not consistent (none or all should be true)";
	return "\n" + roles + message;
}

// Build a triple NAME/IP_ADDR/IP_NAT_ADDR of definitions for the role and device, using name and ip addr
// if name or ip addr are undefined, return an empty string
// if they are arrays with non empty elements, output a bash vector, ie space separated list enclosed in parenthesis
function getNameIpAddr(role, device, name, ipAddr, ipNatAddr){
	var result = "";
	var prefix = "";
	var suffix = "";
	var theName = name;
	if(name instanceof Array){
		if(name.join("").trim() != ""){
			theName = name.join(" ");
			prefix = "( ";
			suffix = " )";
		}else{
			theName = "";
		}
	}
	if(theName != undefined && theName != "")result += "\n" + role + "_NAME" + device + "=" + prefix+theName+suffix;
	prefix = suffix = "";
	var theIpAddr = ipAddr;
	if(ipAddr instanceof Array){
		if(ipAddr.join("").trim() != ""){
			theIpAddr = ipAddr.join(" ");
			prefix = "( ";
			suffix = " )";
		}else{
			theIpAddr = "";
		}
	}
	if(theIpAddr != undefined && theIpAddr != "")result += "\n" + role + "_IP_ADDR" + device + "=" + prefix+theIpAddr+suffix;
	prefix = suffix = "";
	var theIpNatAddr = ipNatAddr;
	if(ipNatAddr instanceof Array){
		if(ipNatAddr.join("").trim() != ""){
			theIpNatAddr = ipNatAddr.join(" ");
			prefix = "( ";
			suffix = " )";
		}else{
			theIpNatAddr = "";
		}
	}
	if(theIpNatAddr != undefined && theIpNatAddr != "")result += "\n" + role + "_IP_NAT_ADDR" + device + "=" + prefix+theIpNatAddr+suffix;
	return result;
}

// Useful 'contains' method for String is not available everywhere
if(!('contains' in String.prototype)){
	String.prototype.contains = function(str, startIndex){
		return -1 !== this.indexOf(str, startIndex);
	}
}

// Useful 'startsWith' method for String is not available everywhere
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}
if (!String.prototype.endsWith) {
	String.prototype.endsWith = function(pattern) {
	  var d = this.length - pattern.length;
	  return d >= 0 && this.lastIndexOf(pattern) === d;
	};
}

// Gratitude to https://stackoverflow.com/questions/1199352/smart-way-to-truncate-long-strings
String.prototype.trunc = String.prototype.trunc ||
function(n){
    return (n != 0 && this.length > n) ? this.substr(0, n-1) + '&hellip;' : this;
};

// In a list of arrays 'a', for all empty elements from index 0 to the last existing array, create an array and insert a 'defaultString'
function fillArrays(a, defaultString){
	if(a == undefined)return;
	if(defaultString == undefined)defaultString=new String('""');
	var fillArray = false;
	for(var i = a.length - 1; i>=0; i--){
		if(a[i] == undefined){
			if(fillArray){
				a[i] = new Array();
				a[i].push(defaultString);
			}
			else {
				a.pop();	// remove the useless undefined last element
			}
		}
		else{
			fillArray = true;
		}
	}
}
