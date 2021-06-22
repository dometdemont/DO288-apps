// Class implementing a file which content is loaded from the user file system (content)
// to be dropped on the VNF at a specified path (path)
// Interface:
// - a constructor 
// - methods to load, display and clear the content.
// - public members: content, contentType and path
// - public methods: 
//   . isDefined to check if the element already exists in the DOM
//   . getDomElement to retrieve the HTML code exposing and controling the element
// Constructor: 
// - name of the variable instantiated: required to link the user's events to the object's methods
// - label describing the purpose of this file, displayed besides the 'browse' button
// - (optional) function to call upon loading, defaults to displaying the loaded content
// Usage example from a section
// - instantiate the object; parameter: the name of the HTML input button Id to allow clearance  
// 	var uspmAuxDescInput = new userLoadedFile("uspmAuxDescInput", "Import USPM auxiliary descriptor..."); 
// - pass this variable while constructing a section to get the file controls browse/view/clear
// new vnfResource("Misc", [...], [uspmAuxDescInput, ...]);
// - use the content: 
//	if(aUserFile.isDefined()){result += aUserFile.content;}else{ manage error...} 
// Usage example out of a section, directly in the DOM: controls to import a session
// - instantiate the object: parameters: name of the object, label, associated action: importSession
//   var importedSession = new userLoadedFile("importedSession", "Import...", importSession);
// - insert the HTML behind the 'controlArea' element unless it exists already
//   if(!importedSession.isDefined())document.getElementById("controlArea").appendChild(importedSession.getDomElement());
	
var userLoadedFile = function(aVarName, aLabel, anAction){
	this.label = aLabel;
	this.var = aVarName;
	this.inputId = aVarName+"_inputId";
	this.content = undefined;
	this.contentType = undefined;
	this.path = undefined;
	this.action = this.view;
	if(anAction != undefined)this.action = anAction;
	this.isDefined = function(){return document.getElementById(this.inputId) != undefined;};
	
	this.getDomElement = function(){
		var trFile = document.createElement('TR');
		var tdLabel = document.createElement('TD');
		tdLabel.setAttribute("valign", "top");
		tdLabel.appendChild(document.createTextNode(this.label));
		if(this.label!=undefined)trFile.appendChild(tdLabel);
		
		var tdBrowse = document.createElement('TD');
		tdBrowse.setAttribute("valign", "top");
		var browseButton = document.createElement('INPUT');
		browseButton.type="file";
		browseButton.id=this.inputId;
		browseButton.className="buildButton";
		//browseButton.value="Import...";
		browseButton.setAttribute("onchange", this.var + ".load(event)");
		tdBrowse.appendChild(browseButton);
		trFile.appendChild(tdBrowse);
		
		var tdView = document.createElement('TD');
		tdView.setAttribute("valign", "top");
		var viewButton = document.createElement('INPUT');
		viewButton.type="button";
		viewButton.className="helpButton";
		viewButton.value="Review";
		viewButton.setAttribute("onClick", this.var + ".view(event)");
		tdView.appendChild(viewButton);
		trFile.appendChild(tdView);
		
		var tdClear = document.createElement('TD');
		tdClear.setAttribute("valign", "top");
		var clearButton = document.createElement('INPUT');
		clearButton.type="button";
		clearButton.className="delButton";
		clearButton.value="Clear";
		clearButton.setAttribute("onClick", this.var + ".clear(event)");
		tdClear.appendChild(clearButton);
		trFile.appendChild(tdClear);
		return trFile; 
	}
}
userLoadedFile.prototype.load = function(event){
	// Gratitude to https://stackoverflow.com/questions/27254735/filereader-onload-with-result-and-parameter
	var file = event.target.files[0];
	this.contentType = file.name.split('.').pop();
	var reader = new FileReader();
    reader.onload = ( function(target){ return function(e){
    	// Store the file content in the original object
    	target.content = this.result;
    	// Action 
    	target.action();
    	}
    })(this);
    reader.readAsText(file);
}
userLoadedFile.prototype.clear = function(){
	this.content=undefined; 
	userOutput(''); 
	if(this.inputId != undefined)document.getElementById(this.inputId).value= null;
}
userLoadedFile.prototype.view = function(){
	userOutput(this.content);
}
// Ensure that both the content and the path are defined
userLoadedFile.prototype.hasContent = function(){
	return this.content != undefined && this.content != ''
}
// Ensure that neither the content nor the path are defined
userLoadedFile.prototype.isUndefined = function(){
	return (this.content == undefined || this.content == '') && (this.path == undefined || this.path == '');
}
// Check that both path and content are either defined or undefined
userLoadedFile.prototype.isConsistent = function(){
	return this.hasContent() || this.isUndefined();
}
