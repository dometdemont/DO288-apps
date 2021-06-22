// Current version
document.getElementById("vnfDescriptorWizardVersion").innerHTML="2021-06-21 Version 0.97"

// Display version history in the user output area
function versionHistory(){userOutput(`Version history:
2021-06-21 0.97 Azure infrastructure: new section VanillaNodes to deploy vanilla kubernetes clusters; create the service principal required for OpenShift clusters, if missing. 
  OpenShift 4 on OpenStack: check for conflicting network resources before launching the OpenShift installer; default templates: move rbac.authorization.k8s.io/v1beta1 version to v1
2021-05-31 0.96	Code split, standalone session delivery by inlining javascript files from the node js application; session status management by tracking modifications and backup.
2021-05-12 0.95 Support OpenShift 4 deployment on Azure public cloud; new section to define optional kubernetes application template parameters
2021-04-28 0.94 OpenShift 4 deployment: switch to OVN network type; bug fix on /etc/hosts update; (experimental) adding hpe5gcs-operator in the default catalog; how to update.
2021-04-22 0.93 (experimental) local-storage-operator delivering persistent storage on baremetal 
2021-04-14 0.92 OpenShift 4 on bare metal ; Catalog Source for operators
2021-03-04 0.91 UPF router support; automatic link between UPF and the OCP hosting the NRF if any; more UPF attributes in Misc section; network interfaces naming more flexible to address ubuntu targets 
2021-02-12 0.90 OpenShift 4.x deployment: support preallocated floating IPs for API and APP endpoints
2021-02-03 0.89 OpenShift 4.x deployment: export APP and API floating IPs for UPF automatic link; UPF: make mcc and mnc variables in Misc section
  up to 5 distinct flavors; headless mode in logging.
2021-01-26 0.88 OpenShift 4.x deployment: support specific flavor for Worker nodes, deploy resources on all OCP instances, not just the last one; logs management cleanup. 
2021-01-12 0.87 OpenShift 3.x deployment: retrieve kubeconfig from /etc/origin/master/admin.kubeconfig and deploy resources directly (except if images are to be retrieved from insecure registries) 
2021-01-06 0.86 UPF configuration by injecting /fdsk/startup-config network configuration; OpenShift 4 deployment: #volumes and security group attributes, flavor hw attributes checking 
2020-12-14 0.85 OpenStack deployments: support up to 5 private networks, enrich the Heat output section with a ports attribute listing all IP addresses;
  New section OperatorSources to define additional operators catalog sources.
2020-12-04 0.84 OpenShiftNodes section: deploy OpenShift 4.x clusters on OpenStack
2020-11-13 0.83 Build option: hpe5gApp kubernetes native application for deployment with the hpe5gApp operator; ignite-operator built from the operator-sdk in helm adapter mode. 
2020-09-29 0.82	OpenStack deployments: disable root certificate authority checking, not available everywhere; support storage on volumes using Misc.openstack_volume_size
  Support etcd operator from the default catalog
2020-09-25 0.81	OpenShift 3.11 deployment: define the ansible extra variable openshift_epel_rpm_url=epel-release defining the epel package, to override the default failing value
	Include OpenShift templates in the OpenStack template only if useful  
2020-09-16 0.80	new section Builds defining both Jenking pipelines and custom application builds; new section CustomApps to instantiate such applications from git repositories.
2020-08-13 0.78	Move to UDSF 1.8 in the default catalog; include the deployer version in the OpenShift project description; 
	default flavor to standard, not small; save flavor in Nodes section; restrict insecure registries to full stack deployment. 
2020-08-10 0.77	Support template import in the catalog as yaml files; remove dependency on logger not supported in basic docker containers; robustness on missing sections in imported catalog. 
2020-08-03 0.76	Adding redis-nopwd and cert-manager in default catalog; robustness on admin and dependencies sections free catalog and error reporting on REST API
2020-07-28 0.75	Support OpenStack instances deployment alone without OpenShift, with specific image and flavor; support tester git clone with deploy key; 
	build installer for OpenStack resources as well; support subsequent REST deployments on the same OpenShift project  	
2020-07-10 0.74	Dependencies management: support aliases, eg influxdb can be implemented either as influxdb or telegraf or telegraf-chart; revert dependency to telegraf towards influxdb
	Catalog: support import of incremental catalog to extend the current catalog (GUI only)
	Robustness and diagnostic improvments
	Default catalog: namespaced operators grafana-operator and prometheus-operator with self subscription and installation 
2020-06-24 0.73	Helm based deployments: optional version and extra options attributes; Operators deployment: optional replicas attribute; 
	Add telegraf in the default catalog as IndirectService and HelmChart; use it as influxdb resource for all Network Functions  
2020-06-18 0.72	nudsf and nudr OpenShift templates refresh. Markdown doc cosmetic fixes.
2020-06-12 0.71	Json session format: move to a list of attribute:value {a:x, b:y, ...} instead of a table of the same [{a:x},{b:y},...]
	Add a Build Doc button compiling the Help text of a selection of sections in a markdown document 
2020-06-11 0.70	Allow multiple instances of the same type in one project: add a new optional attribute in resources, Dependencies, to resolve ambiguity in dependencies
	More nudm stuff in the default catalog: nudm-li-tf, nudm-ueau, nudm-uecm
2020-06-09 0.69	Undeploy feature for interactive and headless modes; improve idempotence for udsf, udr, udm
2020-06-04 0.68	Remove admin privilege requirements when possible (nudsf-dr sde-udr-nudr-dr sde-udr-nudr-prov hpe-nnrf-reg-agent udm prometheus influxdb ignite)
2020-06-02 0.67	headless mode for RESTful invocation, including json dump and import; file type: init properly during import
	Misc section: headless and default project variables, with override capability from a headless invocation
	Manage admin privileges requirement for some types by warning the user at build and deployment time; make this information part of the catalog
	In the built installer: cleanup tempoary files if successful, and skip security relaxation if system:admin is not loggable
2020-05-07 0.65	Disable shell parameters expansion in templates deployed over REST API to support pods configuration files using shell parameters
2020-05-06 0.64	Full stack deployment: update the ansible controller setup procedure to CenOS8/Python3
	New section 'Clusters' defining on which OpenShift clusters the resources are to be deployed over REST API
	Default catalog cleanup of privileged resources like ClusterRole and ClusterRoleBinding, demoted as RoleBinding to 'view' default role for REST API deployment
2020-04-22 0.63	support optional persistent storage for ignite
2020-04-21 0.62	5G catalog management: offer display/import/export catalog of deployable resources in a dedicated fieldset.
	Offer nudm-sdm and nudm-notify deployment from native OpenShift templates.
2020-04-15 0.61	Welcome message cleanup; new section for Helm charts deployments; elasticSearch operator added
	deployment script logs cleanup; colors update for HPE compliance; group common actions in fieldsets.
2020-04-07 0.60	redis and influxdb deployment; nudm network function preview; start with an empty set of resources but welcome and help display
2020-03-31 0.59	add Operators section to deploy services from available operators.
2020-03-30 0.58	split the NetworkFunctions section in three categories: NetworkFunctions, DirectServices, IndirectServices
2020-03-25 0.57	add fluentd and grafana services.
2020-03-23 0.56	add prometheus services; move labels from app to name for service exposure
2020-03-18 0.55	define storage size per network function with target volume; ElasticSearch with storage; ImageStreams target directly secure registries; fix cinder volume Id resolution.
2020-03-12 0.54	udr and udr-prov deployment with traffic from tester. Jenkins pipelines deployment. ElasticSearch preview. Default images updated.
2020-03-06 0.53	In addition to full stack deployment, support network functions only deployment, with idempotence. More nudr stuff (still preview)
2020-03-06 0.52	CMS5G Core Stack automated deployer moved to https://github.hpe.com/CMS-5GCS/automated-deployer.git; manage multiple openshift versions (3.9, 3.11)
	nudr preview (missing dependencies)
2020-02-25 0.5	CMS5G Core Stack automated deployer hosted on github.hpe.com:cms5g/Carrier-Stack; Switch to OpenShift v3.11 with automated git clone
	CMS5G Core Stack tester automated deployment; OpenShift internal registry population and projects creation automated. 
2020-01-28 0.4	Add the NetworkFunctions section to deploy ignite and nudsf-dr, supporting multiple OpenShift projects
2020-01-10 0.3	Fix the generated ansible inventory by removing labels on non master nodes; Help button beside the Build button delivering the user guide.
2020-01-09 0.2	Cinder and OpenShift volumes management, output in a dedicated section ready for OpenShift template creation
2020-01-06 0.1	Very first draft`
	);
}

