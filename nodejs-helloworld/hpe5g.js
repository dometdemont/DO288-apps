const
	fs = require('fs'),
	express = require('express'),
    app = express(),
	exec = require('child_process').exec,
	bodyParser = require('body-parser');

// support parsing of application/json type post data
app.use(bodyParser.json());

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

app.get('/:session', function (req, res, next) {
	JSDOM.fromFile(req.params.session, { runScripts: "dangerously" }).then(dom => {
	  var mydom=dom.window.document;
	  var mywin=dom.window;
	  mywin.headless=true;
	  if(mywin.jsonSession())
		res.send(mywin.rawUserOutput);
	  else
		next(mywin.rawUserOutput);
	}).catch((err) => {
  next(err);
});
});

app.put('/:session/:target', function (req, res, next) {
	JSDOM.fromFile(req.params.session, { runScripts: "dangerously" }).then(dom => {
	  var mywin=dom.window;
	  var mydom=mywin.document;
	  mywin.headless=true;
	  if(req.query.project)mywin.default_project=req.query.project;
	  
	  function deploy(){
		var success=false;
	    if(mywin.jsonSession(req.body)){
			switch(req.params.target){
			   case 'deploy': 
				if(!mywin.buildNetworkFunctions()) break;
				success=undefined;
				exec(mywin.rawUserOutput, function(error, stdout, stderr){
					if(error)next('Deployment error '+error+"\nstdout:\n"+stdout+"\nstderr:\n"+stderr); 
					else res.send(stdout);
				});
				break;
			   case 'hpe5g.sh': success=mywin.buildNetworkFunctions(); break;
			   case 'hpe5g.yml': 
			   case 'hpe5g.yaml': success=mywin.buildHeatTemplate(); break;
			   default: next('Unknown target '+req.params.target+'; expected: hpe5g.sh or hpe5g.y(a)ml'); break;
			}
		 }
		 switch(success){
			case true: res.send(mywin.rawUserOutput); break;
			case false: next(mywin.rawUserOutput); break;
			default: /* let nodejs wait for the asynchronous final status */ break;
		 }
	  };
	  
	  if(req.query.catalog){
		fs.readFile(req.query.catalog, "utf8", function(err, data){
		if(err) next(err);
		else {
			if(mywin.importCatalog(data, true))
				deploy();
			else 
				next(mywin.rawUserOutput);
		}
	    });
	  }else
		deploy();
	}).catch((err) => {
	  next(err);
	});
});

app.all('/*', function (req, res, next) {
	fs.readFile("README.md", "utf8", function(err, data){
    if(err) next(err);
    res.send(data);
	});
});

app.listen(8080, function () {
  console.log('Application listening on port 8080');
});

