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
	converter = new showdown.Converter({disableForced4SpacesIndentedSublists: 'true', literalMidWordUnderscores: 'true'});

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
	https.createServer(options, app).listen(args.port, function () {console.log(new Date().toISOString()+'\tCMS5G Core Stack automated deployer listening SSL-encrypted HTTPS traffic on port ' + args.port);});
}else{
	app.listen(args.port, function () {
	  console.log(new Date().toISOString()+'\tCMS5G Core Stack automated deployer listening unencrypted traffic on port '+args.port);
	  if(args.privateKey || args.certificate)console.log(new Date().toISOString()+'\tHTTPS encryption requires both privateKey and certificate arguments: ignoring '+args.privateKey + args.certificate)
	});
}

// Get the default catalog, or the one passed as parameter or the session dump or the session HTML document
app.get(['/:session', '/:session/:target'], function (req, res, next) {
	console.log(new Date().toISOString()+'\t'+req.method+' '+req.params.target+' catalog:'+req.query.catalog+' project:'+req.query.project+' OSenv:'+req.query.OSenv+' OSnetwork:'+req.query.OSnetwork);
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
	console.log(new Date().toISOString()+'\t'+req.method+' '+req.params.target+' catalog:'+req.query.catalog+' project:'+req.query.project+' OSenv:'+req.query.OSenv+' OSnetwork:'+req.query.OSnetwork);
	JSDOM.fromFile(req.params.session, { runScripts: "dangerously" }).then(dom => {
	  var mywin=dom.window;
	  var mydom=mywin.document;
	  mywin.headless=true;
	  var direct;
	  var DOMresult=false;
	  if(req.query.project)mywin.default_project=req.query.project;
	  if(req.query.OSenv)mywin.default_openstack_env=req.query.OSenv;
	  if(req.query.OSnetwork)mywin.default_openstack_network_root=req.query.OSnetwork;
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
				if(!mywin.ouputInstallerShell()) break;
				success=undefined;
				try {
					// Use a local file to invoke the installer, since direct invocation may hit the E2BIG Linux max size for a command
					// Use a file name based on current time to avoid clashes in case of concurrent requests
          			var hpe5gInstaller='hpe5g'+Date.now()+'.sh';
					fs.writeFile(hpe5gInstaller, mywin.rawUserOutput, function(err) {
					    if(err) {
					        res.status(400).send('Direct mode: file "+hpe5gInstaller+" creation error:'+err);
					    }
					    exec("chmod a+x  "+hpe5gInstaller+"  && ./"+hpe5gInstaller, function(error, stdout, stderr){
							fs.unlink(hpe5gInstaller, function(err){if(err)console.log(new Date().toISOString()+'\tCannot remove temporary installer file '+hpe5gInstaller+': '+err);});
	                  		if(error)res.status(400).send(direct+" error\nstdout:\n"+stdout+"\nstderr:\n"+stderr); 
	                  		else res.send(stdout);
              			});
					});
				}catch(e){
					res.status(400).send('Direct mode exception: '+e);
				};
				break;
			   case 'hpe5g.sh': success=mywin.ouputInstallerShell(); break;
			   case 'dump': success=mywin.ouputInstallerShell() && mywin.jsonSession(); break;
			   case 'save': success=mywin.ouputInstallerShell() ; DOMresult=true; break;
			   case 'hpe5g.yml': 
			   case 'hpe5g.yaml': success=mywin.outputHeatTemplate(); break;
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
