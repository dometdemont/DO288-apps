# CMS5G Core Stack automated deployer
1. [Concepts and data model](#Concepts)
2. [Deployment](#Deployment)
3. [Operations](#Operations)
4. [Examples](#Examples)
5. [Sections detailed specifications](#SectionsDetails)
6. [Catalog specification](#CatalogSpecification)
    [Dynamic dependencies resolution](#dependenciesResolution)
7. [OpenStack deployment help](#OpenStackHelp)

This tool builds and run an installer deploying user defined HPE5G resources on OpenShift clusters.  
It can also deploy on OpenStack an OpenShift cluster including HPE5G resources and/or additional instances.  
It operates in two modes: interactive or headless.

For the interactive mode, open the [hpe5g.html](hpe5g.html) file in a browser. From this interface, once the application is defined as a set of resources, the user can build either:
- an installer invokable from a bash console, or 
- an OpenShift hpe5gApp application, deployable using the hpe5g operator 
     
Click the Help buttons in the user interface for more information. 

The headless mode is implemented as a [nodejs application](hpe5g.js) ; the tool is then accessible through a RESTful interface exposing three verbs: [GET](#GET), [PUT](#PUT) and [DELETE](#DELETE).  

## Concepts and data model<a name="Concepts"></a>
### Types and attributes
A type defines the nature of a resource candidate for deployment. It is defined by a name and a set of attributes. This set of attributes is common
to all types belonging to the same section.  
Examples of types: ignite, influxdb, redis, nudsf-dr  
Examples of attributes: name, project, image, storage  
### Section
A section is a logical group of types sharing the same list of attributes and the same deployment method.  
Examples: DirectServices, IndirectServices, Operators
### Resource
A resource is an instance of a type, defined by a name and a specific set of attributes values, optional or mandatory.  
A deployment consists in a list of sections, each section being a list of resources to be deployed.  
Example: memorydb is a resource of type ignite in the DirectServices section, using the image docker.io/gridgain/community:8.7.14 with 250Mi persistent storage
### Catalog
The catalog is an internal object listing all known types, their cross dependencies, and default values for all attributes.  
Some kind of types deployable through OpenShift templates must have a 'template' attribute in the catalog.  
The catalog can be exported and imported in order to expand, restrict or change the default catalog. This materializes as a json payload.  
### Session
A session is a snapshot of a specific deployment, ie a list of resources. It can be saved as an HTML or json file. An HTML session
can be used as a starting point for a deployment; typically, a set of backing services can be saved as a session and used later to resolve dependencies required by network functions deployment.
## Deployment <a name="Deployment"></a>
The headless automated deployer is a nodejs application deployed as per the [package.json](package.json) specification from [hpe5g.js](hpe5g.js) file.   
It can be deployed on any nodejs server:  
```
git clone git@github.hpe.com:CMS-5GCS/automated-deployer.git
cd automated-deployer
npm install
node hpe5g.js
```  
However, taking advantage of the OpenShift Source-to-Image capability to deploy this tool as an OpenShift pod directly from the github project is recommended.
Example deploying the tool as the pod 'automated-deployer' in the OpenShift project 'assistant':
```
oc new-project assistant
oc create secret generic s2i --type=kubernetes.io/ssh-auth --from-file=ssh-privatekey=.ssh/id_rsa
oc new-app --name automated-deployer --source-secret=s2i git@github.hpe.com:CMS-5GCS/automated-deployer.git    
oc expose svc/automated-deployer
```
### Optional arguments
This application supports three optional arguments:
- --port (alias -p): listening port, default 8080
- --privateKey (alias -k): the name of the file on the server delivering the private key used for https encryption
- --certificate (alias -c): the name of the file on the server delivering the server certificate used for https encryption

The https encryption is enabled if both the key and certificate parameters are provided. Example:
```
node hpe5g.js --port 8473 --privateKey headless.pem --certificate headless.cert.pem   
```
## Operations <a name="Operations"></a>
### Target cluster(s) connection
The installer can connect to the target cluster(s) either using the OpenShift command line (oc) or the OpenShift REST interface (curl).
If the Clusters section defines one or more enabled target(s), then the installer relies on the OpenShift REST interface invoking curl.   
If no target cluster is enabled, the installer relies on the OpenShift oc CLI to perform the deployment. 
In that case, the installer has to be invoked in the context of an OpenShift user connected to the target cluster (ie oc whoami succeeds).   
NOTE: helm based resources are deployed by invoking the helm command line: as a consequence:
- this helm CLI has to be available
- as helm is not supported by the OpenShift REST interface, no target clusters should be enabled when deploying helm based resources: the deployment is performed on the default cluster set in the context of the caller.  

### Installer invocation
The deployer REST interface offers two options to invoke the installer: direct  or local.
#### Direct
The target in the REST request is: deploy (or undeploy)
- curl -X PUT -H "Content-Type: application/json" http://ENDPOINT/SESSION/deploy ...
- curl -X DELETE -H "Content-Type: application/json" http://ENDPOINT/SESSION/undeploy ...

The installer is directly invoked from the application server running the deployer nodejs application. This requires either that:
-	The OpenShift oc CLI and/or helm are available on the nodejs server and configured with the proper user,
-	Or the curl utility is available on the nodejs server and all targeted clusters are reachable from this server.

For long lasting tasks, an asynchronous mode is available: it is enabled by passing the additional 'async' parameter to the direct request. In asynchronous mode,
the request is immediatley answered and the task progress can be checked using a GET request ending with the 'job' keyword. A running job can be stopped by submitting
a DELETE request ending with the 'job' keyword. 
#### Local
The target in the REST request is: hpe5g.sh
- curl -X PUT -H "Content-Type: application/json" http://ENDPOINT/SESSION/hpe5g.sh ...
- curl -X DELETE -H "Content-Type: application/json" http://ENDPOINT/SESSION/hpe5g.sh ...

The installer is returned to the caller for local invocation: in that case, all prerequisites apply to the caller environment, not to the nodejs server.
### OpenShift Project naming
Any resource is deployed in an OpenShift project: this project name is defined at the resource level using the Project attribute.
If this attribute is missing:
-	In the GUI, the user is prompted to provide a project name,
-	Through the REST interface, the project passed as parameter is used as a default.
-	If the project parameter is not provided in the REST request, the default hpe5g project name is used.

### OpenStack deployment<a name="OpenStack"></a>
The automated deployer can deploy a full OpenShift cluster, HPE5G resources, and/or additional instances made available to run custom tools.
#### OpenStack resources
The resources deployed are defined in four sections:
- Networks: list of private networks and public interface,
- Nodes: list of instances, their roles in an OpenShift 3.x cluster, flavors and images,
- OpenShiftNodes: list of OpenShift 4.x clusters
- Flavors: list of actual infrastructure flavors.    
Refer to the [Sections detailed specifications](#SectionsDetails) for a detailed description of each section attributes.    

#### Deployment
For resources defined in the Nodes section, the deployment is driven from an ansible playbook delivered with the automated deployer project. This playbook is invoked by the installer built by the automated deployer, either in direct or local mode. Specific prerequisites apply for OpenStack deployments to the installer execution environment:
- ansible and OpenStack client installation
- target OpenStack project definition in an file setting environment variables: OpenStack project, credentials, URLs, etc...     
For resources defined in the OpenShiftNodes section, the deployment relies on the openshift installer and openshift client provided by RedHat. A pull secret must be provided in the Misc section.
Refer to the [OpenStack deployment help](#OpenStackHelp) for installing the prerequisites and writing the environment file.  
See also an [example of OpenStack resources deployment](#ExampleOpenStack)   

### REST operations
The RESTful interface is exposing three verbs:
- [GET](#GET) to access the interactive GUI, dump an existing session or a catalog, check the asynchronous job status,
- [PUT](#PUT) to deploy a set of resources by building and retrieving or running an installer, or to build a new session,
- [DELETE](#DELETE) to delete or undeploy a set of resources and projects.
#### GET<a name="GET"></a>
##### View an existing session GUI
`curl  -X GET  http://<host:port>/<session>`   
Where:
- session is the HTML session file on the application server
##### Dump the resources defined in an existing session
`curl  -X GET  http://<host:port>/<session>/dump`   
Where:
- session is the HTML session file on the application server
##### Dump the catalog content
`curl  -X GET  http://<host:port>/<session>/catalog[?catalog=<catalog>]`   
Where:
- session is the HTML session file on the application server, typically hpe5g.html delivered as an empty session by the github project.
- Optional parameter: catalog is the catalog json file on the application server. Default: list the default catalog content. 
##### View the running job
`curl  -X GET  http://<host:port>/<session>/job`   
Where:
- session is the HTML session file on the application server    
Returns stdout/stderr along with a status code:
- if the job is running: 202 Accepted
- if the job successfully completed: 200 OK
- if the job failed: 400 Bad Request
- if no job exists: 404 Not Found

#### PUT<a name="PUT"></a>
Build and retrieve or run an installer or a Heat template from an HTML session available on the application server, or build a new session:

`curl -X PUT -H "Content-Type: application/json"  http://<host:port>/<session>/<target>[?project=<project>&async&catalog=<catalog>&OSenv=<OpenStack environment file>&OSnetwork=<OpenStack private network CIDR>] --data <resources>`

Where:
- session is the HTML session file to start from on the application server, typically hpe5g.html delivered as an empty session by the github project. This session can be user defined and dropped on the application server, for instance to start from a known set of backing services.
- target is either:
    - deploy: to deploy resources on targeted OpenStack and/or OpenShift clusters from the application server. Prerequisites on this server:
      - bash is the default shell interpreter 
      - curl or oc (OpenShift command line) or helm commands available, 
      - network connectivity to reach the target clusters
      - for OpenStack resources: 
        - ansible and OpenStack client installed, 
        - OpenStack environment file available
    - hpe5g.sh: to retrieve an installer deploying resources; this installer has to be invoked by the user to actually perform the deployment. It supports the options:
      - for OpenShift resources:
	      - --deploy | -d: to deploy the resources
	      - --undeploy | -u: to undeploy the same
	      - --log | -l file: to set the log file
	      - --help | -h for more help
      - for OpenStack resources:
	      - --deploy | -d stack: to deploy the stack and resources
	      - --undeploy | -u stack: to undeploy the same
	      - --log | -l file: to set the log file
	      - --help | -h for more help
	      - --OSenv | -e file: to define the OpenStack environment file
	      - --OSnetwork | -n network-root: to define the 3 first digits of the OpenStack private network    
	      Returned data: the list of deployed nodes is returned for user reference as a json table with four attributes per element:
	      - ipaddress: the public IP address of the node
	      - name: the node name in OpenStack
	      - groups: the ansible list of groups this node belongs to
	      - fqdn: the fully qualified domain name of this node
    - hpe5gApp.yaml: to retrieve the application definition as an HPE5gApp kind, deployable using the hpe5g operator. This operator has to be installed beforehand from https://quay.io/cnr registryNamespace: dometdemont    
    - dump: to retrieve the concatenation of resources passed as payload with the resources defined in the session; the returned json is a merge of both set of resources, ready for a single shot deployment
    - save: similar to dump, but resulting in an HTML session ready to use as a starting point for other deployments  
    - hpe5g.yaml: to retrieve an OpenStack Heat template deploying a full OpenShift cluster, HPE5G resources, and/or additional instances made available to run custom tools.       
    
- Optional parameters:
    - project is the default OpenShift project (namespace) in which resources not specifically attatched to a project are to be deployed; default: hpe5g
    - async to launch the request in asynchronous mode; the job status can then be checked with a GET request on the 'job' path, and aborted with a DELETE request on the 'job' path.
    - catalog is the catalog to use as a json file available on the application server. For the catalog specification, refer to the online help in the interactive tool, field set 'catalog'.
    - OSenv is the file defining the OpenStack target. This file must be available in the installer execution environment at deployment time. Refer to the [Nodes section detailed specifications](#SectionsDetails) for writing this environment file.
    - OSnetwork defines the 3 first numbers of the CIDR used to name the private networks, like 192.168.55
- resources is the json payload depicting the resources to deploy as:
    - a table of sections: DirectServices, IndirectServices, Operators...
    - each section's value being a table of lines
    - each line being a composite object of {attribute:value, ...} pairs

The section, attributes and values supported are detailed in [Sections detailed specifications](#SectionsDetails).  
This resources json file can be built from the interactive mode by dumping the session once populated interactively.
#### DELETE<a name="DELETE"></a>
Build and retrieve or run an undeployer from an HTML session available on the application server:   
`curl -X DELETE -H "Content-Type: application/json"  http://<host:port>/<session>/<target>[?project=<project>&catalog=<catalog>] --data <resources>`

Where all PUT parameters apply, except the target 'deploy' changed to 'undeploy' and the target 'job' used to abort an asynchronous job.
 
## Examples <a name="Examples"></a>
### Access the GUI
Navigate to:
- Empty session [http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html](http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html)
- Backing service set example session [http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html](http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html)

### Dump the services defined in the backing services set bs-set.html  
```
curl http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/dump
```
Output:   
[{"DirectServices":[{"Type":"ignite","Name":"gridgain","URL":"docker.io/gridgain","Image":"community","Tag":"8.7.14","Storage":"250Mi","Replicas":"1"},{"Type":"influxdb","Name":"udsf-flux","URL":"docker.io/bitnami","Image":"influxdb","Tag":"1.7.10","Storage":"1Gi","Replicas":"1"},{"Type":"redis","Name":"myredis","URL":"docker.io/bitnami","Image":"redis","Tag":"latest","Storage":"100Mi","Replicas":"1"}]},{"IndirectServices":[{"Type":"jenkins","Name":"myjenkins","URL":"quay.io/openshift","Image":"origin-jenkins","Tag":"latest","Replicas":"1"},{"Type":"elasticsearch","Name":"myelastic","URL":"docker.elastic.co/elasticsearch","Image":"elasticsearch-oss","Tag":"6.7.0","Storage":"4Gi","Replicas":"1"},{"Type":"prometheus-alertmanager","Name":"myalert","URL":"docker.io/prom","Image":"alertmanager","Tag":"v0.20.0","Storage":"8Gi","Replicas":"1"},{"Type":"prometheus","Name":"myprom","URL":"docker.io/prom","Image":"prometheus","Tag":"v2.16.0","Storage":"200Mi","Replicas":"1"},{"Type":"pushgateway","Name":"mygateway","URL":"docker.io/prom","Image":"pushgateway","Tag":"v1.0.1","Replicas":"1"}]},{"Operators":[{"Type":"jaeger","Name":"mike","Pipeline GIT":"https://github.hpe.com/CMS-5GCS/automated-deployer","directory":"pipelines/manual_approval","branch":"master"},{"Type":"svc-mesh-ctlplane","Name":"myplane"},{"Type":"kafka","Name":"kaaaaa"}]}]
### Dump a specific catalog  
```
curl http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/catalog?catalog=bs-only.catalog.json 
```
Output: (ellipsized)   
{"types":{"NetworkFunctions":[],"IndirectServices":["jenkins","elasticsearch","prometheus-alertmanager","prometheus","kube-state-metrics","pushgateway","grafana"],"DirectServices":["ignite","redis","influxdb","fluentd"],"Operators":["jaeger","kiali","svc-mesh-ctlplane","kafka","elasticSearchOperator"],"HelmCharts":[]},"dependencies":{"jenkins":[],"elasticsearch":[],"prometheus-alertmanager":[],"prometheus":[],"kube-state-metrics":[],"pushgateway":[],"grafana":[],"ignite":[],"redis":[],"influxdb":[],"fluentd":[],"jaeger":[],"kiali":[],"svc-mesh-ctlplane":[],"kafka":[],"elasticSearchOperator":[]},"values":{"jenkins":{"URL":"quay.io/openshift","image":"origin-jenkins","tag":"latest","template":...
### Deploy the backing services set bs-set.html on the cluster ocp1 in the project bs-set
```
curl -X PUT -H "Content-Type: application/json" http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/deploy?project=bs-set --data @- <<'EOF' 
[
  {
    "Clusters": [
      {
        "Name": "ocp1",
        "Endpoint": "api.openshift1.ocp0.gre.hpecorp.net:6443",
        "Token": "lQL18tUV4p3McWkyESXmB3rl01c9NDBF0yWQ3uaXTUY",
        "Targeted": true
      }
    ]
  }
]
EOF
```
### Undeploy the backing services set bs-set.html on the cluster ocp1 in the project bs-set
```
curl -X DELETE -H "Content-Type: application/json" http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/undeploy?project=bs-set --data '[{"Clusters":[{"Name":"ocp1","Endpoint":"api.openshift1.ocp0.gre.hpecorp.net:6443","Token":"lQL18tUV4p3McWkyESXmB3rl01c9NDBF0yWQ3uaXTUY","Targeted":true}]}]'
```
### Build an installer deploying an ignite service named memorydb in the project 'alif' using the default values
Save the installer tmp.sh deploying one ignite backing service named memorydb; all other attributes values are retrieved from the default catalog:
```
curl -X PUT -H "Content-Type: application/json" http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/hpe5g.sh?project=alif --data '[{"DirectServices":[{"Type":"ignite","Name":"memorydb"}]}]' > tmp.sh
```
Deploy by invoking this installer, then undeploy thanks to the --undeploy option
```
chmod a+x tmp.sh
./tmp.sh
./tmp.sh --undeploy
``` 
### Create a new backing services set bs-set-udsf.html from the existing bs-set adding a specific ignite version named udsf-db for udsf compatibility
Build, retrieve then copy this new backing services set to the application server:
```
curl -X PUT -H "Content-Type: application/json" http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/save?project=beta --data '[{"DirectServices": [{"Type": "ignite","Name": "udsf-db","URL": "docker.io/gridgain","Image": "community","Tag": "8.7.12"}]}]' > bs-set-udsf.html
assistant_pod=$(oc get pods -n assistant  | grep Running | awk '{print $1}')
oc cp -n assistant bs-set-udsf.html $assistant_pod:/opt/app-root/src/
```
Check the new session at http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/bs-set-udsf.html
### Deploy a udsf network function using this new backing services set
Deploy a udsf function and related services ignite, influxdb in the alif project using the bs-set-udsf backing services set deploying ignite with a specific image compatible with udsf:
```
curl -X PUT -H "Content-Type: application/json" http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/bs-set-udsf.html/deploy?project=beta --data @- <<'EOF' 
[
  {
    "Clusters": [
      {
        "Name": "ocp",
        "Endpoint": "api.openshift1.ocp0.gre.hpecorp.net:6443",
        "Token": "oFcGv7aSzDJcaaQR4r2smtULr8mz0SUQUYNfbDNi38M",
        "Targeted": true
      }
    ]
  },
  {
    "NetworkFunctions": [
      {
        "Type": "nudsf-dr",
        "Name": "myudsf",
        "Dependencies": "udsf-db,mygraf"
      }
    ]
  }
]
EOF
```
### Deploy from Helm charts udm and a specific version of telegraf 
Save in tmp.sh the installer deploying udm in the project alif:
```
curl -X PUT -H "Content-Type: application/json"  http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/hpe5g.sh --data "@helm.json" > tmp.sh
```
Where helm.json looks like:
```
[
  {
    "HelmCharts": [
      {
        "Type": "nudm-chart",
        "Name": "udm",
        "Project": "alif",
        "Chart": "hpe-nf-udm-0.9.0-005194.c3fa0f7.tgz",
        "Values": "..."
      },
      {
        "Type": "telegraf-chart",
        "Name": "telegraf-old",
        "Project": "alif",
        "Chart": "influxdata/telegraf",
        "Values": "...",
        "Version": "1.7.10",
        "Options": "--force --set key1=val1,key2=val2"
      }
    ]
  }
]
```
Deploy by invoking this installer, then undeploy thanks to the --undeploy option
```
chmod a+x tmp.sh
./tmp.sh
./tmp.sh --undeploy
```
### Deploy/undeploy in asynchronous mode three instances on OpenStack running various images <a name="ExampleOpenStack"></a>
Deploy a stack named alif hosting three instances named alpha, beta and gamma connected to the public network with floating IPs and running Centos 7, 7.5 and 7.6 respectively, the latter using a redefined performance flavor as v4.m16    
The environment configuring the OpenStack access is defined in RHOS12.env; the parameter 'async' enables the asynchronous mode; the process Id is returned as data:
```
curl -X PUT -H "Content-Type: application/json" 'http://localhost:8080/hpe5g.html/deploy?OSenv=/home/centos/automated-deployer/RHOS12.env&project=alif&async' --data @- <<'EOF' 
[
  {
    "Networks": [
      {"network": "MGMT", "interface": "eth0", "mask": "255.255.255.224"},
      {"network": "PUBLIC"}
    ]
  },
  {
    "Nodes": [
      {"MGMT fqdn": "alpha.localdomain", "MGMT IP addr": "?", "PUBLIC IP addr": "?", "Image": "Centos 7"},
      {"MGMT fqdn": "beta.localdomain", "MGMT IP addr": "?", "PUBLIC IP addr": "?", "Image": "Centos 7.5"},
      {"MGMT fqdn": "gamma.localdomain", "MGMT IP addr": "?", "PUBLIC IP addr": "?", "Flavor": "flavorPerformance", "Image": "Centos 7.6"}
    ]
  },
  {
    "Flavors": [
      {"Infrastructure": "openstack", "Flavor": "flavorPerformance", "name": "v4.m16"}
    ]
  }
]
EOF
564319
```
Wait for completion by checking the job progress:
```
curl http://localhost:8080/hpe5g.html/job

stdout:

stderr:

Asynchronous job is running: pid 564319
```
Get the instances details upon completion:
```
curl http://localhost:8080/hpe5g.html/job
stdout:
[
  {
    "ipaddress": "30.117.0.29",
    "name": "alpha",
    "groups": "base",
    "fqdn": "alpha.localdomain"
  },
  {
    "ipaddress": "30.117.0.11",
    "name": "beta",
    "groups": "base",
    "fqdn": "beta.localdomain"
  },
  {
    "ipaddress": "30.117.0.34",
    "name": "gamma",
    "groups": "base",
    "fqdn": "gamma.localdomain"
  }
]

```
Undeployment is performed by turning the PUT verb to DELETE and the deploy action to undeploy.
### Deploy/undeploy one Centos 7.6 instance named delta on OpenStack and two ignite resources on two projects on an existing OpenShift cluster
```
curl -X PUT -H "Content-Type: application/json" 'http://localhost:8080/hpe5g.html/deploy?OSenv=/home/centos/automated-deployer/RHOS12.env&project=alif' --data @- <<'EOF' 
[
  {
    "Networks": [
      {"network": "MGMT", "interface": "eth0", "mask": "255.255.255.224"},
      {"network": "PUBLIC"}
    ]
  },
  {"Nodes": [{"MGMT fqdn": "delta.localdomain", "MGMT IP addr": "?", "PUBLIC IP addr": "?", "Image": "Centos 7.6"}]},
  {"Clusters": [{"Name": "single", "Endpoint": "30.117.0.13:8443", "Token": "09XkIfb1mKnpkID8qxw8Qg3t9PGVnz3ZWIKC7u6_VUc", "Targeted": true}]},
  {"DirectServices": [
    {"Type": "ignite", "Name": "uselessdb", "Project": "first", "URL": "docker.io/gridgain", "Image": "community", "Tag": "8.7.14"},
    {"Type": "ignite", "Name": "unuseddb", "Project": "second", "URL": "docker.io/gridgain", "Image": "community", "Tag": "8.7.14"}
    ]}
]
EOF
```
Undeployment is performed by turning the PUT verb to DELETE and the deploy action to undeploy.

### Abort an asynchronous job
Deploy a stack named alif hosting three instances named alpha, beta and gamma connected to the public network with floating IPs and running Centos 7, 7.5 and 7.6 respectively, the latter using a redefined performance flavor as v4.m16   
```
curl -X PUT -H "Content-Type: application/json" 'http://localhost:8080/hpe5g.html/deploy?OSenv=/home/centos/automated-deployer/RHOS12.env&project=alif&async' --data @- <<'EOF'
[
  {
    "Networks": [
      {"network": "MGMT", "interface": "eth0", "mask": "255.255.255.224"},
      {"network": "PUBLIC"}
    ]
  },
  {
    "Nodes": [
      {"MGMT fqdn": "alpha.localdomain", "MGMT IP addr": "?", "PUBLIC IP addr": "?", "Image": "Centos 7"},
      {"MGMT fqdn": "beta.localdomain", "MGMT IP addr": "?", "PUBLIC IP addr": "?", "Image": "Centos 7.5"},
      {"MGMT fqdn": "gamma.localdomain", "MGMT IP addr": "?", "PUBLIC IP addr": "?", "Flavor": "flavorPerformance", "Image": "Centos 7.6"}
    ]
  },
  {
    "Flavors": [
      {"Infrastructure": "openstack", "Flavor": "flavorPerformance", "name": "v4.m16"}
    ]
  }
]
EOF

564668
```
Check the asynchronous job status
```
curl http://localhost:8080/hpe5g.html/job                                                                
stdout:

stderr:

Asynchronous job is running: pid 564668
```
Kill the asynchronous job
```
curl -X DELETE -H "Content-Type: application/json" http://localhost:8080/hpe5g.html/job
Job 564668 stopped
stdout:

stderr:
```

### Failure examples
##### Deploy an invalid set of resources
Attempt to deploy resources using an unknown type or unknown attributes: backing services with unknown attributes:
```
curl -X PUT -H "Content-Type: application/json" http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/hpe5g.sh --data @- <<'EOF'
[
  {
    "NetworkFunctions": [
      {
        "Type": "wild-network-function",
        "Name": "wild"
      }
    ]
  },
  {
    "DirectServices": [
      {
        "Type": "ignite",
        "Name": "memorydb",
        "URL": "docker.io/apacheignite",
        "Image": "ignite",
        "Tag": "2.7.5",
        "Wild attribute": "fancy"
      },
      {
        "Type": "influxdb",
        "Name": "myflux",
        "Storage": "100Mi"
      }
    ]
  }
]
EOF

JSON parser exception received:
Unknown selection wild-network-function for attribute Type in section NetworkFunctions
        Expecting one of: nudsf-dr,nudr-dr,nudr-prov,nudr-reg-agent,nudm-ee,nudm-li-poi,nudm-li-tf,nudm-ueau,nudm-uecm,nudm-sdm,nudm-notify,sf-cmod,nrf-reg-agent
Unknown attribute Wild attribute in section DirectServices ignored.
        Expecting one of: Type,Name,Project,URL,insecure,Image,Tag,Storage,Volume,Replicas,Dependencies,Pipeline GIT,directory,branch

```
##### Deploy a network function missing dependencies
Attempt to deploy a udsf function from an empty session not providing the ignite and influxdb required services.   
```
curl -X PUT -H "Content-Type: application/json" http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/deploy --data @- <<'EOF'
[
  {
    "Clusters": [
      {
        "Name": "ocp",
        "Endpoint": "api.openshift1.ocp0.gre.hpecorp.net:6443",
        "Token": "lQL18tUV4p3McWkyESXmB3rl01c9NDBF0yWQ3uaXTUY",
        "Targeted": true
      }
    ]
  },
  {
    "NetworkFunctions": [
      {
        "Type": "nudsf-dr",
        "Name": "myudsf"
      }
    ]
  }
]
EOF

NetworkFunctions: myudsf missing dependency ignite on project hpe5g
NetworkFunctions: myudsf missing dependency influxdb on project hpe5g
```
##### Deploy an incompatible udsf function on top of the backing services set defined in bs-set.html  
The ignite version configured in the bs-set session is not compatible with the udsf deployed version, thus preventing udsf to start.   
```
curl -X PUT -H "Content-Type: application/json" http://assistant-automated-deployer.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/deploy?project=alif --data @- <<'EOF'
[
  {
    "Clusters": [
      {
        "Name": "ocp",
        "Endpoint": "api.openshift1.ocp0.gre.hpecorp.net:6443",
        "Token": "lQL18tUV4p3McWkyESXmB3rl01c9NDBF0yWQ3uaXTUY",
        "Targeted": true
      }
    ]
  },
  {
    "NetworkFunctions": [
      {
        "Type": "nudsf-dr",
        "Name": "myudsf"
      }
    ]
  }
]
EOF
```
The installer is not able to detect this incompatibility. The client has to check the application status from the standard OpenShift API/CLI.   


<a name="SectionsDetails"></a>
## Sections detailed specifications
This chapter is a compilation of the detailed sections specifications.

### Misc
Miscellaneous settings:
- rhel_pullsecret: User secret provided by RedHat for deploying an OpenShift 4.x cluster; visit https://cloud.redhat.com/openshift/install/pull-secret
- anyuid: true|false: relax security on the OpenShift cluster before deploying resources by granting all containers the root privilege and approving pending certificates (not recommended)
- extnet: Name of the OpenStack external network used to connect the public addresses of the instances defined in the Nodes section
- UPFpassword: Encrypted password set in the Casa UPF startup configuration file; used to allow/deny the user entering the configuration mode
- UPFNRFip: NRF ip address used by UPF; supports variable like \~myocp_API\~ where myocp is the name of an OpenShift instance defined in the OpenShiftNodes section
- UPFNRFinterface: the network interface number to use to access NRF
- UPFNRFport: NRF port used by UPF
- UPFmcc: mobile country code used by UPF
- UPFmnc: mobile network code used by UPF
- headless: if not empty: do not assume a user for answering prompts and downloading files: use default values without prompting and do not save any file.
- default_project: The default OpenShift project/namespace for deploying resources
- default_action: The default installer action: deploy or undeploy
- default_openstack_env: The default OpenStack environment file name
- default_openstack_network_root: The default OpenStack network root as 3 unique digits like 192.168.199
- openstack_security_group: Name of the OpenStack security group controlling network permissions to the instances
- openstack_volume_size: Size in Gb of the specific volume allocated to each OpenStack instance:
    In that case, the OpenStack image must refer to a volume ID used for cloning.
    Default: local storage sized according to the flavor and initialiazed with the image.
- tester_nodejs_version: Nodejs version used to run the CMS5G Core Stack tester tool
- tester_git_url: Git project URL delivering the CMS5G Core Stack tester tool
- tester_deploy_key: Optional git deploy key to clone the project delivering the CMS5G Core Stack tester tool
### Networks
Network interfaces names and associated masks and resources 
- network:
    - MGMT is mandatory: all nodes should be connected to the MGMT interface
    - PUBLIC: optional external IP address of nodes visible through an address translation (mandatory for OpenStack nodes)
    - DATA1-4: optional private networks
- interface: name of the network interface on the target
- mask: Netmasks should be consistent across networks    
  The first netmask in the table sets the network width for all networks.     
  This width defines the maximum number of nodes and networks; it should be in the range 0 to 8, ie:    
    - from mask 255.255.255.0: width: 8, 1 network, 256 nodes
    - to mask 255.255.255.255: width: 1, 256 networks, 1 node
    - recommended: 255.255.255.224: width: 5, 8 networks, 32 nodes
- portgroup: VMware specific; unused on OpenStack

### OpenShiftNodes
OpenShift 4.x clusters definitions
Prerequisites:
- rhel_pullsecret: all OpenShift clusters are deployed using the RedHat secret provided in the Misc section
- openshift-install and oc available at deployment time in the path with the target OpenShift version 

Attributes:
- Name : name of the OpenShift instance to deploy
- Domain: domain name of the OpenShift instance to deploy; default: localdomain
- OSenv: name of the file providing the OpenStack environment. Retrieved from the OpenStack GUI: Project/API access
      By default, this file prompts the user for his password; to make the deployment unattended, replace the prompt with the actual password in the variable OS_PASSWORD
      Mandatory additional variables:
      - OS_CACERT: path to a file providing a specific cacert in case the SSL cert is signed by an unknown CA
      Extensions supported as additional variables: 
      - Proxy URLs for OpenShift cluster
      OPENSHIFT_HTTP_PROXY
      OPENSHIFT_HTTPS_PROXY
      OPENSHIFT_NO_PROXY
      - name of the ssh key pair defined in the OpenStack project, pushed to the OpenShift nodes for remote access (useful to connect to openshift nodes)
      OS_SSH_KEY_PAIR
- ext-net: name of the external network in the OpenStack infrastructure to connect this instance to; default: ext-net
- ext-dns: external domain name server; default 8.8.8.8
- FIPAPI/APP: floating IPs preallocated to the OpenShift cluster for the API and APP endpoints respectively. By default, those IPs are dynamically allocated if undefined or defined as a question mark(?). 
- Masters: number of masters: default 3
- Workers: number of workers : default 3
- etc-hosts: boolean enabling /etc/hosts update (requires sudo privilege) 
- Flavor/Worker flavor: shortcut defining the resources allocated for this OpenShift instance nodes; mapping to the actual flavor for the target infrastructure is based on the Flavors section
- #Volumes: quota of volumes on this OpenStack project; admin privileges required at run time if greater than the current quota; default 10

Outputs:
For each OpenShift cluster, two floating IPs are exported as templated variables resolved at deployment time, available for other resources reference:
- \~name_API\~: the cluster API floating IP
- \~name_APP\~: the cluster Application floating IP
Example:
- myocp is an OpenShift cluster deployed in this section, hosting an NRF network function
- a UPF node is defined in the Nodes section
- the UPFNRFip entry in the Misc section can be set to \~myocp_API\~ to make the UPF instance pointing to the NRF instance deployed in myocp cluster.

For each OpenShift cluster, the installer outputs an auth directory holding the kubeconfig file and kubeadmin password in a directory named like the cluster.
Example:
- myocp is an OpenShift cluster deployed in this section
- kubeconfig is in ./myocp/auth/kubeconfig
- kubadmin password is in ./myocp/auth/kubeadmin-password 

### Nodes
Nodes and roles definition and assignment
- MGMT fqdn: The domain name used in fqdn should be consistent with the infrastructure settings: on OpenStack, the domain is typically: localdomain
- MGMT IP addr: use a question mark on OpenStack (dynamic allocation)
- PUBLIC IP addr: external IP address for this nodes; use a question mark on OpenStack (dynamic allocation)
- DATA1-4 fqdn: the name of this node on the DATA1-4 network interface
- DATA1-4 IP addr: the IP address of this node on the DATA1-4 network interface; use a question mark on OpenStack (dynamic allocation)
- UPF: Casa UPF node: receives a specific configuration file /fdsk/startup-config defining network interfaces, NRF and mobile network and country codes
  - network interfaces are retrieved at runtime from OpenStack resources instantiation
  - NRF is defined in the Misc section as an IP address, a port and an interface number; 
    the IP address specified in the Misc section can be a templated variable referring to an OpenShift API floating IP as \~ocp_API\~ where ocp is the name of the OpenShift cluster defined in the OpenShiftNodes section 
  - mobile network and country codes are defined in the Misc section
- Master/Etcd/Worker: the role(s) played by this node in the OpenShift 3.x cluster    
  If no box is checked, the node is instantiated but not part of the OpenShift cluster, available for any specific usage.
- Tester: node hosting the nodejs application used as HPE network functions tester    
  This application is cloned from github using the Misc section entries tester_git_url and optionally tester_deploy_key
- Flavor: shortcut defining the resources allocated for this node; mapping to the actual flavor for the target infrastructure is based on the Flavors section
- Image or Volume: depending on the Volume boolean: either 
  - name of the qcow2 image if Volume is unchecked, or 
  - ID of the volume used to instantiate this node in OpenStack. The volume size is set in the Misc section, openstack_volume_size property
- Python3: check this box if this image is running Python3, so that ansible can manage the compatibility break

NOTE: all IP addresses dynamically allocated are available in the OpenStack Heat ouput, attribute ports, with the naming: "\~node_network\~": "IP address"
Example with 3 nodes large, medium, small on 4 networks MGMT/DATA1-3
{
  "\~large_mgmt\~": "192.168.199.5", 
  "\~large_pub\~": "30.118.0.22", 
  "\~medium_data2\~": "192.168.199.73", 
  "\~small_data2\~": "192.168.199.88", 
  "\~small_data3\~": "192.168.199.102", 
  "\~medium_pub\~": "30.118.0.77", 
  "\~medium_data3\~": "192.168.199.121", 
  "\~small_pub\~": "30.118.0.86", 
  "\~small_mgmt\~": "192.168.199.13", 
  "\~large_data2\~": "192.168.199.75", 
  "\~large_data3\~": "192.168.199.103", 
  "\~small_data1\~": "192.168.199.38", 
  "\~medium_mgmt\~": "192.168.199.16", 
  "\~large_data1\~": "192.168.199.44", 
  "\~medium_data1\~": "192.168.199.49"
} 
-  

### Flavors
Infrastructure flavors:
Default flavor of a node is defined by the roles played on this node:
- Small: Etcd
- Standard: Worker
- Large: Master    
Those default values can be overriden at the node level in the Nodes section.    
Flavors are identified by name, made available by the infrastructure administrator    
Examples:    
      Infrastructure              Flavor                Name    
           openstack          flavorTiny               v1.m2    
           openstack      flavorStandard               v2.m8    
           openstack         flavorSmall               v2.m2    
           openstack         flavorLarge               v4.m8    
           openstack   flavorPerformance              v4.m16    

### Clusters
OpenShift clusters candidate for deployment through OpenShift RESTful API:
- Name: nickname of this cluster
- Endpoint: OpenShift API endpoint for this cluster.   
  Typically retrieved from a session with: oc config current-context | cut -d/ -f2 | tr - .
- Token: security token for this cluster identifying an authorized user    
  Typically retrieved from a session with: oc whoami -t
- Targeted: check this box to deploy the defined resources to this cluster

### Builds
OpenShift builds:
The OpenShift builds defined in this section rely on custom git projects as:
- GIT URL: github project URL, eg: git@github.hpe.com:CMS-5GCS/automated-deployer.git         
- directory: (optional) directory in the github project hosting the code     
- branch: (optional) git branch to use, eg: master        
- sshKey: (optional) private ssh key enabling access the git repository                
Two types of OpenShift builds can be defined:        
- jenkins pipelines available for continuous integration of hpe5g resources:        
    The Jenkins environment variable _NAME is made available to the pipeline ; it is set to the name of the resource to which this pipeline is attached.         
    This is useful to dynamically discover OpenShift resources like routes, services ,etc.        
    Example of route retrieval in a Jenkins stage: openshift.selector( 'route/${_NAME}').object().spec.host         
    Three examples are provided by https://github.hpe.com/CMS-5GCS/automated-deployer/pipelines :            
    - get_oc_resources: display the OpenShift current project and existing resources        
    - manual_approval: expect the end  user to explicitly approve the build        
    - autotest: non regression tests for the automated deployer itself    
- custom applications available as dynamic types in the CustomApps section for instanciation.        

### CustomApps
CustomApps instantiation from GIT using source to image feature:
PREREQUISITE: the Builds section defines the build source in GIT repository for each instantiable application type.
- Type: the type of the build to instantiate as defined by the Name attribute in the Builds section 
- Name: one word resource name for this application instance
- Project: the OpenShift project hosting this application instance
- Pipeline: create a Jenkins pipeline for this application from the Builds section definition
  

### NetworkFunctions
Attributes:
- Type: the type of the resource to deploy
- Name: one word resource name for this instance
- Project: the OpenShift project hosting this resource instance
- URL, Image and tag: the docker image to use for this resource    
  Default valid values are provided when fields are left blank.
- insecure: check this box if this URL points to insecure registries    
  Images from insecure registries are pulled then pushed to the internal registry using docker, properly configured.        
  Otherwise, images are directly pulled by the OpenShift image stream from their original URL.
- Storage, Volume: the storage size with its unit (like 1Gi) and the OpenShift persistent volume used by this resource
- Replicas: number of replicas deployed for this instance.
- Dependencies: comma separated list of resources names resolving this function dependencies within this project.    
  If undefined, the first resource in the project providing the required type is used.
- Pipeline: create a Jenkins pipeline for this function from the Builds section definition
  

NetworkFunctions supported types: nudsf-dr,nudr-dr,nudr-prov,nudr-reg-agent,nudm-ee,nudm-li-poi,nudm-li-tf,nudm-ueau,nudm-uecm,nudm-sdm,nudm-notify,sf-cmod,nrf-reg-agent

### DirectServices
Attributes:
- Type: the type of the resource to deploy
- Name: one word resource name for this instance
- Project: the OpenShift project hosting this resource instance
- URL, Image and tag: the docker image to use for this resource    
  Default valid values are provided when fields are left blank.
- insecure: check this box if this URL points to insecure registries    
  Images from insecure registries are pulled then pushed to the internal registry using docker, properly configured.        
  Otherwise, images are directly pulled by the OpenShift image stream from their original URL.
- Storage, Volume: the storage size with its unit (like 1Gi) and the OpenShift persistent volume used by this resource
- Replicas: number of replicas deployed for this instance.
- Dependencies: comma separated list of resources names resolving this function dependencies within this project.    
  If undefined, the first resource in the project providing the required type is used.
- Pipeline: create a Jenkins pipeline for this function from the Builds section definition
  
NOTES:
- redis default admin password is the name of the instance.
  redis-nopwd deploys a redis instance without password 
- ignite on persistent storage deploys three volumes:
  - work
  - wal
  - walarchive   
As a consequence, the total claimed storage size is 3x the user defined size.
- ignite recommended values for udsf legacy versions are: 
  - URL: docker.io/apacheignite
  - Image: ignite
  - tag: 2.7.5

DirectServices supported types: ignite,redis,redis-nopwd,influxdb,fluentd

### IndirectServices
Attributes:
- Type: the type of the resource to deploy
- Name: one word resource name for this instance
- Project: the OpenShift project hosting this resource instance
- URL, Image and tag: the docker image to use for this resource    
  Default valid values are provided when fields are left blank.
- insecure: check this box if this URL points to insecure registries    
  Images from insecure registries are pulled then pushed to the internal registry using docker, properly configured.        
  Otherwise, images are directly pulled by the OpenShift image stream from their original URL.
- Storage, Volume: the storage size with its unit (like 1Gi) and the OpenShift persistent volume used by this resource
- Replicas: number of replicas deployed for this instance.
- Dependencies: comma separated list of resources names resolving this function dependencies within this project.    
  If undefined, the first resource in the project providing the required type is used.
- Pipeline: create a Jenkins pipeline for this function from the Builds section definition
  
NOTES: 
- jenkins recommended values for RedHat OpenShift 3 are : 
  . URL: docker.io/openshift
  . Image: jenkins-2-centos7
  . tag:latest 
- grafana default admin password is the name of the instance.
 
IndirectServices supported types: jenkins,elasticsearch,telegraf,prometheus-alertmanager,prometheus,kube-state-metrics,pushgateway,grafana

### Operators
Operator instantiation:
PREREQUISITE: the operators are installed on the target OpenShift infrastructure.
- Type: the type of the operator to instantiate
- Name: one word resource name for this operator instance
- Project: the OpenShift project hosting this operator instance
- Replicas: number of replicas passsed to this operator instance.
- Pipeline: create a Jenkins pipeline for this operator instance from the Builds section definition
  

Operators supported types: jaeger-product,cert-manager,servicemeshoperator,amq-streams,elasticsearch-operator,kiali-ossm,grafana-operator,etcd-operator,ignite-operator,prometheus-operator

### HelmCharts
HelmCharts
PREREQUISITE: Helm is installed on the target OpenShift infrastructure and configured to provide the deployed charts.
- Type: the type of the Helm chart to instantiate: used for default values and dependency check against backing services. Use 'generic' to disable checks.
- Name: one word resource name for this chart instance
- Project: the OpenShift project hosting this chart instance
- Chart: name of the chart to deploy; Helm must be configured on the infrastructure to provide this chart
- Values: local file injected in this chart as deployment values
- Version: specify the exact chart version to install. If this is not specified, the latest version is installed
- Options: additional options passed to helm at deployment time as a text string (quotes and double quotes must be backslash escaped)
- Pipeline: create a Jenkins pipeline for this chart instance from the Builds section definition
  

HelmCharts supported types: nudm-chart,nudr-chart,telegraf-chart,generic

<a name="CatalogSpecification"></a>
## Catalog specification
The catalog is an internal object defining the types and attributes of the CMS5G Core Stack resources deployable from the assistant on an OpenShift cluster.
It consists in four sections:
  - types
  - dependencies
  - values
  - admin

1. types:
  Define the name of each type of resource managed by the assistant.
  Each name must fall in one of those categories: DirectServices,IndirectServices,OperatorSources,Operators,NetworkFunctions,HelmCharts
2. dependencies:
  Define for each type the list of required resources by their type names.   
  If a dependency can be resolved by different types, a list can be provided as a json table.    
  The placeholder used in templates is the first element in this list.    
  Example: telegraf can play an influxdb type, and can be deployed as an indirect service or a helm chart.    
    The udsf resource requiring both ignite and influxdb resources can specify this dependencies list:   
  "nudsf-dr": ["ignite",["influxdb","telegraf","telegraf-chart"]]   
    The udsf template has to use the placeholders \~ignite_NAME\~ and \~influxdb_NAME\~ to enable the dependencies resolution at deployment time.    
3. values:
  Define for each type the values used as default for the resources attributes. The list of attributes offering default values depends on the resource category:
    - IndirectServices,NetworkFunctions,DirectServices: URL, image, tag, template
    - Operators: template
    - HelmCharts: chart    
4. admin:
  Define for each type if it requires special privileges for deployment (optional, default to false)    
  If true, a warning is emitted to inform the user that the deployment may fail if run without admin privileges.    

<a name="dependenciesResolution"></a>
###Template parameters and dynamic dependencies resolution
The template attribute in the values section is a YAML description of the OpenShift template used for deploying the resource. It must/may include those placeholders:
  - must: 
      - \~NAME\~ is the name of the resource
      - \~PROJECT\~ is the name of the OpenShift project (namespace)
  - may:
      - \~IMAGE\~ is the name of the docker image
      - \~REPLICAS\~ is the number of replicas
      - \~dependency_NAME\~ is a reference to the actual name of a dependency for this resource.    
      This placeholder allows dynamic resolution of dependencies between resources. For instance, in the udsf template, the datasource service name \~ignite_NAME\~ will be dynamically resolved as the actual name of the ignite instance in this project for this deployment.
      - \~VOLUME\~ if the persistent storage can be hosted on a specific volume; this placeholder is replaced with "volumeName: the_volume_name" at build time
      - \~PERSISTENCE_START\~conditional_sequence\~PERSISTENCE_END\~ useful to manage resources with optional persistent storage like ignite: 
        the conditional sequence is removed when no persistent storage is defined by the user for this resource    
     
Those placeholders are processed at build time with the actual values defined by the user.
Templates can also be loaded as files from the GUI using the Import Yaml template button in the Catalog fieldset. See the online help for more details.  

<a name="OpenStackHelp"></a>
## OpenStack deployment help

Quick user guide for deploying an OpenShift 3.x cluster in an OpenStack HPE lab infrastructure using ansible: 

- OpenStack tenant
    - Get a tenant on RHOS13 from infra team at https://cmsgvm42.gre.hpecorp.net/hos    
     Typical quota: 25 vCPUs, 50Gb RAM, 100Gb disk
    - Install and configure the infrastructure VPN as per    https://github.hpe.com/OTC-Foundation/sandboxes_user_doc/blob/master/docs/vpn.md
    - Connect to your tenant at https://30.118.132.11/dashboard/auth/login
    - in the default security group, allow all ports for TCP and UDP ingress: Networks/Security Groups/default/Manage Rules/Add Rule
    - create an ssh key pair: Compute/Key Pairs/Create Key Pair, eg mykey
    - save the private key, eg mykey.pem

- Ansible controller
    - create a network and a router connected to the external network
    - create an instance connected to this network: Compute/Instances/Launch Instance    
     from image CentOS 8.x,   
      with 20 Gb disk,   
       4 vCPUs,   
       8Gb RAM   
       embedding this ssh key,   
       and associated with a floating (public) IP, eg 30.118.0.26
    - connect to this VM as user centos with the saved ssh key eg:   
    ssh -i mykey.pem centos@30.118.0.26
    - install git httpd-tools java-1.8.0-openjdk-headless and pip from epel repository:     
     sudo  http_proxy=http://16.46.16.11:8080 https_proxy=http://16.46.16.11:8080 yum install -y epel-release     
     sudo  http_proxy=http://16.46.16.11:8080 https_proxy=http://16.46.16.11:8080 yum install -y git httpd-tools     java-1.8.0-openjdk-headless python3 python3-pip --enablerepo='epel'
    - install openstack client, ansible, shade, passlib, decorator and cryptography:    
     sudo  http_proxy=http://16.46.16.11:8080 https_proxy=http://16.46.16.11:8080 pip3 install python-openstackclient shade passlib decorator===4.4.0 ansible===2.7.4 cryptography==2.5
    - clone the CMS5G Core Stack automated deployer from git:     
     http_proxy=http://16.46.16.11:8080 https_proxy=http://16.46.16.11:8080 git clone git@10.74.128.22:CMS-5GCS/automated-deployer.git
    - move to this directory    
     cd automated-deployer
    - retrieve in this directory the private ssh key file and set ssh compliant access rights eg :    
     chmod 0600 *.pem 
 
- OpenStack target definition
    - get your tenant and project information from OpenStack portal: project/API access/view credentials
    - copy and update an example of environment definition file provided with the project, eg OKDRHOS13.env: 
      - export OS_IDENTITY_API_VERSION=3
      - export OS_AUTH_URL="https://30.118.132.11:13000/v3"
      - export OS_PASSWORD="xxxx"
      - export OS_PROJECT_ID="b5f5a70ae58d4405a780aac02094a264"
      - export OS_PROJECT_NAME="d3mRHOS13"
      - export OS_USERNAME="d3m"
    - set the ssh key to use:
      - export CLOUD_SSH_KEY_PAIR="mykey"
      - export CLOUD_SSH_KEY="/home/centos/openshift-ansible/mykey.pem"
    - set the name of the external network offering public access
      - export CLOUD_EXTERNAL_NETWORK=ext-net
    - set the default image to used:
      - export CLOUD_IMAGE="Cent OS 7"
    - retrieve the infrastructure certificate: e.g. grenoble-infra-root-ca_gs118.crt 

- Define the resources to deploy and build the installer
    - retrieve and open in a browser the assistant hpe5g.html or start from an example file provided by the git project like five.html
    - define the nodes, roles and resources, 
    - click the Installer button: the installer is downloaded, 
    - retrieve and run the installer on the ansible console. 

- Enjoy OpenShift     
The first master public IP address is available as $openshift_ip: eg 30.118.0.24
    - Connect to OpenShift GUI on this master node port 8443, eg: Browse https://$openshift_ip:8443
    - accept the security warning and log on with any name and password
    - approve the self signed certificate for the metrics display engine Hawkular by clicking the warning link in another tab
    - connect to the master, connect with the user name used in the GUI
     - ssh -i $CLOUD_SSH_KEY centos@$openshift_ip 
     - oc login -u <user>
    - invoke the deployment script: ./hpe5g.sh

- Undeploy
     - run the same installer with the --undeploy option

Conversely, OpenShift 4.x clusters are defined in the OpenShiftNodes section of the automated deployer assistant. Such deployments do not require ansible but the openshift installer and client, plus a pull secret, all retrieved from RedHat download site: https://cloud.redhat.com/openshift/install/openstack/installer-provisioned
- openshift-install and oc are to be available in the console path with the target version
- the pull secret has to be defined in the Misc section of the assistant: rhel_pullsecret
