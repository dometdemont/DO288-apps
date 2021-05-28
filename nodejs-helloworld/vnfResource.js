// Class defining a VNF resource named 'title' as an extensible table with a set of 'columns'
// Each column needs to define a 
// - name
// - type (optional)
//		. bool to define a check box
//		. choice to define a drop down menu
//			for that type, a 'choices' attribute is expected to define the list of choices
//		. text (default)
// - value (optional: the default value)
//
// Two methods linked to buttons at the bottom of the table are to be provided for each VNF resource:
// - build: returns the Descriptor section for this resource as a string; if any issue prevents this build, the check variable should return the error messages 
// - help: provides hints for this resource as a text string
//
// All input resources created are watching the onchange event and call setModifiedSession(section) when such an event fires
//
// Convenient methods are offered for a resource:
// search(column, value): to search for a text value in a given column
// display(column, value): set the display style attribute for a given column, where 'value' typically is 'none' to hide a column, and id one by default
// count(column, value): count the number of occurrences of a specific value in a specific column
// isEmpty(): check if the table is empty
// A optional parameter user file list, allowing the resource to load a set of user file, as a list of objects instantiated from userLoadedFile class
 
// Cell width control
var cellWidth="85px";
var boolCellWidth="15px";
var choiceCellWidth="200px";

// Ensure unicity of ids for all the dynamic delete buttons by incrementing an integer at each button creation
// This value has to be recorded in the DOM so that when starting from an existing document, the new ids will not clash with the existing ones
// Default to 1 if nothing valid is recorded in the DOM
var _uniqueInputId=1;
var _uniqueInputIdDOM=document.getElementById("_uniqueInputId");
if(_uniqueInputIdDOM != undefined){
	var candidate = Number(_uniqueInputIdDOM.value);
	if(!isNaN(candidate))_uniqueInputId=candidate;
}

// List of VNF resources for applying actions to multiples resources
vnfResources = new Array();

