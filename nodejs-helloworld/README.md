# HPE5G automated deployer

This tool builds an installer deploying user defined HPE5G resources on OpenShift clusters.
It can also build a Heat stack template deploying on OpenStack an OpenShift cluster and the HPE5G resources.
It operates in two modes: interactive or headless.

For the interactive mode, open the hpe5g.html file in a browser and click the Help buttons for more information.

The headless mode is implemented as a nodejs application and accessible through a RESTFUL interface supporting two verbs: PUT and GET
## DEPLOYMENT
The automated deployer is to be deployed as a nodejs application as per the package.json specification.
It is recommended to take advantage of the OpenShift Source-to-Image capability to deploy this tool as an OpenShift pod from the github project.
Example deploying the tool as the pod 'hpe5g' in the project 'assistant':
- oc new-project assistant
- oc new-app --name hpe5g nodejs~https://github.hpe.com/CMS-5GCS/automated-deployer 
- oc expose svc/hpe5g
## PUT
To build and retrieve an installer or a Heat template from an HTML session available on the application server:

`curl -X PUT -H "Content-Type: application/json"  http://<host:port>/<session>/<target>[?project=<project>&catalog=<catalog>] --data @<resources>`

Where:
- session is the HTML session file to start from on the application server, typically hpe5g.html delivered as an empty session by the github project. This session can be user defined in interactive mode and dropped on the application server for the headless mode, for instance to start from a known set of backing services.
- target is either:
  - deploy: to deploy resources on existing OpenShift clusters from the application server. Prerequisites: 
    - curl or oc (OpenShift command line) available on the application server, 
    - network connectivity on the application server to reach the target clusters
  - hpe5g.sh: to build an installer deploying resources on existing OpenShift clusters
  - hpe5g.yaml: to build an OpenStack Heat template deploying a full OpenShift cluster and HPE5G resources
- Optional parameters:
  - project is the OpenShift project name (namespace) in which resources are to be deployed, optional, default: hpe5g
  - catalog is the catalog to use as a json file available on the application server. For the catalog specification, refer to the online help in the interactive tool, field set 'catalog'.
- resources is a json file depicting the resources to create as:
  - a table of sections: section:name, value:v
  - each section being a table of lines
  - each line being a table of attributes: column, value

The section, attributes and values supported are those defined in the interactive version of the automated deployer.
This json file can be built from the interactive mode by dumping the session once populated interactively.
### Example 1
Build an installer deploying an ignite service in the project 'myproject' using the default catalog:

`curl -X PUT -H "Content-Type: application/json"  http://<host>:8080/hpe5g.html/hpe5g.sh?project=myproject --data  @ignite.json`

Where ignite.json defines one ignite backing service named memorydb in the 'myproject' project:
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
### Example 2
Build an installer deploying an udsf function and related services ignite, influxdb in the default project using default values from the default catalog except for ignite deployed with a specific image and influxdb with a specific storage size:

`curl  -X PUT -H "Content-Type: application/json"  http://<host:port>/hpe5g.html/hpe5g.sh --data @udsf.json`

Where udsf.json defines one udsf network function with its backing services:
```
[
  {
    "section": "NetworkFunctions",
    "value": [
      [
        {
          "column": "Type", "value": "nudsf-dr"
        },
        {
          "column": "Name", "value": "myudsf"
        }
      ]
    ]
  },
  {
    "section": "DirectServices",
    "value": [
      [
        {"column": "Type", "value": "ignite"},
        {"column": "Name", "value": "memorydb"},
        {"column":"URL","value":"docker.io/apacheignite"},{"column":"Image","value":"ignite"},{"column":"Tag","value":"2.7.5"}
      ],
      [
        {
          "column": "Type", "value": "influxdb"
        },
        {
          "column": "Name", "value": "myflux"
        },
        {
          "column": "Storage", "value": "100Mi"
        }
      ]
    ]
  }
]
```
### Example 3
Deploy an ignite service in the default project hpe5g on the cluster named ocp1 with the end point api.openshift1.ocp0.gre.hpecorp.net:6443 and a security token
```
curl -X PUT -H "Content-Type: application/json"  http://<host:port>/hpe5g.html/deploy --data '[{"section":"Clusters","value":[[{"column":"Name","value":"ocp1"},{"column":"Endpoint","value":"api.openshift1.ocp0.gre.hpecorp.net:6443"},{"column":"Token","value":"AcwtKwq3aYBNVxYtOMc3BIlX-EF-HAHIWbTxPLL-jio"},{"column":"Targeted","value":true}]]},{"section":"DirectServices","value":[[{"column":"Type","value":"ignite"},{"column":"Name","value":"memorydb"},{"column":"Project","value":"d3m"},{"column":"URL","value":"docker.io/apacheignite"},{"column":"Image","value":"ignite"},{"column":"Tag","value":"2.7.5"},{"column":"Replicas","value":"1"}]]}]'
```
## GET
To list the resources defined in an existing session:

`curl  -X GET  http://<host:port>/<session>`
