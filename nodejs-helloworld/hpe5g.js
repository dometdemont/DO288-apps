// Refer to README.md for instructions and features
const
	fs = require('fs'),
	express = require('express'),
	minimist = require('minimist'),
	https = require('https'),
    app = express(),
	exec = require('child_process').exec,
	spawn = require('child_process').spawn,
	bodyParser = require('body-parser'),
	showdown  = require('showdown'),
	converter = new showdown.Converter({disableForced4SpacesIndentedSublists: 'true', literalMidWordUnderscores: 'true'});
	
	// One aync job allowed for long processing tasks
	var job = null //keeping the job in memory to kill it
	var jobStdout = '';
	var jobStderr = '';

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
	console.log(new Date().toISOString()+'\t'+req.method+' '+req.params.target+' session: '+req.params.session+' catalog:'+req.query.catalog+' project:'+req.query.project+' OSenv:'+req.query.OSenv+' OSnetwork:'+req.query.OSnetwork);
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
		case 'job':
			var message= '\nstdout:\n'+jobStdout+'\nstderr:\n'+jobStderr;
			var returnCode=null;
			if(job){
				// The job is running: if it can receive a signal, return 202 accepted, otherwise an internal error with the caught exception 
				try {job.kill(0) ; returnCode=202; message+='\nAsynchronous job is running: pid '+job.pid;} catch(e) {message=e ; returnCode=500; }
			}else{
				// The job is done or not started, depending on the stdout and stderr content
				if(!jobStdout){returnCode=404; message='No asynchronous job found';}
				else{
					// The job is ended
					returnCode=jobStderr?400:200;
				}
			}
			return res.status(returnCode).send(message).end()
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
	var syncMsg=req.query.async != undefined?' asynchronously ':' synchronously ';
	console.log(new Date().toISOString()+'\t'+req.method+syncMsg+req.params.target+' session: '+req.params.session+' catalog:'+req.query.catalog+' project:'+req.query.project+' OSenv:'+req.query.OSenv+' OSnetwork:'+req.query.OSnetwork);
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
				if(!mywin.outputInstallerShell()) break;
				success=undefined;
				try {
					// Use a local file to invoke the installer, since direct invocation may hit the E2BIG Linux max size for a command
					// Use a file name based on current time to avoid clashes in case of concurrent requests
          			var hpe5gInstaller='hpe5g'+Date.now()+'.sh';
					var cmd="./"+hpe5gInstaller;
					fs.writeFile(hpe5gInstaller, mywin.rawUserOutput, { mode: '0755'},  function(err) {
					    if(err) {
					        res.status(400).send('Direct mode: file "+hpe5gInstaller+" creation error:'+err);
					    }
						else if(req.query.async != undefined){
							if(job && job.pid){
								res.status(400).send('Asynchronous job is already running: pid '+job.pid).end();
							}else{
								jobStdout = '';
								jobStderr = '';
								job = spawn(cmd);
								job.on('close', function(code) {job = null})
								job.stdout.on('data', function(data){jobStdout += data.toString(); })
								job.stderr.on('data', function(data){jobStderr += data.toString(); })
								res.status(200).send(job.pid.toString()) //created
							}
						}
						else
						    exec(cmd, function(error, stdout, stderr){
								fs.unlink(hpe5gInstaller, function(err){if(err)console.log(new Date().toISOString()+'\tCannot remove temporary installer file '+hpe5gInstaller+': '+err);});
		                  		if(error)res.status(400).send(direct+" error\nstdout:\n"+stdout+"\nstderr:\n"+stderr); 
		                  		else res.send(stdout);
	              			});
					});
				}catch(e){
					res.status(400).send('Direct mode exception: '+e);
				};
				break;
				case 'job': 
					success=undefined;
					if(req.method != 'DELETE'){res.status(400).send(req.method+' unknown target '+req.params.target+'; expected: undeploy, hpe5g.sh or hpe5g.y(a)ml'); break;}
					if(!job || !job.pid){res.status(404).send('No asynchronous job to stop'); break;}
					var message='Job '+job.pid+' stopped\nstdout:\n'+jobStdout+'\nstderr:\n'+jobStderr;
					job.kill('SIGTERM')
					job = null
					res.status(200).send(message);
					break;
			   case 'hpe5g.sh': success=mywin.outputInstallerShell(); break;
			   case 'dump': success=mywin.outputInstallerShell() && mywin.jsonSession(); break;
			   case 'save': success=mywin.outputInstallerShell() ; DOMresult=true; break;
			   case 'hpe5g.yml': 
			   case 'hpe5g.yaml': success=mywin.outputHeatTemplate(); break;
         case 'hpe5gApp.yml':
         case 'hpe5gApp.yaml': success=mywin.outputAppHpe5g(); break;
			   default: success=undefined; res.status(400).send('Unknown target '+req.params.target+'; expected: '+direct+', job, hpe5g.sh or hpe5g.y(a)ml, hpe5gApp.y(a)ml, dump, save'); break;
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