var vnfResource = function(title, columns, userFiles){
	this.result = "\nWARNING: " + title + " section is not defined yet: please apply and rebuild\n";
	var self = this;
	
	var table = document.createElement('TABLE');
	table.border='1';
	table.id=title;
	
	var tableCaption = document.createElement('CAPTION');
	tableCaption.appendChild(document.createTextNode(title));

	var tableBody = document.createElement('TBODY');
	table.appendChild(tableBody);
	
	var tr = document.createElement('TR');
	tableBody.appendChild(tr);
	var td = document.createElement('TH');
	var addButton = document.createElement('INPUT');
	addButton.type="button";
	addButton.value="Add";
	addButton.setAttribute("onClick", title + ".add();");
	td.appendChild(addButton);
	tr.appendChild(td);

	// Create all columns in this table; set a class concatenating the table and column names for further search
	// Build an array of the names for easy search with name key  when calling the build function
	// The first cell is used for the delete button, skip it
	var iName = new Array(columns.length + 1);
	for (i=0; i<columns.length; i++){
		var td = document.createElement('TH');
		td.className = title + columns[i].name;
		td.appendChild(document.createTextNode(columns[i].name));
		iName[i+1] = columns[i].name;
		var localWidth = cellWidth;
		switch(columns[i].type){
			case 'bool':
				localWidth = boolCellWidth;
				break;
			case 'choice':
				localWidth = choiceCellWidth;
				break;
		}
		if(columns[i].width != undefined)localWidth = columns[i].width;
		td.style.width = localWidth;
		tr.appendChild(td);
	}

	// Attach useful variables to this current object for further asynchronous reference
	self.title = title;
	self.nameIndexes = iName;
	self.columns = columns;
	self.check = "";
	
	// For each user file, add a set of buttons to load, view and clear the associated text. 
	var tableFiles = document.createElement('TABLE');
	if(userFiles != undefined)userFiles.forEach(function(aFile){
		tableFiles.appendChild(aFile.getDomElement());
	});
	
	// Add a button to trigger the Descriptor build for this section
	var buildButton = document.createElement('INPUT');
	buildButton.type="button";
	buildButton.value="Apply";
	buildButton.className="buildButton";
	buildButton.setAttribute("onClick", "userOutput(" + title + ".build());");
	
	// Add a button to show help 
	var helpButton = document.createElement('INPUT');
	helpButton.type="button";
	helpButton.value="Help";
	helpButton.padding="5px";
	helpButton.className = "helpButton";
	helpButton.setAttribute("onClick", "userOutput(" + title + ".help());");
	
	// Append the new elements to the DOM behind the insertion point, if they dot not exist already
	if(document.getElementById(title) == undefined){
		var myTableDiv = document.getElementById("tableInsertionPoint");
		// Create an anchor for quick reference to this table
		var anchorTable = document.createElement('A');
		anchorTable.setAttribute("name", title);
		// Add a link to this table just before the user result area: a click on this link displays the related section 
		var linkToTable = document.createElement('A');
		linkToTable.setAttribute("href", "#"+title);
		linkToTable.innerHTML=" / "+title;
		linkToTable.setAttribute("onClick", this.title + ".display(true);");
		var userArea = document.getElementById("endOfUserArea");
		userArea.appendChild(linkToTable);
		var linkToTableSummary = linkToTable.cloneNode(true);
		var summary = document.getElementById("summary");
		summary.appendChild(linkToTableSummary);
		var headerTable = document.createElement('H2');
		headerTable.innerHTML=title;

		anchorTable.appendChild(headerTable);
		// Create a specific div for this section, easing management, hide, show, etc.
		var thisTableDiv = document.createElement('div');
		thisTableDiv.id = title+'Section';
		thisTableDiv.appendChild(anchorTable);
		thisTableDiv.appendChild(table);
		thisTableDiv.appendChild(tableFiles);
		thisTableDiv.appendChild(buildButton);
		thisTableDiv.appendChild(helpButton);
		myTableDiv.appendChild(thisTableDiv);
	}
	
	// update the list of VNF resources for actions applying to all elements, like build, import...
	vnfResources.push(this);
};
// Default help 
vnfResource.prototype.help = function(){
	return "No help available";
}
// Default build
vnfResource.prototype.build = function(){
	return "No build instructions defined";
}
// Delete the current line in the table
vnfResource.prototype.delete = function(inputId){
	var table = document.getElementById(this.title);
	var theInput = document.getElementById(inputId);
	var index = theInput.parentNode.parentNode.rowIndex;
	table.deleteRow(index);	
	setModifiedSession(this.title);
}
// Add a new line in the table
// Optional values can be provided as a table of dictionaries of column / value like [{column:"columnA", value:"a"}, {column:"columnB", value:"b"}, {column:"columnD", value:"d"}, ...]
// For 'choice' types, the init value is checked against the valide set: if not valid, an error message is returned.
// Otherwise, undefined is returned
vnfResource.prototype.add = function(values){
	var section=this.title;
	var table = document.getElementById(section);
	var columns = this.columns;
	var result="";
	
	if(values){
		// Check for unknown columns
		var validColumns=columns.map(function(c){return c.name;})
		values.forEach(function(v){if(validColumns.indexOf(v.column) < 0)result+="Unknown attribute "+v.column+" in section "+section+" ignored.\n\tExpecting one of: "+validColumns.join()+"\n"});
	}
 
	var rowCount = table.rows.length;
	var row = table.insertRow(rowCount);
	var delButton = document.createElement('INPUT');
	delButton.type="button";
	delButton.value="Del";
	delButton.className="delButton";
	delButton.id="delButton"+(_uniqueInputId++);
	_uniqueInputIdDOM.setAttribute("value", _uniqueInputId);
	delButton.setAttribute("onClick", this.title + ".delete('"+delButton.id+"');");
	var cell = row.insertCell(0);
	cell.appendChild(delButton);
	for (i=0; i<columns.length; i++){
		var cell = row.insertCell(i+1);
		cell.className = this.title + columns[i].name;
		// Initial value: first element of values with a matching column name
		var init=undefined;
		if(values){
			var initValues = values.filter(function(e){return e.column == columns[i].name;});
			if(initValues.length > 0)init=initValues[0].value;
		}
		switch(columns[i].type){
			case 'bool':
				var checkCell = document.createElement('INPUT');
				checkCell.className = this.title + columns[i].name;
				checkCell.type = "checkbox";
				cell.style.width = checkCell.style.width = boolCellWidth;
				if(init)checkCell.setAttribute("checked", "checked");
				cell.appendChild(checkCell);
				checkCell.setAttribute("onchange", "setModifiedSession('"+this.title+"')")
				break;
			case 'choice':
				var _choices=columns[i].choices;
				// if the list of choices is not a function, assume an array and return this array through a function
				if(typeof _choices != "function")_choices=function(){return columns[i].choices;};
				var selectCell = document.createElement('SELECT');
				selectCell.className = this.title + columns[i].name;
				var localWidth = choiceCellWidth;
				if(columns[i].width != undefined)localWidth = columns[i].width;
				cell.style.width = selectCell.style.width = localWidth;
				for (j=0; j<_choices().length; j++){
					var option = document.createElement('OPTION');
					option.value = _choices()[j];
					option.innerHTML = option.value;
					selectCell.appendChild(option);
				}
				// if the default value is not a null string, avoid adding always the same selection:
				// set a default value according to the row in the table, instead of the first choice
				if(_choices()[0] != "")selectCell.value = _choices()[rowCount-1];
				if(init != undefined){
					// Make sure the init value is a valid choice
					if(_choices().indexOf(init) < 0)result+="Unknown selection "+init+" for attribute "+columns[i].name+" in section "+this.title+"\n\tExpecting one of: "+_choices().join()+"\n";
					selectCell.value = init;
				}
				selectCell.setAttribute("onchange", "setModifiedSession('"+this.title+"')")
				cell.appendChild(selectCell);
				break;
			case 'file':
				// userLoadedFile needs a javascript variable: build it dynamically as the section name, the column name and the delete button id which is unique
				var dynJSvar=this.title + "_" + columns[i].name + "_" + delButton.id;
				var tableFiles = document.createElement('TABLE');
				tableFiles.className=this.title + columns[i].name+" userLoadedFile";
				tableFiles.id=dynJSvar;
				window[dynJSvar] = new userLoadedFile(dynJSvar);
				tableFiles.appendChild(window[dynJSvar].getDomElement());
				window[dynJSvar].content=init;
				cell.appendChild(tableFiles);
				break;
			default:
				var inputCell = document.createElement('INPUT');
				inputCell.className = this.title + columns[i].name;
				var localWidth = cellWidth;
				if(columns[i].width != undefined)localWidth = columns[i].width;
				cell.style.width = inputCell.style.width = localWidth;
				inputCell.type = "text";
				if(columns[i].value != undefined)inputCell.value = columns[i].value;
				if(init != undefined)inputCell.value = init;
				inputCell.setAttribute("onchange", "setModifiedSession('"+this.title+"')")
				cell.appendChild(inputCell);
				break;
		}
	}
	// hide unused columns if the method is available
	if(this['hideUnused'] != undefined)this.hideUnused();
	return result;
}

