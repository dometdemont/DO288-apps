//======================================
// 5G resources default catalog as JSON
// See catalogHelp() for the semantic
// For legibility, the default templates 
// are set next as yaml values 
//======================================
hpe5gResources.defaultCatalog=`
{
  "types": {
    "NetworkFunctions": [
      "nudsf-dr",
      "nudr-dr",
      "nudr-prov",
      "nudr-reg-agent",
      "nudm-ee",
      "nudm-li-poi",
      "nudm-li-tf",
      "nudm-ueau",
      "nudm-uecm",
      "nudm-sdm",
      "nudm-notify",
      "sf-cmod",
      "nrf-reg-agent"
    ],
    "IndirectServices": [
      "jenkins",
      "elasticsearch",
      "telegraf",
      "prometheus-alertmanager",
      "prometheus",
      "kube-state-metrics",
      "pushgateway",
      "grafana"
    ],
    "DirectServices": [
      "ignite",
      "redis",
      "redis-nopwd",
      "influxdb",
      "fluentd"
    ],
    "OperatorSources": [  
      "operator-source",
      "catalog-source"
    ],
    "Operators": [  
      "hpe5gcs-operator",
      "jaeger-product",
      "cert-manager",
      "servicemeshoperator",
      "amq-streams",
      "elasticsearch-operator",
      "kiali-ossm",
      "grafana-operator",
      "etcd-operator",
      "local-storage-operator",
      "container-storage-operator",
      "prometheus-operator"
    ],
    "HelmCharts": [
      "nudm-chart",
      "nudr-chart",
      "telegraf-chart",
      "generic"
    ]
  },
  "dependencies": {
    "nudsf-dr": [
      "ignite",
      ["influxdb","telegraf", "telegraf-chart"]
    ],
    "nudr-dr": [
      "ignite",
      "nudr-prov"
    ],
    "nudr-prov": [
      "ignite"
    ],
    "nudr-reg-agent": [
    	["redis","redis-nopwd"],["influxdb","telegraf", "telegraf-chart"]
    ],
    "nudm-ee": [
      ["influxdb","telegraf", "telegraf-chart"], "nudr-dr"
    ],
    "nudm-li-poi": [
      ["redis","redis-nopwd"],"amq-streams",["influxdb","telegraf", "telegraf-chart"]
    ],
    "nudm-li-tf": [
        ["redis","redis-nopwd"],["influxdb","telegraf", "telegraf-chart"]
    ],
    "nudm-ueau": [
        ["influxdb","telegraf", "telegraf-chart"], "nudr-dr"
    ],
    "nudm-uecm": [
        ["influxdb","telegraf", "telegraf-chart"], "nudr-dr"
    ],
    "nudm-sdm": [
      ["influxdb","telegraf", "telegraf-chart"], "nudr-dr"
    ],
    "nudm-notify": [
      ["influxdb","telegraf", "telegraf-chart"], "nudr-dr"
    ],
    "nrf-reg-agent": [
      ["influxdb","telegraf", "telegraf-chart"],
      "fluentd"
    ]
  },
  "admin": {
	    "fluentd": true,
	    "grafana": true,
	    "kube-state-metrics": true,
	    "grafana-operator": true,
      "etcd-operator": true,
      "hpe5gcs-operator": true,
      "local-storage-operator": true,
      "container-storage-operator": true,
	    "prometheus-operator": true,
      "operator-source": true,
      "catalog-source": true
  },
  "values": {
    "jenkins": {
      "URL": "quay.io/openshift",
      "image": "origin-jenkins",
      "tag": "latest"
    },
    "elasticsearch": {
      "URL": "docker.elastic.co/elasticsearch",
      "image": "elasticsearch-oss",
      "tag": "6.7.0",
      "storage": "4Gi"
    },
    "telegraf": {
        "URL": "docker.io",
        "image": "telegraf",
        "tag": "1.14-alpine"
    },
    "prometheus-alertmanager": {
      "URL": "docker.io/prom",
      "image": "alertmanager",
      "tag": "v0.20.0",
      "storage": "8Gi"
    },
    "prometheus": {
      "URL": "docker.io/prom",
      "image": "prometheus",
      "tag": "v2.16.0",
      "storage": "200Mi"
    },
    "kube-state-metrics": {
      "URL": "quay.io/coreos",
      "image": "kube-state-metrics",
      "tag": "v1.9.5"
    },
    "pushgateway": {
      "URL": "docker.io/prom",
      "image": "pushgateway",
      "tag": "v1.0.1"
    },
    "grafana": {
      "URL": "grafana",
      "image": "grafana",
      "tag": "6.6.2"
    },
    "nudsf-dr": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-sde-udsf-nudsf-dr",
      "tag": "1.8.0"
    },
    "nudr-dr": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-sde-udr-nudr-dr",
      "tag": "1.6.0"
    },
    "nudr-prov": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-sde-udr-nudr-prov",
      "tag": "1.6.0"
    },
    "nudr-reg-agent": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-nf-nrf-reg-agent",
      "tag": "0.15.0"
    },
    "nudm-ee": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-nf-udm-ee",
      "tag": "0.9.0"
    },
    "nudm-li-poi": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-nf-udm-li-poi",
      "tag": "0.9.0"
    },
    "nudm-li-tf": {
        "URL": "cmsgvm38.gre.hpecorp.net:18444",
        "image": "hpe-nf-udm-li-tf",
        "tag": "0.9.0"
    },
    "nudm-ueau": {
        "URL": "cmsgvm38.gre.hpecorp.net:18444",
        "image": "hpe-nf-udm-ueau",
        "tag": "0.9.0"
    },
    "nudm-uecm": {
        "URL": "cmsgvm38.gre.hpecorp.net:18444",
        "image": "hpe-nf-udm-uecm",
        "tag": "0.9.0"
    },
    "nudm-sdm": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-nf-udm-sdm",
      "tag": "0.9.0"
    },
    "nudm-notify": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-nf-udm-notify",
      "tag": "0.9.0"
    },
    "sf-cmod": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-sf-cmod",
      "tag": "0.8.0"
    },
    "nrf-reg-agent": {
      "URL": "cmsgvm38.gre.hpecorp.net:18444",
      "image": "hpe-nf-nrf-reg-agent",
      "tag": "0.15.0"
    },
    "ignite": {
      "URL": "docker.io/gridgain",
      "image": "community",
      "tag": "8.7.12"
    },
    "redis": {
      "URL": "docker.io/bitnami",
      "image": "redis",
      "tag": "latest",
      "storage": "100Mi"
    },
    "redis-nopwd": {
        "URL": "docker.io/bitnami",
        "image": "redis",
        "tag": "latest",
        "storage": "100Mi"
      },
    "influxdb": {
      "URL": "docker.io/bitnami",
      "image": "influxdb",
      "tag": "1.7.10",
      "storage": "1Gi"
    },
    "fluentd": {
      "URL": "gcr.io/google-containers",
      "image": "fluentd-elasticsearch",
      "tag": "v2.4.0"
    },
    "jaeger-product": {},
    "cert-manager": {},
    "operator-source": {
  "Name": "dometdemont",
  "URL": "https://quay.io/cnr",
  "Project": "openshift-marketplace"
},
    "catalog-source": {"Name": "hpe5gcs-operator", "URL": "quay.io/dometdemont/hpe5gcs-operator-index:v0.1.10", "Project": "openshift-marketplace"},
    "hpe5gcs-operator": {},
    "servicemeshoperator": {},
    "amq-streams": {},
    "elasticsearch-operator": {},
    "kiali-ossm": {},
    "grafana-operator": {},
    "etcd-operator": {},
    "local-storage-operator": {
      "Name": "local-storage-operator",
      "Project": "openshift-local-storage"
    },
    "container-storage-operator": {
      "Name": "ocs-storagecluster",
      "Project": "openshift-storage",
      "Replicas": "3"
    },
    "prometheus-operator": {},
    "nudm-chart": {
      "chart": "hpe-nf-udm-0.9.0-005194.c3fa0f7.tgz"
    },
    "nudr-chart": {
      "chart": "hpe-sde-udr-1.1.0-004136.0166df3.tgz"
    },
    "telegraf-chart": {
      "chart": "influxdata/telegraf"
    },
    "generic": {
    }
  }
}
`;