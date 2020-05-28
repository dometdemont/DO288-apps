# CMS5G Core Stack automated deployer
1. [Concepts and data model](#Concepts)
2. [Deployment](#Deployment)
3. [Operations](#Operations)
4. [Examples](#Examples)

This tool builds and run an installer deploying user defined HPE5G resources on OpenShift clusters.  
It can also build a Heat stack template deploying on OpenStack an OpenShift cluster including HPE5G resources.  
It operates in two modes: interactive or headless.

For the interactive mode, open the [hpe5g.html](hpe5g.html) file in a browser and click the Help buttons for more information.

The headless mode is implemented as a [nodejs application](hpe5g.js) ; the tool is then accessible through a RESTful interface exposing two verbs: PUT and GET.  

## Concepts and data model<a name="Concepts"></a>
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
A deployment consists in a list of sections, each section being a list of resources to be deployed.  
Example: memorydb is a resource of type ignite in the DirectServices section, using the image docker.io/gridgain/community:8.7.14 with 250Mi persistent storage
### Catalog
The catalog is an internal object listing all known types, their cross dependencies, and default values for all attributes.  
Some kind of types deployable through OpenShift templates must have a 'template' attribute in the catalog.  
The default catalog can be exported using the GUI, or imported in order to expand, restrict or change the default catalog. This materializes as a json payload.  
### Session
A session is a snapshot of a specific deployment, ie a list of resources. It can be saved from the GUI as an HTML or json file. An HTML session
can be used as a starting point for a deployment; typically, a set of backing services can be saved as a session and used later to resolve dependencies required by network functions deployment.
## Deployment <a name="Deployment"></a>
The headless automated deployer is a nodejs application deployed as per the [package.json](package.json) specification from [hpe5g.js](hpe5g.js) file.   
It can be deployed on any nodejs server:  
```
git clone https://github.hpe.com/CMS-5GCS/automated-deployer
cd automated-deployer
node hpe5g.js
```  
However, taking advantage of the OpenShift Source-to-Image capability to deploy this tool as an OpenShift pod directly from the github project is recommended.
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
    - each line being a table of {attribute: value}

The section, attributes and values supported are those defined in the interactive version of the automated deployer.  
This resources json file can be built from the interactive mode by dumping the session once populated interactively.
## Examples <a name="Examples"></a>
### List the services defined in the backing services set bs-set.html  
```
curl http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html
[{"section":"DirectServices":[[{"Type":"ignite"},{"Name":"gridgain"},{"URL":"docker.io/gridgain"},{"Image":"community"},{"Tag":"8.7.14"},{"Storage":"250Mi"},{"Replicas":"1"}],[{"Type":"fluentd"},{"Name":"myfluent"},{"URL":"gcr.io/google-containers"},{"Image":"fluentd-elasticsearch"},{"Tag":"v2.4.0"},{"Replicas":"1"}],[{"Type":"influxdb"},{"Name":"udsf-flux"},{"URL":"docker.io/bitnami"},{"Image":"influxdb"},{"Tag":"1.7.10"},{"Storage":"1Gi"},{"Replicas":"1"}],[{"Type":"redis"},{"Name":"myredis"},{"URL":"docker.io/bitnami"},{"Image":"redis"},{"Tag":"latest"},{"Storage":"100Mi"},{"Replicas":"1"}]]},{"section":"IndirectServices":[[{"Type":"jenkins"},{"Name":"myjenkins"},{"URL":"quay.io/openshift"},{"Image":"origin-jenkins"},{"Tag":"latest"},{"Replicas":"1"}],[{"Type":"elasticsearch"},{"Name":"myelastic"},{"URL":"docker.elastic.co/elasticsearch"},{"Image":"elasticsearch-oss"},{"Tag":"6.7.0"},{"Storage":"4Gi"},{"Replicas":"1"}],[{"Type":"prometheus-alertmanager"},{"Name":"myalert"},{"URL":"docker.io/prom"},{"Image":"alertmanager"},{"Tag":"v0.20.0"},{"Storage":"8Gi"},{"Replicas":"1"}],[{"Type":"prometheus"},{"Name":"myprom"},{"URL":"docker.io/prom"},{"Image":"prometheus"},{"Tag":"v2.16.0"},{"Storage":"200Mi"},{"Replicas":"1"}],[{"Type":"pushgateway"},{"Name":"mygateway"},{"URL":"docker.io/prom"},{"Image":"pushgateway"},{"Tag":"v1.0.1"},{"Replicas":"1"}]]},{"section":"Operators":[[{"Type":"jaeger"},{"Name":"mike"},{"Pipeline GIT":"https://github.hpe.com/CMS-5GCS/automated-deployer"},{"directory":"pipelines/manual_approval"},{"branch":"master"}],[{"Type":"svc-mesh-ctlplane"},{"Name":"myplane"}],[{"Type":"kafka"},{"Name":"kaaaaa"}]]}]
```
### Deploy the backing services set bs-set.html on the cluster ocp1 in the project bs-set
```
curl -X PUT -H "Content-Type: application/json" http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/bs-set.html/deploy?project=bs-set --data '[{"section":"Clusters":[[{"Name":"ocp1"},{"Endpoint":"api.openshift1.ocp0.gre.hpecorp.net:6443"},{"Token":"HFo4rcRPyVdwqbq4X8VPN1j1em_ORXBwCxpnMdNakVE"},{"Targeted":true}]]}]'
```

### Build an installer deploying an udsf function on top of the backing services set defined in bs-set.html  
```
curl.exe -X PUT -H "Content-Type: application/json" http://localhost:8080/bs-set.html/hpe5g.sh --data "@udsf.json"
Where udsf.json contains:
[{"section": "NetworkFunctions","value": [[{"Type": "nudsf-dr"}]]}]
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
        {"Type": "ignite"},
        {"Name": "memorydb"}
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
        {"Type": "nudsf-dr"},
        {"Name": "myudsf"}
      ]
    ]
  },
  {
    "section": "DirectServices",
    "value": [
      [
        {"Type": "ignite"},
        {"Name": "memorydb"},
        {"URL":"docker.io/apacheignite"},
        {"Image":"ignite"},
        {"Tag":"2.7.5"}
      ],
      [
        {"Type": "influxdb"},
        {"Name": "myflux"},
        {"Storage": "100Mi"}
      ]
    ]
  }
]
```
### Deploy one single service with a specific image on one single cluster
Deploy an ignite service with the image docker.io/apacheignite/ignite:2.7.5 in the default project hpe5g on the cluster named ocp1 with the end point api.openshift1.ocp0.gre.hpecorp.net:6443 and a security token
```
curl -X PUT -H "Content-Type: application/json"  http://automated-deployer-assistant.apps.openshift1.ocp0.gre.hpecorp.net/hpe5g.html/deploy --data '[{"section":"Clusters":[[{"Name":"ocp1"},{"Endpoint":"api.openshift1.ocp0.gre.hpecorp.net:6443"},{"Token":"HFo4rcRPyVdwqbq4X8VPN1j1em_ORXBwCxpnMdNakVE"},{"Targeted":true}]]},{"section":"DirectServices":[[{"Type":"ignite"},{"Name":"memorydb"},{"Project":"d3m"},{"URL":"docker.io/apacheignite"},{"Image":"ignite"},{"Tag":"2.7.5"},{"Replicas":"1"}]]}]'
```
### Deploy an invalid set of resources
Attempt to deploy resources using an unknown type or unknown attributes: wrong.json defines one unknown network function and backing services with unknown attributes:
```
[
  {
    "section": "NetworkFunctions",
    "value": [
      [
        {"Type": "wild-network-function"},
        {"Name": "wild"}
      ]
    ]
  },
  {
    "section": "DirectServices",
    "value": [
      [
        {"Type": "ignite"},
        {"Name": "memorydb"},
        {"URL":"docker.io/apacheignite"},
        {"Image":"ignite"},
        {"Tag":"2.7.5"},
        {"Wild attribute":"fancy"}
      ],
      [
        {"Type": "influxdb"},
        {"Name": "myflux"},
        {"EphemeralStorage": "100Mi"}
      ]
    ]
  }
]

curl.exe  -X PUT -H "Content-Type: application/json"  http://localhost:8080/hpe5g.html/hpe5g.sh --data "@wrong.json"
JSON parser exception received:
Unknown selection wild-network-function for attribute Type in section NetworkFunctions
        Expecting one of: nudsf-dr,nudr-dr,nudr-prov,nudr-reg-agent,nudm-ee,nudm-li-poi,nudm-sdm,nudm-notify,sf-cmod,nrf-reg-agent
Unknown attribute Wild attribute in section DirectServices ignored.
        Expecting one of: Type,Name,Project,URL,insecure,Image,Tag,Storage,Volume,Replicas,Pipeline GIT,directory,branch
Unknown attribute EphemeralStorage in section DirectServices ignored.
        Expecting one of: Type,Name,Project,URL,insecure,Image,Tag,Storage,Volume,Replicas,Pipeline GIT,directory,branch
```