// Import from a provided document
// Returns a text string summarizing the import
vnfResource.prototype.import = function(importedDocument){
	var summary = "";
	var table = document.getElementById(this.title);
	var importedTable = importedDocument.getElementById(this.title);
	if(importedTable == null)return summary;
	
	var rowCount = table.rows.length;
	var importedRowCount = importedTable.rows.length;
	var columns = this.columns;
	
	for(var i=1; i < importedRowCount; i++, rowCount++){
		if(summary == "")summary = "\n" + this.title;
		summary += "\n";
		
		// one more line
		this.add();
		
		for (j=0; j<columns.length; j++){
			// Source: 2 cells expected: one for the td element, the second for the input element
			var source = Array.prototype.slice.call(importedTable.rows[i].getElementsByClassName(this.title + columns[j].name));
			// Otherwise, this column is missing in the source document, continue
			if(source.length < 2)continue;
			
			// Destination: j+1 as the first cell is dedicated to the delete button
			var destination=table.rows[rowCount].cells[j+1].childNodes[0];
			switch(columns[j].type){
				case 'bool':
					destination.removeAttribute("checked");
					if(source[1].checked){
						destination.setAttribute("checked", "checked");
					}
					break;
				case 'choice':
					var selectedOption = source[1].selectedIndex;
					var selectedValue = source[1].options[selectedOption].value;
					if(selectedOption != -1){
						// looping over the destination options to select the selected value
						for (selectedOption=destination.options.length;selectedOption--;) { 
						  if(destination.options[selectedOption].value == selectedValue)
						  	break;
						}
						destination.options.selectedIndex=selectedOption;
						if(selectedOption != -1){
							destination.options[selectedOption].setAttribute("selected", "selected");
							if(destination.options[selectedOption].value != "")summary += "\t" + destination.options[selectedOption].value;
						}
					}
					break;
				case 'file':
					// userLoadedFile has a javascript variable associated, which name is the id, built as the section name, the column name and the delete button id which is unique: 
					var dynJSvar=source[1].id;
					window[dynJSvar] = new userLoadedFile(dynJSvar);
					summary += "\tPlease load a file to populate "+columns[j].name+" at line "+i+" in section "+this.title;
					break;
				default:
					destination.value = source[1].value;
					destination.removeAttribute("value");
					destination.setAttribute("value", source[1].value);
					if(destination.value != "")summary += "\t" + destination.value;
					break;
			}
		}
	}
	return summary;
}

