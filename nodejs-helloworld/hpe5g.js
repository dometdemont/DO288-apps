// Refer to README.md for instructions and features
const
	fs = require('fs'),
	express = require('express'),
	minimist = require('minimist'),
	https = require('https'),
    app = express(),
	exec = require('child_process').exec,
	bodyParser = require('body-parser'),
	showdown  = require('showdown'),
	converter = new showdown.Converter({disableForced4SpacesIndentedSublists: 'true'});

let args = minimist(process.argv.slice(2), {
    default: {
        port: 8080,
        privateKey: '',
        certificate: ''
    },
    alias: {
        p: 'port',
        k: 'privateKey',
        c: 'certificate'
    }
});

// support parsing of application/json type post data
app.use(bodyParser.json());

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

//Get rid of jsdom css interpreter errors: https://github.com/jsdom/jsdom/issues/2177
const _ = require('lodash')
const originalConsoleError = console.error
console.error = function(msg) {
  if(_.startsWith(msg, '[vuex] unknown')) return
  if(_.startsWith(msg, 'Error: Could not parse CSS stylesheet')) return
  originalConsoleError(msg)
}

if(args.privateKey && args.certificate){
	// 1. Load certificates and create options
	var privateKey = fs.readFileSync(args.privateKey).toString();
	var certificate = fs.readFileSync(args.certificate).toString();
	var options = {
	key : privateKey,
	cert : certificate
	}
	// 2. start https server with options and express app.
	https.createServer(options, app).listen(args.port, function () {console.log("CMS5G Core Stack automated deployer listening SSL-encrypted HTTPS traffic on port " + args.port);});
}else{
	app.listen(args.port, function () {
	  console.log('CMS5G Core Stack automated deployer listening unencrypted traffic on port '+args.port);
	  if(args.privateKey || args.certificate)console.log('HTTPS encryption requires both privateKey and certificate arguments: ignoring '+args.privateKey + args.certificate)
	});
}

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
	  var DOMresult=false;
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
			   case 'dump': success=mywin.buildNetworkFunctions() && mywin.jsonSession(); break;
			   case 'save': success=mywin.buildNetworkFunctions() ; DOMresult=true; break;
			   case 'hpe5g.yml': 
			   case 'hpe5g.yaml': success=mywin.buildHeatTemplate(); break;
			   default: res.status(400).send('Unknown target '+req.params.target+'; expected: '+direct+', hpe5g.sh or hpe5g.y(a)ml'); break;
			}
		 }
		 switch(success){
			case true: res.send(DOMresult ? mywin.document.documentElement.outerHTML: mywin.rawUserOutput); break;
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
