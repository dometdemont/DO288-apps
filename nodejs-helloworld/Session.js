//=================================
// Session management
//=================================
function sessionHelp(){userOutput(
`Status:
  Tracks the modifications in the current session: either unchanged or modified or saved. In case of unsaved modifications, the user is prompted for confirmation upon session closing.
  
Save:
  Saved sessions are self-contained entities, and can be edited at will to reflect topology or feature changes, then saved again as new or modified sessions.
  By clicking the Save button, the whole HTML document is saved in the Download folder managed by the browser as a file named hpe5g.saved.html.
  This saved session gathers all HTML resources defined by the user in a single standalone file.
  NOTE: user loaded files are not part of the HTML document and must be reloaded from the saved session (catalog, Helm values, ...)

Dump:
  Produces a Json image of the current session, as a file named hpe5g.json in the Download folder of the browser.
  This light image does not contain the HTML document; it can be injected by the PUT verb of the Restful interface in headless mode,
  or imported to another session using the Import button.
	
Import:
  Besides, it may be useful to import an existing session in the current one, typically to merge sections from several sessions, 
  or to upgrade an existing session to a new version of the CMS5G Core Stack Assistant, thus benefiting from new features.
  To that aim, from the importing session, click the session file chooser button, and select the imported session file, either
  as a Json or Html file.
  A summary of imported sections is displayed in the text area; it is the user's responsibility to check the merged result 
  and remove or fix inconsistencies before building.

`)};

function setModifiedSession(location){
	// Update the session status in the current document with the current date
	var sessionStatus=document.getElementById("sessionStatus");
	var d=new Date()
	sessionStatus.textContent=location+" modified on "+d.toLocaleDateString()+" at "+d.toLocaleTimeString()
	sessionStatus.style.color="yellow"
	window.onbeforeunload = function() {return "Unsaved session data will be lost if you leave this page, are you sure?";};
}

function saveSession(){
  // Set volatile values as attributes so that they get saved in the cloned document
	var quickDescription = document.getElementById("quickDescription");
	quickDescription.setAttribute("value", quickDescription.value);
  var oc_version=document.getElementById("oc_version");
  var selectedOption=oc_version.options.selectedIndex;
  if(selectedOption != -1){
    // Remove all existing selected attributes
    for (var i=oc_version.options.length;i--;) { // looping over the options
      oc_version.options[i].removeAttribute("selected");
    }
    var s = oc_version.options[selectedOption];
    if(s != undefined)s.setAttribute("selected", "selected");
  }
  	
	var exportedDocument=document.cloneNode(true);
	// Update the backup status in the current document with the current date
	var savedStatus=document.getElementById("sessionStatus");
	var d=new Date()
	savedStatus.textContent="saved on "+d.toLocaleDateString()+" at "+d.toLocaleTimeString()
	savedStatus.setAttribute("style", "color: white");
	// Default to unsaved in the exported document
	var loadStatus=exportedDocument.getElementById("sessionStatus");
	loadStatus.textContent="unchanged";
	loadStatus.style.color="white"
	window.onbeforeunload =undefined;

	var blobPage = new Blob([exportedDocument.documentElement.innerHTML], {type: "text/plain;charset=utf-8"});

	var a = document.createElement('a');
	a.href = window.URL.createObjectURL(blobPage);
    a.download = "hpe5g.saved.html";
    document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

function importSession(){
	switch(importedSession.contentType){
	case 'html':
		var importedWindow = window.open('', "importedDocument");
		try{
		importedWindow.document.write(importedSession.content);
		var summary = "Import summary";
		var importedQuickDescription = importedWindow.document.getElementById("quickDescription").value;
		if(importedQuickDescription != ""){
			summary += "\nVNF description: " + importedQuickDescription;
			var quickDescription = document.getElementById("quickDescription");
			quickDescription.value += importedQuickDescription;
			quickDescription.setAttribute("value", quickDescription);
		}
		vnfResources.forEach(function(e,i,t){summary += e.import(importedWindow.document);});
		userOutput(summary);
		} catch(e){
			alert("Write to document failed, please try another browser\n" + e.message);
		}
		break;
	case 'json':
		if(jsonSession(importedSession.content))userOutput(importedSession.content);
		break;
	default:
		userOutput("Unsupported content type: "+importedSession.contentType+" ; expected html or json");
		break;
	}
	// Display populated sections
	vnfResources.forEach(function(e,i,t){e.display(!e.isEmpty())});
}

// Import/export the current session as Json payload or import as a JS object
function jsonSession(payload){
	if(payload){
		// Populate the session with provided payload
		var error="";
		// if the payload type is not an object, assume a json string and parse
		try {
			var sections = payload;
			if(typeof(payload) != 'object')sections=JSON.parse(payload); 
			if(!sections || !sections.length){return true;}	
			Object.keys(sections).forEach(function(s) {
				var section=Object.keys(sections[s]);
				if(!window[section]){
					error+="Unexpected section: "+section+"\n\tExpecting one of "+vnfResources.map(function(e){return e.title;}).join()+"\n";
					return;
				}
				Object.values(sections[s]).forEach(function(source){
				  source.forEach(function(row){
					var dest = new Array();
					for(key in row){dest.push({column:key, value:row[key]});}
					var check=window[section].add(dest);
					if(check)error+=check;
				});
			  });
			});
			if(error)throw error;
		  } catch (ex) {
			userOutput("JSON parser exception received:\n"+ex);
			return false;
		  }
		return true;
	}
	var result = new Array;
	vnfResources.forEach(function(e){var v=e.dump(); if(v.length)result.push({[e.title]:v});});
	var jsonPayload=JSON.stringify(result);
	userOutput(jsonPayload);
	// Stop there if headless, ie no user interface
	if(Misc.getValue('headless'))return true;
	
	var blobJson = new Blob([jsonPayload], {type: "text/plain;charset=utf-8"});
	var a = document.createElement('a');
	a.href = window.URL.createObjectURL(blobJson);
    a.download = "hpe5g.json";
    document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	
	return true;
}