// Returns the current object as a table of rows, each row being a table of attribute:value
vnfResource.prototype.dump = function(){
	var result = new Array();
	var table = document.getElementById(this.title);
	
	var rowCount = table.rows.length;
	var columns = this.columns;
	
	for(var i=1; i < rowCount; i++){
		// one more line
		var line = new Object;
		
		for (j=0; j<columns.length; j++){
			var val;
			// Source: 2 cells expected: one for the td element, the second for the input element
			var source = Array.prototype.slice.call(table.rows[i].getElementsByClassName(this.title + columns[j].name));
			// Otherwise, this column is missing in the source document, continue
			if(source.length < 2)continue;
			
			switch(columns[j].type){
				case 'bool': val = source[1].checked; break;
				case 'choice':
					var selectedOption = source[1].selectedIndex;
					val = source[1].options[selectedOption].value;
					break;
				case 'file':
					var delButton=table.rows[i].getElementsByClassName("delButton")[0];
					var dynJSvar=this.title + "_" + columns[j].name + "_" + delButton.id;
					val=window[dynJSvar].content;
					break;
				default:
					val = source[1].value;
					break;
			}
			if(val)line[columns[j].name]=val;
		}
		result.push(line);
	}
	return result;
}

// Search for a specific value in a specific column
vnfResource.prototype.search = function(column, value){
	var table = document.getElementById(this.title);

	// Search for the column by class name
	var cells = Array.prototype.slice.call( table.getElementsByClassName(this.title + column) );
	return cells.some(function(e,i){
		var boolValue = "___this_should_never_match___";
		var textValue = "___this_should_never_match___";
		if(e.value != undefined)textValue=e.value.valueOf();
		// check box case
		if(e.checked != undefined)boolValue=e.checked.toString();
		var refValue = this.valueOf();
		return boolValue === refValue || textValue === refValue;
		}, 
		value);	// this parameter is passed as this to the function
}

