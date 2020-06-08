// Refer to README.md for instructions and features
const
	fs = require('fs'),
	express = require('express'),
    app = express(),
	exec = require('child_process').exec,
	bodyParser = require('body-parser'),
	showdown  = require('showdown'),
	converter = new showdown.Converter({disableForced4SpacesIndentedSublists: 'true'});

// support parsing of application/json type post data
app.use(bodyParser.json());

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

// Get the default catalog, or the one passed as parameter or the session dump or the session HTML document
app.get(['/:session', '/:session/:target'], function (req, res, next) {
	JSDOM.fromFile(req.params.session, { runScripts: "dangerously" }).then(dom => {
	  var mywin=dom.window;
	  mywin.headless=true;
	  switch(req.params.target){
		case 'dump':
		  if(mywin.jsonSession())
			res.send(mywin.rawUserOutput);
		  else
			res.status(400).send(mywin.rawUserOutput);
		  break;
		case 'catalog':
		  function catalog(){
		  if(mywin.exportCatalog())
			res.send(mywin.rawUserOutput);
		  else
			res.status(400).send(mywin.rawUserOutput);
		  }
		  if(req.query.catalog){
			fs.readFile(req.query.catalog, "utf8", function(err, data){
			if(err) res.status(400).send(err);
			else {
				if(mywin.importCatalog(data, true))catalog();
				else res.status(400).send(mywin.rawUserOutput);
			}
		    });
		  }else
			  catalog();
		  break;
		default:
		  res.send(mywin.document.documentElement.outerHTML);
		  break;
	  }
	}).catch((err) => {
  res.status(400).send(err);
});
});

// Deploy/undeploy on various targets
app.use('/:session/:target', function (req, res, next) {
	JSDOM.fromFile(req.params.session, { runScripts: "dangerously" }).then(dom => {
	  var mywin=dom.window;
	  var mydom=mywin.document;
	  mywin.headless=true;
	  var direct;
	  if(req.query.project)mywin.default_project=req.query.project;
	  switch(req.method){
	  	case 'PUT': case 'POST': direct='deploy'; break;
	  	case 'DELETE': direct='undeploy'; break;
	  	default: res.status(400).send('Unknown verb '+req.method+'; expected: PUT POST DELETE'); break;
	  }
	  mywin.default_action=direct; 
	  
	  function deploy(){
		var success=false;
	    if(mywin.jsonSession(req.body)){
			switch(req.params.target){
			   case direct: 
				if(!mywin.buildNetworkFunctions()) break;
				success=undefined;
				exec(mywin.rawUserOutput, function(error, stdout, stderr){
					if(error)res.status(400).send(direct+' error '+error+"\nstdout:\n"+stdout+"\nstderr:\n"+stderr); 
					else res.send(stdout);
				});
				break;
			   case 'hpe5g.sh': success=mywin.buildNetworkFunctions(); break;
			   case 'hpe5g.yml': 
			   case 'hpe5g.yaml': success=mywin.buildHeatTemplate(); break;
			   default: res.status(400).send('Unknown target '+req.params.target+'; expected: '+direct+', hpe5g.sh or hpe5g.y(a)ml'); break;
			}
		 }
		 switch(success){
			case true: res.send(mywin.rawUserOutput); break;
			case false: res.status(400).send(mywin.rawUserOutput); break;
			default: /* let nodejs wait for the asynchronous final status */ break;
		 }
	  };
	  
	  if(req.query.catalog){
		fs.readFile(req.query.catalog, "utf8", function(err, data){
		if(err) res.status(400).send(err);
		else {
			if(mywin.importCatalog(data, true))
				deploy();
			else 
				res.status(400).send(mywin.rawUserOutput);
		}
	    });
	  }else
		deploy();
	}).catch((err) => {
	  res.status(400).send(err);
	});
});

// Default: get README.md
app.all('/*', function (req, res, next) {
	fs.readFile("README.md", "utf8", function(err, data){
    if(err) res.status(400).send(err);
    res.send(converter.makeHtml(data));
	});
});

app.listen(8080, function () {
  console.log('Application listening on port 8080');
});

