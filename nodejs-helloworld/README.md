# CMS5G Core Stack automated deployer
1. [Concepts](#Concepts)
2. [Deployment](#Deployment)
3. [Operations](#Operations)
4. [Examples](#Examples)

This tool builds and run an installer deploying user defined HPE5G resources on OpenShift clusters.  
It can also build a Heat stack template deploying on OpenStack an OpenShift cluster including HPE5G resources.  
It operates in two modes: interactive or headless.

For the interactive mode, open the hpe5g.html file in a browser and click the Help buttons for more information.

The headless mode is implemented as a nodejs application ; the tool is then accessible through a RESTful interface exposing two verbs: PUT and GET.  

## Concepts <a name="Concepts"></a>
### Types and attributes
A type defines the nature of a resource candidate for deployment. It is defined by a name and a set of attributes. This set of attributes is common
to all types belonging to the same section.  
Examples of types: ignite, influxdb, redis, nudsf-dr  
Examples of attributes: name, project, image, storage  
### Section
A section is a logical group of types sharing the same list of attributes.  
Examples: DirectServices, IndirectServices, Operators
### Resource
A resource is an instance of a type, defined by a specific set of attributes values, optional or mandatory.  
A deployment consists in a list of resources to be deployed.  
Example: memorydb is a resource of type ignite in the DirectServices section, using the image docker.io/gridgain/community:8.7.14 with 250Mi persistent storage
### Catalog
The catalog is an internal object listing all known types, their cross dependencies, and default values for all attributes.  
Some kind of types deployable through OpenShift templates must have a 'template' attribute in the catalog.  
The default catalog can be exported using the GUI, or imported in order to expand, restrict or change the default catalog. This materializes as a Json payload.  
### Session
A session is a snapshot of a specific deployment, ie a list of resources. It can be saved from the GUI as an HTML or Json file. An HTML session
can be used as a starting point for a deployment; typically, a set of backing services can be saved as a session and used later to resolve dependencies required by some network functions deployment.
## Deployment <a name="Deployment"></a>
The automated deployer is a nodejs application deployed as per the package.json specification from hpe5g.js file.   
It can be deployed on any nodejs server:  
```
node hpe5g.js
```  
However, taking advantage of the OpenShift Source-to-Image capability to deploy this tool as an OpenShift pod from the github project is recommended.  
Example deploying the tool as the pod 'automated-deployer' in the OpenShift project 'assistant':
```
oc new-project assistant
oc new-app --name automated-deployer nodejs~https://github.hpe.com/CMS-5GCS/automated-deployer 
oc expose svc/automated-deployer
```

## Operations <a name="Operations"></a>
### GET
To list the resources defined in an existing session:

`curl  -X GET  http://<host:port>/<session>`
### PUT
To build and retrieve or run an installer or a Heat template from an HTML session available on the application server:

`curl -X PUT -H "Content-Type: application/json"  http://<host:port>/<session>/<target>[?project=<project>&catalog=<catalog>] --data <resources>`

Where:
- session is the HTML session file to start from on the application server, typically hpe5g.html delivered as an empty session by the github project. This session can be user defined in interactive mode and dropped on the application server for the headless mode, for instance to start from a known set of backing services.
- target is either:
    - deploy: to deploy resources on existing OpenShift clusters from the application server. Prerequisites: 
      - curl or oc (OpenShift command line) available on the application server, 
      - network connectivity on the application server to reach the target clusters
    - hpe5g.sh: to build an installer deploying resources on existing OpenShift clusters
    - hpe5g.yaml: to build an OpenStack Heat template deploying a full OpenShift cluster and HPE5G resources
- Optional parameters:
    - project is the default OpenShift project (namespace) in which resources not specifically attatched to a project are to be deployed; default: hpe5g
    - catalog is the catalog to use as a json file available on the application server. For the catalog specification, refer to the online help in the interactive tool, field set 'catalog'.
- resources is the json payload depicting the resources to deploy as:
    - a table of sections: each entry must provide two attributes: section (DirectServices, IndirectServices, Operators...) and value
    - each section's value being a table of lines
    - each line being a table of attributes: column, value

The section, attributes and values supported are those defined in the interactive version of the automated deployer.  
This json file can be built from the interactive mode by dumping the session once populated interactively.
## Examples <a name="Examples"></a>
### List the services defined in the backing services set bs-set.html  
```
curl http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html
[{"section":"DirectServices","value":[[{"column":"Type","value":"ignite"},{"column":"Name","value":"gridgain"},{"column":"URL","value":"docker.io/gridgain"},{"column":"Image","value":"community"},{"column":"Tag","value":"8.7.14"},{"column":"Storage","value":"250Mi"},{"column":"Replicas","value":"1"}],[{"column":"Type","value":"fluentd"},{"column":"Name","value":"myfluent"},{"column":"URL","value":"gcr.io/google-containers"},{"column":"Image","value":"fluentd-elasticsearch"},{"column":"Tag","value":"v2.4.0"},{"column":"Replicas","value":"1"}],[{"column":"Type","value":"influxdb"},{"column":"Name","value":"udsf-flux"},{"column":"URL","value":"docker.io/bitnami"},{"column":"Image","value":"influxdb"},{"column":"Tag","value":"1.7.10"},{"column":"Storage","value":"1Gi"},{"column":"Replicas","value":"1"}],[{"column":"Type","value":"redis"},{"column":"Name","value":"myredis"},{"column":"URL","value":"docker.io/bitnami"},{"column":"Image","value":"redis"},{"column":"Tag","value":"latest"},{"column":"Storage","value":"100Mi"},{"column":"Replicas","value":"1"}]]},{"section":"IndirectServices","value":[[{"column":"Type","value":"jenkins"},{"column":"Name","value":"myjenkins"},{"column":"URL","value":"quay.io/openshift"},{"column":"Image","value":"origin-jenkins"},{"column":"Tag","value":"latest"},{"column":"Replicas","value":"1"}],[{"column":"Type","value":"elasticsearch"},{"column":"Name","value":"myelastic"},{"column":"URL","value":"docker.elastic.co/elasticsearch"},{"column":"Image","value":"elasticsearch-oss"},{"column":"Tag","value":"6.7.0"},{"column":"Storage","value":"4Gi"},{"column":"Replicas","value":"1"}],[{"column":"Type","value":"prometheus-alertmanager"},{"column":"Name","value":"myalert"},{"column":"URL","value":"docker.io/prom"},{"column":"Image","value":"alertmanager"},{"column":"Tag","value":"v0.20.0"},{"column":"Storage","value":"8Gi"},{"column":"Replicas","value":"1"}],[{"column":"Type","value":"prometheus"},{"column":"Name","value":"myprom"},{"column":"URL","value":"docker.io/prom"},{"column":"Image","value":"prometheus"},{"column":"Tag","value":"v2.16.0"},{"column":"Storage","value":"200Mi"},{"column":"Replicas","value":"1"}],[{"column":"Type","value":"pushgateway"},{"column":"Name","value":"mygateway"},{"column":"URL","value":"docker.io/prom"},{"column":"Image","value":"pushgateway"},{"column":"Tag","value":"v1.0.1"},{"column":"Replicas","value":"1"}]]},{"section":"Operators","value":[[{"column":"Type","value":"jaeger"},{"column":"Name","value":"mike"},{"column":"Pipeline GIT","value":"https://github.hpe.com/CMS-5GCS/automated-deployer"},{"column":"directory","value":"pipelines/manual_approval"},{"column":"branch","value":"master"}],[{"column":"Type","value":"svc-mesh-ctlplane"},{"column":"Name","value":"myplane"}],[{"column":"Type","value":"kafka"},{"column":"Name","value":"kaaaaa"}]]}]
```
### Deploy the backing services set bs-set.html on the cluster ocp1 in the namespace bs-set
```
curl -X PUT -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/deploy?project=bs-set --data '[{"section":"Clusters","value":[[{"column":"Name","value":"ocp1"},{"column":"Endpoint","value":"api.openshift1.ocp0.gre.hpecorp.net:6443"},{"column":"Token","value":"HFo4rcRPyVdwqbq4X8VPN1j1em_ORXBwCxpnMdNakVE"},{"column":"Targeted","value":true}]]}]'
```

### Build an installer deploying an udsf function on top of the backing services set defined in bs-set.html  
```
curl.exe -X PUT -H "Content-Type: application/json" http://localhost:8080/bs-set.html/hpe5g.sh --data "@udsf.json"
Where udsf.json is '[{"section": "NetworkFunctions","value": [[{"column": "Type", "value": "nudsf-dr"}]]}]'
```
### Build an installer deploying an ignite service named memorydb in the project 'myproject' using the default values
```
curl.exe -X PUT -H "Content-Type: application/json"  http://localhost:8080/hpe5g.html/hpe5g.sh?project=myproject --data "@ignite.json"
```
Where ignite.json defines one ignite backing service named memorydb; all other values are retrieved from the default catalog:
```
[
  {
    "section": "DirectServices",
    "value": [
      [
        {"column": "Type", "value": "ignite"},
        {"column": "Name", "value": "memorydb"}
      ]
    ]
  }
]
```
### Installer for a network function and services with specific image 
Build an installer deploying an udsf function and related services ignite, influxdb in the default project using default values from the default catalog except for ignite deployed with a specific image and influxdb with a specific storage size:
```
curl.exe  -X PUT -H "Content-Type: application/json"  http://localhost:8080/hpe5g.html/hpe5g.sh --data "@udsf_bs.json"
```
Where udsf_bs.json defines one udsf network function with its backing services:
```
[
  {
    "section": "NetworkFunctions",
    "value": [
      [
        {"column": "Type", "value": "nudsf-dr"},
        {"column": "Name", "value": "myudsf"}
      ]
    ]
  },
  {
    "section": "DirectServices",
    "value": [
      [
        {"column": "Type", "value": "ignite"},
        {"column": "Name", "value": "memorydb"},
        {"column":"URL","value":"docker.io/apacheignite"},
        {"column":"Image","value":"ignite"},
        {"column":"Tag","value":"2.7.5"}
      ],
      [
        {"column": "Type", "value": "influxdb"},
        {"column": "Name", "value": "myflux"},
        {"column": "Storage", "value": "100Mi"}
      ]
    ]
  }
]
```
### Deploy one single service with a specific image on one single cluster
Deploy an ignite service with the image docker.io/apacheignite/ignite:2.7.5 in the default project hpe5g on the cluster named ocp1 with the end point api.openshift1.ocp0.gre.hpecorp.net:6443 and a security token
```
curl -X PUT -H "Content-Type: application/json"  http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/deploy --data '[{"section":"Clusters","value":[[{"column":"Name","value":"ocp1"},{"column":"Endpoint","value":"api.openshift1.ocp0.gre.hpecorp.net:6443"},{"column":"Token","value":"HFo4rcRPyVdwqbq4X8VPN1j1em_ORXBwCxpnMdNakVE"},{"column":"Targeted","value":true}]]},{"section":"DirectServices","value":[[{"column":"Type","value":"ignite"},{"column":"Name","value":"memorydb"},{"column":"Project","value":"d3m"},{"column":"URL","value":"docker.io/apacheignite"},{"column":"Image","value":"ignite"},{"column":"Tag","value":"2.7.5"},{"column":"Replicas","value":"1"}]]}]'
```