// Count the number of occurrences of a specific value in a specific column
//  If the value is undefined or an empty string, return the count of unique values in this column
vnfResource.prototype.count = function(column, value){
	var table = document.getElementById(this.title);
	if(value == undefined)value = new String("");

	// Search for the column by class name
	var cells = Array.prototype.slice.call( table.getElementsByClassName(this.title + column));
	// Retain values
	var values = cells.map(function(e,i){
		if(e.value != undefined){
			return String(e.value.valueOf());
		} else if(e.checked != undefined) {
			// check box case
			return String(e.checked.toString());
		}
		return String("");
	});
	var filtered = values.filter(function(e,i,t){
		// where e: element in the table, i: index in the table, t: table
		var b = this.valueOf();
		if(b == ""){
			// counting the number of unique occurrences
			// ignore empty items
			if(e == "")return false;
			// Gratitude to https://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
			var firstOccurence = t.indexOf(e);
			return  firstOccurence === i;
		}
		else
			return e === b;
		}, 
		value);	// this parameter is passed as this to the function
		
	return filtered.length;
}
// Hide or show a specific column, or the full section if no column specified
vnfResource.prototype.display = function(column, display){
	var table = document.getElementById(this.title);
	var section = document.getElementById(this.title+'Section');
	if(display == undefined){
		// The first parameter drives the visibility of the section as a boolean
		section.style.display = column ? '' : 'none';
	}else{
		// Search for the column by class name
		var cells = Array.prototype.slice.call( table.getElementsByClassName(this.title + column) );
		cells.forEach(function(e,i){e.style.display = display ? '' : 'none';});
	}
}

// Check if the table is empty, ie with no cell
vnfResource.prototype.isEmpty = function(){
	var table = document.getElementById(this.title);

	// Search for any cell in the table
	var cells = Array.prototype.slice.call( table.getElementsByTagName('td') );
	
	return cells.length == 0;
}

// Retrieve from the 'row' the value of an input field named 'column' in the list of columns'names 'nameIndexes' 
// Set the attribute of this element accordingly so that the DOM contains it for further saving
vnfResource.prototype.getAndSetValue = function(row, nameIndexes, column, defaultValue, promptText){
	if(nameIndexes.indexOf(column) < 0)return '';
	var elem=row.cells[nameIndexes.indexOf(column)].childNodes[0];
	var x=elem.value;
	if(x == "" && defaultValue != undefined && defaultValue != ""){
		if(promptText == undefined)promptText = this.title + " section: " + column + " cannot be blank.";
		elem.value = x = Misc.getValue('headless') ? defaultValue : prompt(promptText, defaultValue);
	}
	elem.removeAttribute("value");
	elem.setAttribute("value", x);
	setModifiedSession(this.title);
	return x;
}
vnfResource.prototype.getAndSetChecked = function(row, nameIndexes, column){
	if(nameIndexes.indexOf(column) < 0)return '';
	var elem=row.cells[nameIndexes.indexOf(column)].childNodes[0];
	var x=elem.checked;
	elem.removeAttribute("checked");
	if(x){
		elem.setAttribute("checked", "checked");
	}
	setModifiedSession(this.title);
	return x;
}
vnfResource.prototype.getAndSetSelection = function(row, nameIndexes, column, defaultSelection){
	if(nameIndexes.indexOf(column) < 0)return '';
	var elem=row.cells[nameIndexes.indexOf(column)].childNodes[0];
	var selectedOption=elem.options.selectedIndex;
	if(selectedOption == -1 && defaultSelection != undefined){
		elem.options.selectedIndex=selectedOption=defaultSelection;
	}
	// Remove all existing selected attributes
	for (var i=elem.options.length;i--;) { // looping over the options
	  elem.options[i].removeAttribute("selected");
	}
	var s = elem.options[selectedOption];
	if(s != undefined)s.setAttribute("selected", "selected");
	var x=elem.value;
	setModifiedSession(this.title);
	return x;
}