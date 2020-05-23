Welcome to the HPE5G automated deployer.

This tool builds an installer deploying user defined HPE5G resources on OpenShift clusters.
It can also build a Heat stack template deploying on OpenStack an OpenShift cluster and the HPE5G resources.
It operates in two modes: interactive or headless.

For the interactive mode, open the hpe5g.html file in a browser and click the Help buttons for more information.

The headless mode is implemented as a nodejs application and accessible through a RESTFUL interface supporting two verbs: PUT and GET

PUT:
To build and retrieve an installer or a Heat template from an HTML session available on the application server:
curl -X PUT -H "Content-Type: application/json"  http://localhost:8080/<session>/<target>[?project=<project>&catalog=<catalog>] --data @<resources>
Where:
1. <session> is the HTML session file to start from on the application server, typically hpe5g.html delivered as an empty session by the github project. This session can be user defined in interactive mode and dropped on the application server for the headless mode, for instance to start from a known set of backing services.
2. <target> is either:
2.1 deploy: to deploy resources on existing OpenShift clusters from the application server. Prerequisites: 
	curl or oc (OpenShift command line) available on the application server, 
	network connectivity on the application server to reach the target clusters
2.2 hpe5g.sh: to build an installer deploying resources on existing OpenShift clusters
2.3 hpe5g.yaml: to build an OpenStack Heat template deploying a full OpenShift cluster and HPE5G resources
3. Optional parameters:
3.1 <project> is the OpenShift project name (namespace) in which resources are to be deployed, optional, default: hpe5g
3.2 <catalog> is the catalog to use as a json file available on the application server.
4. <resources> is a json file depicting the resources to create as:
4.1 a table of sections: section:name, value:v
4.2 each section being a table of lines
4.3 each line being a table of attributes: column, value
The section, attributes and values supported are those defined in the interactive version of the automated deployer.
This json file can be built from the interactive mode by dumping the session once populated interactively.

Examples:
curl  -X PUT -H "Content-Type: application/json"  http://localhost:8080/hpe5g.html/hpe5g.sh?project=myproject --data  @node/ignite.json
Where ignite.json defines one ignite backing service named memorydb in the 'myproject' project:
[
  {
    "section": "DirectServices",
    "value": [
      [
        {
          "column": "Type",
          "value": "ignite"
        },
        {
          "column": "Name",
          "value": "memorydb"
        }
      ]
    ]
  }
]

curl  -X PUT -H "Content-Type: application/json"  http://localhost:8080/hpe5g.html/hpe5g.sh --data  @node/udsf.json
Where udsf.json defines one udsf network function with its backing services:
[
  {
    "section": "NetworkFunctions",
    "value": [
      [
        {
          "column": "Type",
          "value": "nudsf-dr"
        },
        {
          "column": "Name",
          "value": "myudsf"
        }
      ]
    ]
  },
  {
    "section": "DirectServices",
    "value": [
      [
        {
          "column": "Type",
          "value": "ignite"
        },
        {
          "column": "Name",
          "value": "memorydb"
        }
      ],
      [
        {
          "column": "Type",
          "value": "influxdb"
        },
        {
          "column": "Name",
          "value": "myflux"
        },
        {
          "column": "Storage",
          "value": "100Mi"
        }
      ]
    ]
  }
]

GET:
To list the resources defined in an existing session:
curl  -X GET  http://localhost:8080/<session>