# CMS5G Core Stack automated deployer
1. [Concepts and data model](#Concepts)
2. [Deployment](#Deployment)
3. [Operations](#Operations)
4. [Examples](#Examples)
5. [Sections detailed specifications](#SectionsDetails)

This tool builds and run an installer deploying user defined HPE5G resources on OpenShift clusters.  
It can also build a Heat stack template deploying on OpenStack an OpenShift cluster including HPE5G resources.  
It operates in two modes: interactive or headless.

For the interactive mode, open the [hpe5g.html](hpe5g.html) file in a browser and click the Help buttons for more information.

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
A resource is an instance of a type, defined by a specific set of attributes values, optional or mandatory.  
A deployment consists in a list of sections, each section being a list of resources to be deployed.  
Example: memorydb is a resource of type ignite in the DirectServices section, using the image docker.io/gridgain/community:8.7.14 with 250Mi persistent storage
### Catalog
The catalog is an internal object listing all known types, their cross dependencies, and default values for all attributes.  
Some kind of types deployable through OpenShift templates must have a 'template' attribute in the catalog.  
The default catalog can be exported and imported in order to expand, restrict or change the default catalog. This materializes as a json payload.  
### Session
A session is a snapshot of a specific deployment, ie a list of resources. It can be saved as an HTML or json file. An HTML session
can be used as a starting point for a deployment; typically, a set of backing services can be saved as a session and used later to resolve dependencies required by network functions deployment.
## Deployment <a name="Deployment"></a>
The headless automated deployer is a nodejs application deployed as per the [package.json](package.json) specification from [hpe5g.js](hpe5g.js) file.   
It can be deployed on any nodejs server:  
```
git clone https://github.hpe.com/CMS-5GCS/automated-deployer
cd automated-deployer
npm install
node hpe5g.js
```  
However, taking advantage of the OpenShift Source-to-Image capability to deploy this tool as an OpenShift pod directly from the github project is recommended.
Example deploying the tool as the pod 'automated-deployer' in the OpenShift project 'assistant':
```
oc new-project assistant
oc new-app --name automated-deployer https://github.hpe.com/CMS-5GCS/automated-deployer 
oc expose svc/automated-deployer
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
-	Or the curl utility is available on the nodejs server and all target clusters are reachable from this server.

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
-	If the project parameter is not provided in the REST request, the default hpe5g value is used.

### REST operations
The RESTful interface is exposing three verbs:
- [GET](#GET) to access the interactive GUI, dump an existing session or a catalog,
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

#### PUT<a name="PUT"></a>
Build and retrieve or run an installer or a Heat template from an HTML session available on the application server, or build a new session:

`curl -X PUT -H "Content-Type: application/json"  http://<host:port>/<session>/<target>[?project=<project>&catalog=<catalog>] --data <resources>`

Where:
- session is the HTML session file to start from on the application server, typically hpe5g.html delivered as an empty session by the github project. This session can be user defined and dropped on the application server, for instance to start from a known set of backing services.
- target is either:
    - deploy: to deploy resources on existing OpenShift clusters from the application server. Prerequisites:
      - bash is the default shell interpreter 
      - curl or oc (OpenShift command line) or helm commands available on the application server, 
      - network connectivity on the application server to reach the target clusters
      - the generated installer does not exceed Linux MAX\_ARG\_STRLEN (usually 128kB); beyond this limit, the E2BIG error is returned, and the 'hpe5g.sh' target has to be used instead of the 'deploy' one. 
    - hpe5g.sh: to retrieve an installer deploying resources on existing OpenShift clusters
    - dump: to retrieve the concatenation of resources passed as payload with the resources defined in the session; the returned json is a merge of both set of resources, ready for a single shot deployment
    - save: similar to dump, but resulting in an HTML session ready to use as a starting point for other deployments  
    - hpe5g.yaml: to retrieve an OpenStack Heat template deploying a full OpenShift cluster and HPE5G resources
- Optional parameters:
    - project is the default OpenShift project (namespace) in which resources not specifically attatched to a project are to be deployed; default: hpe5g
    - catalog is the catalog to use as a json file available on the application server. For the catalog specification, refer to the online help in the interactive tool, field set 'catalog'.
- resources is the json payload depicting the resources to deploy as:
    - a table of sections: DirectServices, IndirectServices, Operators...
    - each section's value being a table of lines
    - each line being a composite object of {attribute:value, ...} pairs

The section, attributes and values supported are detailed in [Sections detailed specifications](#SectionsDetails).  
This resources json file can be built from the interactive mode by dumping the session once populated interactively.
#### DELETE<a name="DELETE"></a>
Build and retrieve or run an undeployer from an HTML session available on the application server:   
`curl -X DELETE -H "Content-Type: application/json"  http://<host:port>/<session>/<target>[?project=<project>&catalog=<catalog>] --data <resources>`

Where all PUT parameters apply, except the target 'deploy' changed to 'undeploy'.
 
## Examples <a name="Examples"></a>
### Dump the services defined in the backing services set bs-set.html  
```
curl http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/dump
```
Output:   
[{"DirectServices":[{"Type":"ignite","Name":"gridgain","URL":"docker.io/gridgain","Image":"community","Tag":"8.7.14","Storage":"250Mi","Replicas":"1"},{"Type":"influxdb","Name":"udsf-flux","URL":"docker.io/bitnami","Image":"influxdb","Tag":"1.7.10","Storage":"1Gi","Replicas":"1"},{"Type":"redis","Name":"myredis","URL":"docker.io/bitnami","Image":"redis","Tag":"latest","Storage":"100Mi","Replicas":"1"}]},{"IndirectServices":[{"Type":"jenkins","Name":"myjenkins","URL":"quay.io/openshift","Image":"origin-jenkins","Tag":"latest","Replicas":"1"},{"Type":"elasticsearch","Name":"myelastic","URL":"docker.elastic.co/elasticsearch","Image":"elasticsearch-oss","Tag":"6.7.0","Storage":"4Gi","Replicas":"1"},{"Type":"prometheus-alertmanager","Name":"myalert","URL":"docker.io/prom","Image":"alertmanager","Tag":"v0.20.0","Storage":"8Gi","Replicas":"1"},{"Type":"prometheus","Name":"myprom","URL":"docker.io/prom","Image":"prometheus","Tag":"v2.16.0","Storage":"200Mi","Replicas":"1"},{"Type":"pushgateway","Name":"mygateway","URL":"docker.io/prom","Image":"pushgateway","Tag":"v1.0.1","Replicas":"1"}]},{"Operators":[{"Type":"jaeger","Name":"mike","Pipeline GIT":"https://github.hpe.com/CMS-5GCS/automated-deployer","directory":"pipelines/manual_approval","branch":"master"},{"Type":"svc-mesh-ctlplane","Name":"myplane"},{"Type":"kafka","Name":"kaaaaa"}]}]
### Dump a specific catalog  
```
curl http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/catalog?catalog=bs-only.catalog.json 
```
Output: (ellipsized)   
{"types":{"NetworkFunctions":[],"IndirectServices":["jenkins","elasticsearch","prometheus-alertmanager","prometheus","kube-state-metrics","pushgateway","grafana"],"DirectServices":["ignite","redis","influxdb","fluentd"],"Operators":["jaeger","kiali","svc-mesh-ctlplane","kafka","elasticSearchOperator"],"HelmCharts":[]},"dependencies":{"jenkins":[],"elasticsearch":[],"prometheus-alertmanager":[],"prometheus":[],"kube-state-metrics":[],"pushgateway":[],"grafana":[],"ignite":[],"redis":[],"influxdb":[],"fluentd":[],"jaeger":[],"kiali":[],"svc-mesh-ctlplane":[],"kafka":[],"elasticSearchOperator":[]},"values":{"jenkins":{"URL":"quay.io/openshift","image":"origin-jenkins","tag":"latest","template":...
### Deploy the backing services set bs-set.html on the cluster ocp1 in the project bs-set
```
curl -X PUT -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/deploy?project=bs-set --data '[{"Clusters":[{"Name":"ocp1","Endpoint":"api.openshift1.ocp0.gre.hpecorp.net:6443","Token":"lQL18tUV4p3McWkyESXmB3rl01c9NDBF0yWQ3uaXTUY","Targeted":true}]}]'
```
### Undeploy the backing services set bs-set.html on the cluster ocp1 in the project bs-set
```
curl -X DELETE -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/undeploy?project=bs-set --data '[{"Clusters":[{"Name":"ocp1","Endpoint":"api.openshift1.ocp0.gre.hpecorp.net:6443","Token":"lQL18tUV4p3McWkyESXmB3rl01c9NDBF0yWQ3uaXTUY","Targeted":true}]}]'
```
### Build an installer deploying an ignite service named memorydb in the project 'alif' using the default values
Save the installer tmp.sh deploying one ignite backing service named memorydb; all other attributes values are retrieved from the default catalog:
```
curl -X PUT -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/hpe5g.sh?project=alif --data '[{"DirectServices":[{"Type":"ignite","Name":"memorydb"}]}]' > tmp.sh
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
curl -X PUT -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/save?project=alif --data '[{"DirectServices": [{"Type": "ignite","Name": "udsf-db","URL": "docker.io/apacheignite","Image": "ignite","Tag": "2.7.5"}]}]' > bs-set-udsf.html
assistant_pod=$(oc get pods -n assistant  | grep Running | awk '{print $1}')
oc cp bs-set-udsf.html $assistant_pod:/tmp/bs-set-udsf.html
oc exec -it $assistant_pod -- bash -c "mv -f /tmp/bs-set-udsf.html ."
```
Check the new session at http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set-udsf.html
### Deploy a udsf network function using this new backing services set
Deploy a udsf function and related services ignite, influxdb in the alif project using the bs-set-udsf backing services set deploying ignite with a specific image compatible with udsf:
```
curl -X PUT -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set-udsf.html/deploy?project=alif --data "@udsf_bs.json"
```
Where udsf_bs.json defines one udsf network function with its backing services:
```
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
        "Name": "myudsf",
        "Dependencies": "udsf-db,udsf-flux"
      }
    ]
  }
]
```
### Deploy udm from an Helm chart
Save in tmp.sh the installer tmp.sh deploying udm in the project alpha:
```
curl -X PUT -H "Content-Type: application/json"  http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/hpe5g.sh --data "@helm.json" > tmp.sh
```
Where helm.json starts with:
```
[{"HelmCharts":[{"Type":"nudm","Name":"myudm","Project":"alpha","Chart":"hpe-nf-udm-0.9.0-005194.c3fa0f7.tgz","Values":"<Helm values>"}]}]
```
Deploy by invoking this installer, then undeploy thanks to the --undeploy option
```
chmod a+x tmp.sh
./tmp.sh
./tmp.sh --undeploy
```
### Failure examples
##### Deploy an invalid set of resources
Attempt to deploy resources using an unknown type or unknown attributes: wrong.json defines one unknown network function and backing services with unknown attributes:
```
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

curl -X PUT -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/hpe5g.sh --data "@wrong.json"
JSON parser exception received:
Unknown selection wild-network-function for attribute Type in section NetworkFunctions
        Expecting one of: nudsf-dr,nudr-dr,nudr-prov,nudr-reg-agent,nudm-ee,nudm-li-poi,nudm-li-tf,nudm-ueau,nudm-uecm,nudm-sdm,nudm-notify,sf-cmod,nrf-reg-agent
Unknown attribute Wild attribute in section DirectServices ignored.
        Expecting one of: Type,Name,Project,URL,insecure,Image,Tag,Storage,Volume,Replicas,Dependencies,Pipeline GIT,directory,branch

```
##### Deploy a network function missing dependencies
Attempt to deploy a udsf function from an empty session not providing the ignite and influxdb required services.   
```
curl -X PUT -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/deploy --data "@udsf.json"
```
Where udsf.json contains:
```
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

NetworkFunctions: myudsf missing dependency ignite on project hpe5g
NetworkFunctions: myudsf missing dependency influxdb on project hpe5g
```
##### Deploy an incompatible udsf function on top of the backing services set defined in bs-set.html  
The ignite version configured in the bs-set session is not compatible with the udsf deployed version, thus preventing udsf to start.   
```
curl -X PUT -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/deploy --data "@udsf.json"
```
The installer is not able to detect this incompatibility. The client has to check the application status from the standard OpenShift API/CLI.   

<a name="SectionsDetails"></a>

## Sections detailed specifications
This chapter is a compilation of the detailed sections specifications.

### Clusters
OpenShift clusters candidate for deployment through OpenShift RESTful API:
- Name: nickname of this cluster
- Endpoint: OpenShift API endpoint for this cluster.   
  Typically retrieved from a session with: oc config current-context | cut -d/ -f2 | tr - .
- Token: security token for this cluster identifying an authorized user    
  Typically retrieved from a session with: oc whoami -t
- Targeted: check this box to deploy the defined resources to this cluster

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
- Pipeline: create a Jenkins pipeline for this function based on a github project delivering a Jenkinsfile    
	GIT: github project URL, eg: https://github.hpe.com/CMS-5GCS/automated-deployer    
	directory: directory in the github project hosting the pipeline definition as a Jenkinsfile, eg pipelines/get_oc_resources    
	  Two examples are provided by https://github.hpe.com/CMS-5GCS/automated-deployer/pipelines :    
	  - get_oc_resources: display the OpenShift current project and existing resources        
	  - manual_approval: expect the end  user to explicitly approve the build        
	branch: (optional) git branch to use, eg: master
	

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
- Pipeline: create a Jenkins pipeline for this function based on a github project delivering a Jenkinsfile    
	GIT: github project URL, eg: https://github.hpe.com/CMS-5GCS/automated-deployer    
	directory: directory in the github project hosting the pipeline definition as a Jenkinsfile, eg pipelines/get_oc_resources    
	  Two examples are provided by https://github.hpe.com/CMS-5GCS/automated-deployer/pipelines :    
	  - get_oc_resources: display the OpenShift current project and existing resources        
	  - manual_approval: expect the end  user to explicitly approve the build        
	branch: (optional) git branch to use, eg: master
	
NOTES: 
- ignite on persistent storage deploys three volumes:
  - <name>-work
  - <name>-wal
  - <name>-walarchive   
As a consequence, the total claimed storage size is 3x the user defined size.
- ignite recommended values for udsf legacy versions are: 
  - URL: docker.io/apacheignite
  - Image: ignite
  - tag: 2.7.5

DirectServices supported types: ignite,redis,influxdb,fluentd

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
- Pipeline: create a Jenkins pipeline for this function based on a github project delivering a Jenkinsfile    
	GIT: github project URL, eg: https://github.hpe.com/CMS-5GCS/automated-deployer    
	directory: directory in the github project hosting the pipeline definition as a Jenkinsfile, eg pipelines/get_oc_resources    
	  Two examples are provided by https://github.hpe.com/CMS-5GCS/automated-deployer/pipelines :    
	  - get_oc_resources: display the OpenShift current project and existing resources        
	  - manual_approval: expect the end  user to explicitly approve the build        
	branch: (optional) git branch to use, eg: master
	
NOTES: 
- jenkins recommended values for RedHat OpenShift 3 are : 
  . URL: docker.io/openshift
  . Image: jenkins-2-centos7
  . tag:latest 
- grafana default admin password is the name of the instance.
- redis default admin password is the name of the instance.
 
IndirectServices supported types: jenkins,elasticsearch,prometheus-alertmanager,prometheus,kube-state-metrics,pushgateway,grafana

### Operators
Operator instantiation:
PREREQUISITE: the operators are installed on the target OpenShift infrastructure.
- Type: the type of the operator to instantiate
- Name: one word resource name for this operator instance
- Project: the OpenShift project hosting this operator instance
- Pipeline: create a Jenkins pipeline for this operator instance based on a github project delivering a Jenkinsfile     
	GIT: github project URL, eg: https://github.hpe.com/CMS-5GCS/automated-deployer    
	directory: (optional) directory in the github project hosting the pipeline definition as a Jenkinsfile, eg pipelines/get_oc_resources    
	  Two examples are provided by https://github.hpe.com/CMS-5GCS/automated-deployer/pipelines :     
	  - get_oc_resources: display the OpenShift current project and existing resources        
	  - manual_approval: expect the end  user to explicitly approve the build        
	branch: (optional) git branch to use, eg: master
	

Operators supported types: jaeger,kiali,svc-mesh-ctlplane,kafka,elasticSearchOperator

### HelmCharts
HelmCharts
PREREQUISITE: Helm is installed on the target OpenShift infrastructure and configured to provide the deployed charts.
- Type: the type of the Helm chart to instantiate: used for default values and dependency check against backing services. Use 'generic' to disable checks.
- Name: one word resource name for this chart instance
- Project: the OpenShift project hosting this chart instance
- Chart: name of the chart to deploy; Helm must be configured on the infrastructure to provide this chart
- Values: local file injected in this chart as deployment values
- Pipeline: create a Jenkins pipeline for this chart instance based on a github project delivering a Jenkinsfile     
	GIT: github project URL, eg: https://github.hpe.com/CMS-5GCS/automated-deployer    
	directory: (optional) directory in the github project hosting the pipeline definition as a Jenkinsfile, eg pipelines/get_oc_resources    
	  Two examples are provided by https://github.hpe.com/CMS-5GCS/automated-deployer/pipelines :     
	  - get_oc_resources: display the OpenShift current project and existing resources    
	  - manual_approval: expect the end  user to explicitly approve the build    
	branch: (optional) git branch to use, eg: master
	

HelmCharts supported types: nudm,nudr,generic