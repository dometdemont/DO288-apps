//==============================================================
// Update the catalog with the default yaml templates 
// For legibility, the default templates are set as yaml values 
//==============================================================
var log4j2xml=`
      <?xml version="1.0" encoding="UTF-8"?>
      <!-- ===================================================================== -->
      <!-- -->
      <!-- Log4j Configuration -->
      <!-- -->
      <!-- ===================================================================== -->
      <!-- | For more configuration information and examples see the Jakarta Log4j 
           | website: http://jakarta.apache.org/log4j -->
      <Configuration status="WARN">
          <!-- ============================== -->
          <!-- Append messages to the console -->
          <!-- ============================== -->
          <Appenders>
              <Console name="Console" target="SYSTEM_OUT">
                  <PatternLayout pattern="%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c] (%t) %msg%n"/>
                  <Filters>
                      <ThresholdFilter level="TRACE" onMatch="ACCEPT" />
                  </Filters>
              </Console>
          </Appenders>
          <!-- ================ -->
          <!-- Limit categories -->
          <!-- ================ -->
          <Loggers>
              <Logger name="com.hpe" level="DEBUG"/>
              <Logger name="org.apache" level="WARN"/>
              <Logger name="kafka" level="WARN"/>
          
          <!-- ======================= -->
          <!-- Setup the Root category -->
          <!-- ======================= -->
              <Root level="INFO">
                  <AppenderRef ref="Console"/>
              </Root>
          </Loggers>
      </Configuration>
`;
//================================================
hpe5gResources.defaults['nudsf-dr']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        containers:
        - name: ~NAME~
          env:
          - name: JAVA_OPTS
            value: -Dpaas.service.name=RELEASE-NAME-nudsf-dr   -Djava.net.preferIPv4Stack=true  -XX:InitialRAMPercentage=40 -XX:MaxRAMPercentage=40 -XX:+AlwaysPreTouch -XX:MaxGCPauseMillis=100 -XX:+UseConcMarkSweepGC -XX:InitiatingHeapOccupancyPercent=75 -XX:+UseCMSInitiatingOccupancyOnly -XX:+ScavengeBeforeFullGC -XX:+DisableExplicitGC -Dio.undertow.ssl.max-read-listener-invocations=1000 -Dgeneric.configuration.uri=file://///etc/opt/hpe/sde/udsf//nudsf-dr-config.yaml 
          image: ~IMAGE_STREAM~
          imagePullPolicy: IfNotPresent
          Requests:
            cpu:    1000m
            memory:   2000Mi
          Limits:
            cpu:  8000m
            memory: 4000Mi
          ports:
          - containerPort: 8443
            protocol: TCP
          - name: health
            containerPort: 8080
            protocol: TCP
          volumeMounts:
            - name: ~NAME~
              mountPath: /etc/opt/hpe/sde/udsf/
            - name: ~NAME~-secrets
              mountPath: /etc/opt/hpe/sde/udsf/security
          livenessProbe:
            httpGet:
              path: /nudsf-dr/v1/probes/healthy
              port: health
            initialDelaySeconds:   120 
            periodSeconds: 3
            timeoutSeconds: 3
            successThreshold: 1
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /nudsf-dr/v1/probes/healthz
              port: health
            initialDelaySeconds: 15
            periodSeconds: 3
            timeoutSeconds: 3
            successThreshold: 2
            failureThreshold: 1
        volumes:
          - name: ~NAME~
            configMap:
              name: ~NAME~
          - name: ~NAME~-secrets
            secret:
              secretName: ~NAME~
    selector:
      name: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
    labels:
      name: ~NAME~
      deploymentconfig: ~NAME~
  spec:
    type: LoadBalancer
    ports:
    - port: 8443
      protocol: TCP
      targetPort: 30043
    selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tls:
      termination: passthrough
    to:
      kind: Service
      name: ~NAME~
      namespace: ~PROJECT~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  data:
    nnrf-register.config: |
      {
        "nfInstanceId": "C750A1C5-4897-4389-A4C7-D0133FC9CADB",
        "nfType":"UDSF",
        "nfStatus":"REGISTERED",
        "heartBeatTimer": "45",
        "fqdn": "",
        "ipv4Addresses":[""],
        "nfServices" : [ {
            "serviceInstanceId" : "UDSF",
            "serviceName" : "nudsf-dr",
            "versions" : [ {
              "apiVersionInUri" : "v1",
              "apiFullVersion" : "1.0.0.alpha-1"
            } ],
      
            "scheme" : "https",
      
            "nfServiceStatus" : "REGISTERED",
            "fqdn": "hpe-sde-udsf-nudsf-dr.3gpp-nf-all.svc.cluster.local",
            "ipEndPoints" : [ {
              "ipv4Address" : "hpe-sde-udsf-nudsf-dr.3gpp-nf-all.svc.cluster.local",
              "transport" : "TCP",
      
              "port" : "30043"
      
            } ]
          } ]
      }
    nudsf-dr-config.yaml: |
      # nUDSF function configuration.
      #
  
      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
          - name: fluentd
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.fluent.FluentI18nLoggerFactoryImpl
            properties:
              host: fluentd
              port: 24224
      statistics-configuration:
        id: hpe-sde-udsf-nudsf-dr-statistics
        enabled: true
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.port: 8086
          com.hpe.imsc.statistics.influxdb.server.protocol: http
          com.hpe.imsc.statistics.influxdb.server.database: hpe-sde-udsf-nudsf-dr
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 5
        jmx:
          enabled: false
  
      # Empty rest-client for paas 0.14.0, remove later
      rest-client:
        id:
  
      call-tracing:
        enabled: false
        properties:
            JAEGER_SERVICE_NAME: ~NAME~
            JAEGER_AGENT_HOST: localhost
            JAEGER_AGENT_PORT: 6831
            JAEGER_ENDPOINT: http://jaeger-collector:14268/api/traces
            JAEGER_REPORTER_FLUSH_INTERVAL: 100
            JAEGER_REPORTER_LOG_SPANS: true
            JAEGER_SAMPLER_TYPE: "probabilistic"
            JAEGER_SAMPLER_PARAM: 1.0
  
      datasources:
        - id: ignite
          profile:
            name: kubernetes
            properties:
              masterUrl: https://openshift.default.svc.cluster.local:443
              namespace: ~PROJECT~
              serviceName: ~ignite_NAME~
      model:
        realms:
        - id: realm0
          properties:
            replicas: 1
          storages:
          - id: space0
            properties:
              replicas: 1
    project-nudsf-dr.yml: |+
      # Thorntail global configuration for nUDSF.
      #
  
      thorntail:
        https:
          only: true
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
        io:
          workers:
            default:
              io-threads: 4
              task-max-threads: 110
        undertow:
          alias: localhost
          filter-configuration:
            request-limits:
              requests-limiter-filter:
                queue-size: 1500
                max-concurrent-requests: 100
          servers:
            default-server:
              hosts:
                default-host:
                  filter-refs:
                    requests-limiter-filter:
                      predicate: not path-suffix(ΓÇ¥/probes/healthyΓÇ¥)
                      priority: 1
              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx
                  http2-initial-window-size: 32000000
                  http2-max-concurrent-streams: 200
                  no-request-timeout: 600000
                  http2-max-frame-size: 
                  max-connections: 2000
                  http2-max-header-list-size:
                  max-buffered-request-size:
                  max-header-size:
                  max-headers:
                  max-processing-time:
                  read-timeout:
                  receive-buffer:
                  send-buffer: 
                  ssl-session-cache-size:
                  ssl-session-timeout:
                  url-charset:
                  verify-client:
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
              cipher-suite-filter: DEFAULT
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: password
          key-stores:
            ks:
              path: "/etc/opt/hpe/sde/udsf/security/keystore.p12"
              credential-reference:
                clear-text: password
              type: 
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
            "stdout":
               level: INFO
               handlers:
               - STDOUT
            "com.hpe.cms5g.nudsf":
               level: INFO
            "com.hpe.cms.sde.udsf":
               level: INFO
            "com.hpe.cms.sde.dao":
               level: INFO
            "com.hpe":
               level: INFO
            "io.jaegertracing":
              level: WARN
            "io.undertow":
               level: INFO
            "io.netty":
               level: INFO
            "org.jboss.as":
              level: INFO
            "org.glassfish.jersey":
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c] (%t) %s%e%n"
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  type: Opaque
  data:
    keystore.p12: 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
`;
//================================================
hpe5gResources.defaults['nudr-dr']['template']=
//================================================
`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data:
    keystore.jks: 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
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        containers:
        - name: ~NAME~
          volumeMounts:
            - name: ~NAME~-config-volume
              mountPath: /etc/opt/hpe-5g/sde-udr-nudr-dr/
            - name: ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe-5g/sde-udr-nudr-dr/security
          ports:
            - name: https
              containerPort: 8443
              protocol: TCP
          ports:
            - name: health
              containerPort: 8080
              protocol: TCP
          env:
          - name: JAVA_OPTS
            value: -XX:+AlwaysPreTouch -XX:+UseG1GC -XX:+ScavengeBeforeFullGC -XX:+DisableExplicitGC -XX:MaxGCPauseMillis=200 -Xms1g -Djava.net.preferIPv4Stack=true   -Dgeneric.configuration.uri=file:/etc/opt/hpe-5g/sde-udr-nudr-dr/nudr-nf-config.yaml -Dpaas.service.name=nudr-dr
          - name: SPRING_PROFILES_ACTIVE
            value: ignite
          image: ~IMAGE_STREAM~
          imagePullPolicy: IfNotPresent
          Requests:
            cpu:    2000m
            memory:   2000Mi
          Limits:
            cpu:  8000m
            memory: 4000Mi
          livenessProbe:
            httpGet:
              path: /nudr-dr/v2/probes/healthy
              port: health
            initialDelaySeconds: 60
            periodSeconds: 5
            timeoutSeconds: 3
          readinessProbe:
            httpGet:
              path: /nudr-dr/v2/probes/healthz
              port: health
            initialDelaySeconds: 60
            periodSeconds: 5
            timeoutSeconds: 3
        volumes:
          - name: ~NAME~-config-volume
            projected:
              sources:
              - configMap:
                  name: ~NAME~-swarm-configmap
              - configMap:
                  name: ~NAME~-application-configmap
              - configMap:
                  name: ~NAME~-application-configmap-nnrf-registration
              - configMap:
                name: nudr-shared-application-configmap-call-tracing-provisioning
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret
    selector:
      name: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
    labels:
      name: ~NAME~
      deploymentconfig: ~NAME~
  spec:
    type: NodePort
    ports:
      - port: 8443
        nodePort: 30001
        protocol: TCP
        name: https-nudr-dr
    selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tls:
      termination: passthrough
    to:
      kind: Service
      name: ~NAME~
      namespace: ~PROJECT~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: nudr-shared-application-configmap-call-tracing-provisioning
    namespace: ~PROJECT~
  data:
    call-tracing-provisioning.yaml: |
      # Copyright (c) 2019-2020 Hewlett-Packard Enterprise Development LP.
      # All Rights Reserved.
      #
      # This software is the confidential and proprietary information of
      # Hewlett-Packard Enterprise Development LP.
      #
      ue-provisioning:
        - ue-id:
          - "imsi-0123456789"
          - "msisdn-9876543210"
          traced-service:
            - "UDM"
            - "UDR"
          propagate-trace: true
          trace-depth: "MEDIUM"
        - ue-id:
          - "imsi-9999999999"
          - "msisdn-8888888888"
          traced-service:
            - "nudm-uecm"
            - "nudm-ueau"
          propagate-trace: true
          trace-depth: "MEDIUM"
        - ue-id:
          - "nai-77777777777"
          - "msisdn-6666666666666"
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap
    namespace: ~PROJECT~
  data:
    nudr-nf-config.yaml: |
      #
      # Copyright (c) 2019-2020 Hewlett-Packard Enterprise Development LP.
      # All Rights Reserved.
      #
      # This software is the confidential and proprietary information of
      # Hewlett-Packard Enterprise Development LP.
      #
  
      #
      # Sample Network function configuration.
      #
  
      udr:
        source-conf: "From HELM"
        udr-root-dir: "/var/opt/hpe-5g/sde-udr-nudr-dr"
        # nrf:
        #   hostname: localhost
        #   port: 5090
        #   scheme: https
        #   version: v1
        #   nrfRegistrationStubMode: true
        #   nrfDiscoverStubMode: true
        #   nfRegfile: /etc/opt/hpe-5g/sde-udr-nudr-dr/nnrf-register.config
        #   udrDescfile: /etc/opt/hpe-5g/sde-udr-nudr-dr/udr-disc.json
  
      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
      call-tracing:
        enabled: false
        properties:
          JAEGER_SERVICE_NAME: ~NAME~
          JAEGER_REPORTER_FLUSH_INTERVAL: 100
          JAEGER_REPORTER_LOG_SPANS: true
          JAEGER_SAMPLER_TYPE: "probabilistic"
          JAEGER_SAMPLER_PARAM: 1.0
        provisioning-uri: file:/etc/opt/hpe-5g/sde-udr-nudr-dr/call-tracing-provisioning.yaml
        max-trace-depth: MINIMUM
        max-body-length: 1200
        trace-all-ues: false
        trace-all-operations: true
        autorefresh-provisioning-period: 30
      datasources:
        - id: ignite
          profile:
            name: kubernetes
            properties:
              masterUrl: https://openshift.default.svc.cluster.local:443
              namespace: ~PROJECT~
              serviceName: ~ignite_NAME~
      model:
        realms:
        - id: realm0
          properties:
            replicas: 1
      publisher-subscriber:
        enable: false
        parameters:
          application-kind: UDR
          topic: UDRNotifier
        pubsub:
          brokers:
          - localhost:9092
          properties:
            group.id: group1
            reconnect.backoff.max.ms: 14400000
            reconnect.backoff.ms: 7200000
      # TEMPORARY WORKAROUND FOR PAAS 0.14.0, EMPTY CLIENT DEFINITION
      rest-client:
        id:
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-swarm-configmap
    namespace: ~PROJECT~
  data:
    project-nudr-dr.yml: |+
      #
      # Sample Thorntail global configuration.
      #
      thorntail:
        https:
          only: true
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
        undertow:
          alias: localhost
          servers:
            default-server:
              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx
                  http2-initial-window-size: 32000000
                  no-request-timeout: 600000            
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: hwroot
          key-stores:
            ks:
              path: /etc/opt/hpe-5g/sde-udr-nudr-dr/security/keystore.jks
              credential-reference:
                clear-text: hwroot
              type: JKS
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
            "stdout":
               level: INFO
               handlers:
               - STDOUT
            "com.hpe.cms.sde.udr":
               level: INFO
            "com.hpe.cms.sde.apis":
               level: INFO
            "com.hpe.cms.sde.dao":
               level: INFO
            "com.hpe.paas.middleware.sdk.impl.rest.providers":
               level: INFO
            "com.hpe":
               level: INFO
            "org.apache.ignite":
              level: WARN
            "org.apache.kafka":
               level: INFO
            "org.glassfish.jersey":
               level: INFO
            "io.jaegertracing":
              level: INFO
            "io.undertow":
              level: INFO
            "io.netty":
              level: INFO
            "org.jboss.as":
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c] (%t) %s%e%n"
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-nnrf-registration
    namespace: ~PROJECT~
  data:
    nnrf-register.config: |
      {
      	  "nfInstanceId": "0777E150-4D00-4d86-A49C-8BADF00D0000",
      	  "nfType":"UDR",
      	  "nfStatus":"REGISTERED",
      	  "heartBeatTimer": "45",
      	  "fqdn": "localhost",
      	  "ipv4Addresses":["localhost"],
      	  "udrInfo":{
      	    "groupId":"udrgroup01",
      	    "supiRanges":[{"start":"200000000000000","end":"399999999999999"}],
      	    "supportedDataSets":["SUBSCRIPTION","POLICY","EXPOSURE","APPLICATION"]
      	  },
      	  "nfServices" : [ {
      	      "serviceInstanceId" : "0777E150-4D00-4d86-A49C-8BADF00D0000",
      	      "serviceName" : "nudr-dr",
      	      "versions" : [ {
      	        "apiVersionInUri" : "v2",
      	        "apiFullVersion" : "2.1.0"
      	      } ],
      
      	      "scheme" : "https",
      
      	      "nfServiceStatus" : "REGISTERED",
      	      "fqdn": "localhost",
      	      "ipEndPoints" : [ {
      	        "ipv4Address" : "localhost",
      	        "transport" : "TCP",
      
      	        "port" : "30001"
      
      	      } ]
      	    } ]
      	}

`;

//================================================
hpe5gResources.defaults['nudr-prov']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        containers:
        - name: ~NAME~
          env:
          - name: JAVA_OPTS
            value: -Xms512m -Xmx1024m -Djava.net.preferIPv4Stack=true -Dgeneric.configuration.uri=file:/etc/opt/hpe-5g/sde-udr-nudr-prov/nudr-nf-config.yaml -Dpaas.service.name=nudr-prov
          - name: SPRING_PROFILES_ACTIVE
            value: ignite
          image: ~IMAGE_STREAM~
          imagePullPolicy: IfNotPresent
          Requests:
            cpu:    2000m
            memory:   2000Mi
          Limits:
            cpu:  8000m
            memory: 4000Mi
          ports:
          - containerPort: 8443
            protocol: TCP
          volumeMounts:
            - name: ~NAME~
              mountPath: /etc/opt/hpe-5g/sde-udr-nudr-prov/
            - name: ~NAME~-secrets
              mountPath: /etc/opt/hpe-5g/sde-udr-nudr-prov/security
          livenessProbe:
            failureThreshold: 3000
            httpGet:
              path: /nudr-prov/v1/probes/healthy
              port: 8080
              scheme: HTTP
            initialDelaySeconds: 60
            periodSeconds: 5
            timeoutSeconds: 15
          readinessProbe:
            failureThreshold: 3000
            httpGet:
              path: /nudr-prov/v1/probes/healthz
              port: 8080
              scheme: HTTP
            initialDelaySeconds: 30
            periodSeconds: 60
            timeoutSeconds: 15
        volumes:
          - name: ~NAME~
            configMap:
              name: ~NAME~
          - name: ~NAME~-secrets
            secret:
              secretName: ~NAME~
    selector:
      name: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
    labels:
      name: ~NAME~
      deploymentconfig: ~NAME~
  spec:
    type: LoadBalancer
    ports:
    - port: 8443
      protocol: TCP
      targetPort: 30043
    selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tls:
      termination: passthrough
    to:
      kind: Service
      name: ~NAME~
      namespace: ~PROJECT~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  data:
    nudr-nf-config.yaml: |
      #
      # Copyright (c) 2019-2020 Hewlett-Packard Enterprise Development LP.
      # All Rights Reserved.
      #
      # This software is the confidential and proprietary information of
      # Hewlett-Packard Enterprise Development LP.
      #
      #
      # Sample Network function configuration.
      #
      udr:
        source-conf: "From HELM"
      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
      call-tracing:
        enabled: false
        properties:
          JAEGER_SERVICE_NAME: ~NAME~
          JAEGER_REPORTER_FLUSH_INTERVAL: 100
          JAEGER_REPORTER_LOG_SPANS: true
          JAEGER_SAMPLER_TYPE: "probabilistic"
          JAEGER_SAMPLER_PARAM: 1.0
        provisioning-uri: file:/etc/opt/hpe-5g/sde-udr-nudr-prov/call-tracing-provisioning.yaml
        max-trace-depth: MINIMUM
        max-body-length: 1200
        trace-all-ues: false
        trace-all-operations: true
        autorefresh-provisioning-period: 30
      datasources:
        - id: ignite
          profile:
            name: kubernetes
            properties:
              masterUrl: https://openshift.default.svc.cluster.local:443
              namespace: ~PROJECT~
              serviceName: ~ignite_NAME~
      model:
        realms:
        - id: realm0
          properties:
            replicas: 1
      publisher-subscriber:
        enable: false
        parameters:
          application-kind: UDR
          topic: UDRNotifier
        pubsub:
          brokers:
          - localhost:9092
          properties:
            group.id: group1
            reconnect.backoff.max.ms: 14400000
            reconnect.backoff.ms: 7200000
      # TEMPORARY WORKAROUND FOR PAAS 0.14.0, EMPTY CLIENT DEFINITION
      rest-client:
        id:
    project-nudr-prov.yml: |+
      #
      # Sample Thorntail global configuration.
      #
      thorntail:
        https:
          only: true
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
        undertow:
          alias: localhost
          servers:
            default-server:
              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx
                  http2-initial-window-size: 32000000
                  no-request-timeout: 600000            
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: hwroot
          key-stores:
            ks:
              path: /etc/opt/hpe-5g/sde-udr-nudr-prov/security/keystore.jks
              credential-reference:
                clear-text: hwroot
              type: JKS
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
            "stdout":
               level: INFO
               handlers:
               - STDOUT
            "com.hpe.cms.sde.udr":
               level: INFO
            "com.hpe.cms.sde.apis":
               level: INFO
            "com.hpe.cms.sde.dao":
               level: INFO
            "com.hpe.paas.middleware.sdk.impl.rest.providers":
               level: INFO
            "com.hpe":
               level: INFO
            "org.apache.ignite":
              level: WARN
            "org.apache.kafka":
               level: INFO
            "org.glassfish.jersey":
               level: INFO
            "io.jaegertracing":
              level: INFO
            "io.undertow":
              level: INFO
            "io.netty":
              level: INFO
            "org.jboss.as":
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c] (%t) %s%e%n"
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  type: Opaque
  data:
    keystore.jks: /u3+7QAAAAIAAAABAAAAAQAOaHBlY21zNWdzZXJ2ZXIAAAFu4UME5gAABQIwggT+MA4GCisGAQQBKgIRAQEFAASCBOojyq6XmGavwNrIox2dFoQqtW4nhmNfDjrd4Ji6otOtYggUKL4h7hkEfasPVtqOAbGlvENZdo5yX5AvETDxqYU6MfDeSu6A9OnQTjwbEJP+vSKW6VWV7dGHrT/UEVcxus3D3gb3G3xs5IzfYt5N5yxNMbqALEscAvVp/RqoSKbZCDUh4urIl6xT9gU4Ct8LpZ1YrzXn5q2m3tHXcJWd1RYuXl5xgORU8J10p02Xztn6MPViWkqxJ1rb4ZTfpIqT7ZslKEY/hHcUAYttTjtS/XU5oJffym8VpxfxXSEzdFJN1OiBocRZXHNx7jt1ionnHfaRdCxp7LejfESkO9x4CAOnMakY9LU12NSRxCS7h1IJsrUvystx6+ReVhy7U5o86bqfM+EoOSp+VZsGm6Z9mDhWzAOWyN4Iqb/Jf/BlLrvuKUvNOHQdU4M24TkwGCsuZYePbT7350UaF/N1e77d0HCSZgLhvXntXlI8EWdn2YzNqJ7bIQOfvtC2SHzTPP0SbAmwMtfp6aEykEIlmwQIdsBFayQSsKbPx3xbEiKa69861dIrxj4no70jy6waV/s1hU/eIv3m05nKH/NVEOxoB6fJTel84WXlK1WbbE1Qo4BMZeqZkcBtB9zaVu9eoqgZGdsXomBVyf1NDNAAx+qX6wyyDjun89JJq+sixNe2Vdry+1TJWYWmJ3oOMZ1JsCiRUVxBgxi7yu5U+8ZGHE2d1e1XvF9l3ZczgkU9EhFHoSYVw/ypaGFNcKKw90qfro58Zg8BYY//ITIlWjNaRWpfL1PT18I4lbI+8ecxhxGtl6c0+NDXURF2+TWH1FvwTwz7R80or1zpzDXzz+cTNOhJ7gFq15DJXA5YDERsYx7hUNthOwZ/6xO623JV1ZbokxrFntXNwuGJ1cMka74/GSm09Y5h+zQ0q3yRwPwr69EUALpQCR1op/7PYaZSjCY6bwUOSOL9HsXzWuYhplHv9Ffee7hM4u5EWAaDgqt8eSk8+Ddt/rZbmvAExhrIO5ItE2wSne3OWCq3JPiz7ZXCffk3OEPikEw0lSBihKdYL1TS5yPV8W5ZRkjewo0aYRChunTk9fRNfvDdmdoBBzEC1iG7xQtWR/k7C0vZdsuSzgOToRthFy75NEuvlcHKiL3YrlFTf/YM0M3eN/92p53HLSedXxb3pfi05GPj4ngy/aFFl7eCRSO0OtlY2Hmx56iK3U8de+2LCSb5uSFKy8VCPXuAbNNqpyXLtN7jgfLK9xVlpTWiP3wqy5rt2ySehVrsHT4DidSwNtr7/szke5hSNdGBuPGTrL1u9AnYepcNdBZ7XBBir96bHlNAgIHNmpoDIkZb0AG3PUJFG2ukxifcZ52Kq4s7zRnqRXBIjYMPk1EMPVM67zuAFMKI88oYNrN0S+aqLJNsbnWNIsR9UVu4icjr2DGVlr9DtNuo0MnKHFd/A16bpyuB7O8jvlxpeRtQXBQqXAroez7sE2SDGG+C+WmzXGCCbx6Gznk1hj1oi5Kw7aWUm+fSOr2xvPXLNklJpBobQsbokParDsay4un1LH4LNGi/k0cbNwiGw5RK8MQzVIlr1zRJYTgzQELOfZ62kePnovkryMGuly0ooOFlS+iosjYWEVBNK88MNs6Jn6aaA9WTjSMztROexSQhf56Q4URvgA4V/AVWHuRVkq5MAAAAAgAFWC41MDkAAAO3MIIDszCCApugAwIBAgIJAN+Nl0D64XdAMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAkZSMQ4wDAYDVQQIDAVJU0VSRTERMA8GA1UEBwwIR1JFTk9CTEUxDDAKBgNVBAoMA0hQRTEOMAwGA1UECwwFQ01TNUcxFzAVBgNVBAMMDmhwZWNtczVncm9vdGNhMB4XDTE5MTIwNzE2NDczNFoXDTIxMTIwNjE2NDczNFowZzELMAkGA1UEBhMCRlIxDjAMBgNVBAgMBUlTRVJFMREwDwYDVQQHDAhHUkVOT0JMRTEMMAoGA1UECgwDSFBFMQ4wDAYDVQQLDAVDTVM1RzEXMBUGA1UEAwwOaHBlY21zNWdzZXJ2ZXIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDVTbtq339pXYyf5R/V2zAt3RBosOej9ntsgTL7Q2QvUwPD6xcmivQhZEb1kJvbDOfP/lXL16Pn4JtAl70tDdz9Kng0grYvTopW0jPTixyJG99NDVuW3UwFkBvF31DRAu8VrABHToiMBVdefG9a9XuKF18YKOSqj14RMfv+Ny5eBXoioglOnxBlTj5HbC+fzO9GvNQ5tx4RDJl/WBUpKDQjCM8RSEcfwERQIL3wrhmo1XQyBg0qQnBFYeX2cMI+ymQ+2gitnBBoSbUJw+OuzHbBgGvMDSl4/nQkW/6LMuSu/i8UCFM8m2SjprWGllJm1hC9sX7wg8RMG9wZwIv5CZ+VAgMBAAGjYjBgMAkGA1UdEwQCMAAwHQYDVR0OBBYEFPwOHzc7eQoeXnpFtqXfc+vLYoI7MCcGA1UdEQQgMB6CCWxvY2FsaG9zdIIRKi5ncmUuaHBlY29ycC5uZXQwCwYDVR0PBAQDAgXgMA0GCSqGSIb3DQEBCwUAA4IBAQCTELYubc4IybJP3V2SepF62ZCoNaEFU1atylWIL3PWJK70JMnCb9Q6pTnfW6a0zF3QYiL4R9uAE+k/vGzO5r/kjIu2f0oBSKfGmx0P0joX/1CshIhYO7TH7PJyAOnkpOfQva0mXSD8IDLm/IrV2Y4J1OpU5ah2t5ttdSAL6CQW0MbNvRLJQEfV3s8csgiVtxYQ+RxUdka1P1DdogdAldTky5vcyWqq4TJH2OQErkECro9/bbw7X9phV4e6dth+fbFz9wsAq2Kc4Kh1sruETtEHIKCP7c2RNHt3FTh3BEDrDvPZhvrG31hxS8hhXfP2ZvLZE9EnlWNuwhJV40skUpp9AAVYLjUwOQAAA04wggNKMIICMgIJAOVQIcfLzQpnMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAkZSMQ4wDAYDVQQIDAVJU0VSRTERMA8GA1UEBwwIR1JFTk9CTEUxDDAKBgNVBAoMA0hQRTEOMAwGA1UECwwFQ01TNUcxFzAVBgNVBAMMDmhwZWNtczVncm9vdGNhMB4XDTE5MTIwNzE2NDcwNloXDTI5MTIwNDE2NDcwNlowZzELMAkGA1UEBhMCRlIxDjAMBgNVBAgMBUlTRVJFMREwDwYDVQQHDAhHUkVOT0JMRTEMMAoGA1UECgwDSFBFMQ4wDAYDVQQLDAVDTVM1RzEXMBUGA1UEAwwOaHBlY21zNWdyb290Y2EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCaD4IrB0cxzztefz7pKtG+byO/IBjyS7MHzdngOTMIdUM/1tHgGH/W0OE5/qD/ocRhrBsvBGT4bkZ3Eq3fxMxp2Zos7FnCgk3iLPUTOn2Hs3ctsgbHJmXES2t3ncYi1zkn77YjDIU+F2y97AQ039xbXFdVm3bGW/U48mksdFhs0Z9qa2cXVFC4Rd081L+FQZtFKgOQm0ENq12Ko5qCO8svgHJSJzieMKl6H70XN/IrqXXkhO1GhJG8I+X7WKAM/AI/l8bYcPIii+ypyguqR2HnDq7qctLOdqWukCuh4+Lhzl+3xajXW0htF+Ve97vRXHEXyHDQpXBBfnLfD0SpAzzzAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAGqw0v007kc1VA4NYTY++SPkDFfgEb1OgLcc6QhqDjKQodm5MtxUPihjjqnJdEl0k8xmIS/2dj417zdEOuiyESWuI5+T1MRKecnqzl2fggfGpuC1KQ7yZlmUHWK1GKnBz4c0BB9cRtseSXYmBDiY+m+rKZTRjeJy+NLgJBvxYMQsekWknFUBDjJ9TNZ6IU38igpGkXCclIRQmB1iD8+30RehFwPJ701ngtkr5RciriOeNuGfOCM9YvOzS4ig3P2twql40g32GlO0e0/GFZxo6rljRvbcTduxPObeTKtVXLb/bdv6hKEwEbykSxQjreVq0oeFDh4pUMl8+gxv+8L6lrA8Gn+lCvjzuYIxbAQrRDlrMGAkgQ==
`;

//================================================
hpe5gResources.defaults['nudr-reg-agent']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        containers:
        - name: ~NAME~
          env:
          - name: JAVA_OPTS
            value: -Xms512m -Xmx1024m -Djava.net.preferIPv4Stack=true -Dgeneric.configuration.uri=file:/etc/opt/hpe-5g/hpe-nnrf-reg-agent/nnrf-reg-agent-config.yaml
          image: ~IMAGE_STREAM~
          Requests:
            cpu:    1000m
            memory:   2000Mi
          Limits:
            cpu:  8000m
            memory: 4000Mi
          ports:
          - containerPort: 8443
            protocol: TCP
          volumeMounts:
            - name: ~NAME~
              mountPath: /etc/opt/hpe-5g/hpe-nnrf-reg-agent/
            - name: ~NAME~-secrets
              mountPath: /etc/opt/hpe-5g/hpe-nnrf-reg-agent/security
          livenessProbe:
            failureThreshold: 3000
            httpGet:
              path: /nudr-reg-agent/v2/probes/healthy
              port: 8080
              scheme: HTTP
            initialDelaySeconds: 60
            periodSeconds: 5
            timeoutSeconds: 15
          readinessProbe:
            failureThreshold: 3000
            httpGet:
              path: /nudr-reg-agent/v2/probes/healthz
              port: 8080
              scheme: HTTP
            initialDelaySeconds: 30
            periodSeconds: 60
            timeoutSeconds: 15
        volumes:
          - name: ~NAME~
            configMap:
              name: ~NAME~
          - name: ~NAME~-secrets
            secret:
              secretName: ~NAME~
    selector:
      name: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
    labels:
      name: ~NAME~
      deploymentconfig: ~NAME~
  spec:
    type: LoadBalancer
    ports:
    - port: 8443
      protocol: TCP
      targetPort: 30043
    selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tls:
      termination: passthrough
    to:
      kind: Service
      name: ~NAME~
      namespace: ~PROJECT~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  data:
    nnrf-reg-agent-config.yaml: |
      #
      # Network function NNRF Client MicroService configuration.
      #
      # The parameters below can be overridden by an external configuration.
      #
  
  
      # HTTP/2 REST client subsystem
      ---
      rest-client:
        connector-provider: com.hpe.paas.middleware.jersey.okhttp.connector.OkhttpConnectorProvider
        properties:
          jersey.config.client.async.threadPoolSize: 50
          jersey.config.client.followRedirects: false
          jersey.config.client.connectTimeout: 100
          jersey.config.client.readTimeout: 1000
        security:
          keyCertificateLocation:
          keystoreLocation:
          keystorePassword: password
          keyCertificatePKLocation:
          keyCertificateKeyPairPassword:
          keyManagerFactoryAlgorithm:
          truststoreLocation:
          trustCertificateLocation:
          truststorePassword:
          trustCertificatePKLocation:
          trustCertificateKeyPairPassword:
          trustManagerFactoryAlgorithm:
          cryptoProtocol: TLSv1.2
          passwordEncoded: false
          
      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
          - name: fluentd
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.fluent.FluentI18nLoggerFactoryImpl
            properties:
              host: fluentd.logging
              port: 24224
  
      statistics-configuration:
        id: hpe-nf-nrf-reg-agent-statistics
        jmx:
          domain: nnrf-reg-agent
          enabled: false
          properties:
            com.hpe.imsc.statistics.jmx.descriptors: "false"
            com.hpe.imsc.statistics.jmx.notifications: "false"
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.database: nnrf-reg-agent
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 10
          com.hpe.imsc.statistics.influxdb.server.port: "8086"
          com.hpe.imsc.statistics.influxdb.server.protocol: http
  
      nnrf-client:
        discover-stub-mode: false
        # json file containing remote NF profile to be discovered in stub-mode
        stub-remote-nf-profile: 
        server-scheme: https
        server-fqdn: nrf.server.hpecorp.net
        server-port: 8443
        server-version: v1
        retry-limit: -1
        nfprofile-uri: file:/etc/opt/hpe-5g/hpe-nnrf-reg-agent/nnrf-register.config
        disable-register: false 
        disable-deregister: false
        opentracing-enabled: false
        enable-cache: false
        default-cache-validity-period-secs: 3600
        self-service-name: hpe-nf-nrf-reg-agent
        monitor-service-name: 
        monitor-interval: 15000
        kubernetes-namespace: default
    project-nnrf-reg-agent.yml: |+
      #
      # Sample Thorntail global configuration.
      #
      thorntail:
        https:
          only: true
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
        undertow:
          alias: localhost
          servers:
            default-server:
              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx
                  http2-initial-window-size: 32000000
                  no-request-timeout: 600000            
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: hwroot
          key-stores:
            ks:
              path: /etc/opt/hpe-5g/hpe-nnrf-reg-agent/security/keystore.jks
              credential-reference:
                clear-text: hwroot
              type: JKS
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
            "stdout":
               level: INFO
               handlers:
               - STDOUT
            "com.hpe.cms.sde.udr":
               level: INFO
            "com.hpe.cms.sde.apis":
               level: INFO
            "com.hpe.cms.sde.dao":
               level: INFO
            "com.hpe.paas.middleware.sdk.impl.rest.providers":
               level: INFO
            "com.hpe":
               level: INFO
            "org.apache.ignite":
              level: WARN
            "org.apache.kafka":
               level: INFO
            "org.glassfish.jersey":
               level: INFO
            "io.jaegertracing":
              level: INFO
            "io.undertow":
              level: INFO
            "io.netty":
              level: INFO
            "org.jboss.as":
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c] (%t) %s%e%n"
    nnrf-register.config: |
      {
        "nfInstanceId": "0777E150-4D00-4d86-A49C-8BADF00D0000",
        "nfType":"UDR",
        "nfStatus":"REGISTERED",
        "heartBeatTimer": "45",
        "fqdn": "localhost",
        "ipv4Addresses":["localhost"],
        "udrInfo":{
          "groupId":"udrgroup01",
          "supiRanges":[{"start":"200000000000000","end":"399999999999999"}],
          "supportedDataSets":["SUBSCRIPTION","POLICY","EXPOSURE","APPLICATION"]  },
          "nfServices" : [ {
            "serviceInstanceId" : "0777E150-4D00-4d86-A49C-8BADF00D0000",
            "serviceName" : "~NAME~",
            "versions" : [ {"apiVersionInUri":"v2","apiFullVersion":"2.1.0"} ],
            "scheme" : "https",
            "nfServiceStatus" : "REGISTERED",
            "fqdn": "localhost",
            "ipEndPoints" : [ {"ipv4Address":"localhost","transport":"TCP","port":"30001"} ]
            } ]
      }
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  type: Opaque
  data:
    keystore.jks: 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
`;
//================================================
hpe5gResources.defaults['sf-cmod']['template']=
//================================================
`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret-config
    namespace: ~PROJECT~
  data:
    "DefaultConfig": |- 
          IyBUaGlzIGlzIGEgc2FtcGxlIEFsZ29yaXRobSBJRCBGaWxlLgojIFRoaXMgZGVmaW5lcyB0aGUgc3VwcG9ydGVkIHZhcmlhYmxlcyBhbmQgcHJvdmlkZXMgYSBzYW1wbGUgdmFsdWUgZm9yIHRoZW0uCgojIHZlY3Rvcl9hbGdvcml0aG0KIyBUaGlzIGlzIGEgbWFuZGF0b3J5IGZpZWxkIGZvciB0aGlzIGtpbmQgb2YgZmlsZS4KIyBWYWxpZCBWYWx1ZXMgOiAKIyAgICAwICAgLSBNaWxlbmFnZQojICAgIDI1MCAtIFR1YWsKdmVjdG9yX2FsZ29yaXRobSA6IDAKCiMgb3AKIyBWYWxpZCBmb3IgTWlsZW5hZ2UgYWxnb3JpdGhtLCAKIyBvcHRpb25hbCBmaWVsZCwgbmVlZG4ndCBiZSBwcm92aXNpb25lZCB3aGVuIG9wYyBpcyBwcmVzZW50CiMgUmVnZXggUGF0dGVybiA6ICJeW0EtRmEtZjAtOV17MzJ9JCIKb3AgOiBBMTIzNDU2Nzg5QTEyMzQ1Njc4OUExMjM0NTY3ODlCQwoKIyBjCiMgVmFsaWQgZm9yIE1pbGVuYWdlIGFsZ29yaXRobSBhbmQgZGVmYXVsdCB2YWx1ZXMgZm9yIE1pbGVuYWdlCiMgb3B0aW9uYWwgZmllbGQKIyBSZWdleCBQYXR0ZXJuIDogIl5bQS1GYS1mMC05XXsxNjB9JCIKYyA6IDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA0MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDgKCiMgcgojIFZhbGlkIGZvciBNaWxlbmFnZSBhbGdvcml0aG0gYW5kIGRlZmF1bHQgdmFsdWVzIGZvciBNaWxlbmFnZQojIG9wdGlvbmFsIGZpZWxkCiMgUmVnZXggUGF0dGVybiA6ICJeW0EtRmEtZjAtOV17MTB9JCIKciA6IDQwMDAwMDIwNjAKCiMga2VjX2Nha19pdGVyCiMgVmFsaWQgZm9yIFR1YWsgYWxnb3JpdGhtCiMgVmFsaWQgdmFsdWVzIDogMCAtIDcKa2VjX2Nha19pdGVyIDogMQoKIyB0b3AKIyBWYWxpZCBmb3IgVHVhayBhbGdvcml0aG0KIyBSZWdleCBQYXR0ZXJuIDogIl5bQS1GYS1mMC05XXs2NH0kIgp0b3AgOiBBMTIzNDU2Nzg5QTEyMzQ1Njc4OUExMjM0NTY3ODlCQ0ExMjM0NTY3ODlBMTIzNDU2Nzg5QTEyMzQ1Njc4OUJDCg==
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret-cert
    namespace: ~PROJECT~
  data:
    "cert.pem": |- 
          LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUZKVENDQXcyZ0F3SUJBZ0lKQVBhTExmcTZWVXQvTUEwR0NTcUdTSWIzRFFFQkN3VUFNQ2t4SnpBbEJnTlYKQkFNTUhuWmhZV0YyYlRFekxtbHVMbkprYkdGaWN5NW9jR1ZqYjNKd0xtNWxkREFlRncweE9EQTVNVEV4TlRNdwpNREJhRncweE9UQTVNVEV4TlRNd01EQmFNQ2t4SnpBbEJnTlZCQU1NSG5aaFlXRjJiVEV6TG1sdUxuSmtiR0ZpCmN5NW9jR1ZqYjNKd0xtNWxkRENDQWlJd0RRWUpLb1pJaHZjTkFRRUJCUUFEZ2dJUEFEQ0NBZ29DZ2dJQkFMaW8KUng1NDJDYnNocmpBVHNweW9OSW05V2sxWmlwYU9iWGJHS1lLVW94WFFvRTlINnhiNU8zK2ozUjc4TnVNYmkrZAo0RGJZUXplQWJ1eFM1aW9uUEM1ZUlZazlMSnZOKzgrQU1Wbzd4cVNUaUFrTndia2JWcnd0RmU3dnhwdFhxcGQrCmRscVplVDJXNmxlU0ZLd1FnSGZscjlNd2FlYlFibnNjTjd0SnFwQWdSQW5zekRUOTFZM0I2cExzbmE5QVJnQXAKeHViak55OUd5aHhJSlZnSGhYRi94Z1p3cFkwSVZkVXBRbVRJU3hDK0lxc01GWWFOaGMwOTdXdXpmU0tJZHp1egptUUx1RkRTN2xaeWUvaThTd1kreVNsdTRUM2JudjRXYmhTSGo5RzM5Z1lkSmFISDlGL1hoMDJSTkl5aHYyQmZWCjgrTXMvd0hFZ0pxdzFRUTI5bU1BM0FxMW9yK281a3lyVkdwdWRMTHN2SW9ieS9YVzVJaUdPS2F6bnNBdThDZzIKc2U5eWdBOVovNFEyaW4va3gzS0taVHR5eG9MZThuZWh1Uno1aWxtT3JSU0plZU5DenNYOVdwS1BFU09raExLSwpsR1ZhVG1LRjUzbXZYTDFzbTlPNXQzL3FJKzd4NUhxUmhpMSszZm1Kb1E4eThxdWVxL20ySTBkZDZjRjRhT2FSCjRWd0ZMajRENDhQNi9YbDdEcVVaVzEvRGJiZ3pmNU1wWnUvdWF1YWoycnBaMlpycnJFYVByYUxzWEtGa2w5U00KdWg2QThOWVl6ejJOV1E4K042VHpPVlRBckJTdmRCSHhWNzY1N2VTOFo1M3h1MGRYZHRFQ08rWndsRkdlR0lwZApBYzNBY29rc2FqbUp3R0RjTU1udC9UbkRKZ2RtaUxERjN2QkFMODV0QWdNQkFBR2pVREJPTUIwR0ExVWREZ1FXCkJCUzRHelpPWXA4QWZFUFhKNGNWR1daSkJJanhlVEFmQmdOVkhTTUVHREFXZ0JTNEd6Wk9ZcDhBZkVQWEo0Y1YKR1daSkJJanhlVEFNQmdOVkhSTUVCVEFEQVFIL01BMEdDU3FHU0liM0RRRUJDd1VBQTRJQ0FRQ3llQmR6THY0TAoybFNhM3ZiRlYwM3JBTjRyTW9BVGRBeEtRUDdwRVA2OFBQM3lpakhRUzNnTk04bFFsSkNvV0ZWa21jc1djQ01rClRqUjVMN3VIRkZFbm9reFJkOW15Y0I2UmVpdE8xYldWV0RmWmdvc09JVGNCbUFzQlNJNXd0TEJ3dEhBNU5HMXAKOFJ6djBXZnFrbWNTRTVIaDh1U2tEUXVLL2hUdjBqTGNrVHl0YXRIUGo0a2VLeEloK1ByZFZEcmE2dU44REY5eApMVzhpMEk0bGpCS3dTSjhXeUhGeG85b2JVMyt0Z294QVJ2SUZKU1ZMM1lBMFNiQXpZNVdOelN2NklBZkxiOVIvCmwvTXRYcDBCd0VuWng1dWtieGh2UzdxMTJaRFVWVTFBdDhIblFKaHY3ZEhYNU9tL0xnZUZHdWtydEVRUnFLcE4KbXZyQmJnQXpEOGJpZk5ON0c2a2kveUNwbDhnbTFzRWdxc3JKODJvL0V5YjV2VWY0Ry84UzBaOStxeXM4U05BeQoxVGtGSU53MVYycDlYWGg1VUNOKytjSWlkTDdPcXhsRXV4R1U5Um9RaG5Ka0lqeG5xaXVyT1ZPWHg0NzhtaFZICkNGSENlcC9pVDlhc1dtVjdjbEptQXpuaGhvM2NIVUZpYVVoalFpeEZXRHZEV3ZFbFNDRVpOdWhSNFNPeCtrYloKLzFxNThaOHdtM2dUcmMwUFVuMjE5WlZLdmJsQVNWbURnYmxWdTBpWnNJVUE2WTRVSlpTdFFuVTFGTnBYYk44QgpFdC95MGo4TW1SUTljT1ZScFRVaFlSMUxrSUFDTXJSNUZoUjMyZjFSVk5yYzhoZ0NSYjkzTDY2WE9JNVpMeFdLCnV2WHltcUNkOVVEUGZWVGRsbzZJN1pQckVHM1RqTUd3UXc9PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==
    "key.pem": |- 
          LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUpRZ0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQ1N3d2dna29BZ0VBQW9JQ0FRQzRxRWNlZU5nbTdJYTQKd0U3S2NxRFNKdlZwTldZcVdqbTEyeGltQ2xLTVYwS0JQUitzVytUdC9vOTBlL0Riakc0dm5lQTIyRU0zZ0c3cwpVdVlxSnp3dVhpR0pQU3liemZ2UGdERmFPOGFrazRnSkRjRzVHMWE4TFJYdTc4YWJWNnFYZm5aYW1YazlsdXBYCmtoU3NFSUIzNWEvVE1Hbm0wRzU3SERlN1NhcVFJRVFKN013MC9kV053ZXFTN0oydlFFWUFLY2JtNHpjdlJzb2MKU0NWWUI0VnhmOFlHY0tXTkNGWFZLVUpreUVzUXZpS3JEQldHallYTlBlMXJzMzBpaUhjN3M1a0M3aFEwdTVXYwpudjR2RXNHUHNrcGJ1RTkyNTcrRm00VWg0L1J0L1lHSFNXaHgvUmYxNGROa1RTTW9iOWdYMWZQakxQOEJ4SUNhCnNOVUVOdlpqQU53S3RhSy9xT1pNcTFScWJuU3k3THlLRzh2MTF1U0loamltczU3QUx2QW9Ockh2Y29BUFdmK0UKTm9wLzVNZHlpbVU3Y3NhQzN2SjNvYmtjK1lwWmpxMFVpWG5qUXM3Ri9WcVNqeEVqcElTeWlwUmxXazVpaGVkNQpyMXk5Ykp2VHViZC82aVB1OGVSNmtZWXRmdDM1aWFFUE12S3JucXY1dGlOSFhlbkJlR2pta2VGY0JTNCtBK1BECit2MTVldzZsR1Z0ZncyMjRNMytUS1didjdtcm1vOXE2V2RtYTY2eEdqNjJpN0Z5aFpKZlVqTG9lZ1BEV0dNODkKalZrUFBqZWs4emxVd0t3VXIzUVI4VmUrdWUza3ZHZWQ4YnRIVjNiUkFqdm1jSlJSbmhpS1hRSE53SEtKTEdvNQppY0JnM0RESjdmMDV3eVlIWm9pd3hkN3dRQy9PYlFJREFRQUJBb0lDQUhGOHlxakpzRjdMdzBqTXVCL29MenE1ClF0NjBPT1FTcTZFKzFIbEhvdEFwMk8vQTl6UmhEZVBQTGE5emRPWVorcVk5SzAzSndCWGVVMDNlN1NJL0Z0ZVEKZHAvMy92Q0t1aFlmUFRXdHd6bm1paGEyWTdjMlBDcE9zMG8wQnlYMXpSeHFWcWI3NSsyWVVOSWRMNk5JU1F4bgpGNVorRExnVXBiSDM5N0NkWjd4SWVFaDVSay9US1dxRUlYekcrMnAzNEEyOW4wYkxvbURsNnRWUzZkQ2VYcjhRCnZrMjY4YVFwMlVhMm90MTUwOWlvWW5vcFpSbGE1VDdzcm53Z3hlbHhZWVpKck9LR0c5a0U2TUJuWHVUamJCNjYKZnNTOEUrcUtKOFVmZmNVRWFuY205SEtIQlMvNVVyNkZXZnd0QkV5WDRJRlZ0eHlKelBmekl1N3ZleHVxQStacgo2TlZXZjllMy9kRGtrdUpNRWJxZjNBYlY5cWVLcjgwMjRjVk5sbkhoekxLRzRyVEZJYU9RdEpKS3RLWDUyZGRHCnEyckFyYnR0a1JSQUsvdFdRZFE5ZXhjY1RxZVBEY0s4cituV2FRcENSL2xRT2FFSldXc2g0UGRhbWNaeWJvYTUKelYrQXE0eGtXUGFSdmhZeExiWERxSk9YQVpjOCsvRzFTbkowUkJtSUdpU3NYQjVCeDRYSFRuRWhmdUdrWnYyZgp0VzJMeGRWK3pieWt2aTRibXp2ZlYyVHUyVWZHU0EzQkdWN0FrZlZJck9iQTZid1NKZCsxSHVsNW95eGh4SHNOClRsUWlOR2xUSHdLOW93SCs2eTkyQ2lDQUhEV0NocGdEenlsWGExalVQUTlrMk1ieEp4WVNwNnJ0QmhHLzZkL28KNEhuVk0zWHU3SlBsQ3FBZmZnREJBb0lCQVFEemtCYVdPUUgvSDJEZnhMbVVYVDUxLzRRR0xyeFJkZDJJQkZvNwpuUWhNV20xVlRzVWg0OTdiOUozVVJlR2t1V1NPMll4UWlxcFAxOWdvQ2FmVEYwdm51ZVlRMDAzbUIyZE1FMG1jCmNUWDk2T1JKcGRyRUxSZWkxZmdtWHhPTnRiMGFNWFNwQzBFS2kySlF2SzI2cm5Cb2dXZlZRTWVydXI4NldiSDgKOFBUTjUzWkhtazV5NHVKY0ZjMjg4T2E3U1lkL0VVbXdHRlNZMll3SHB4Z2grZGRzNFhYUDVXRTFRWnAxazhFVwppRlN1cll4dElXZm14emM2WExzL01zcDlWTmRVOHlqWjQ1cmExcC9sL2ZzazN6M2xwSndLNW0za0ZNRmk2b0hFCitadUJFZGJFNzRtNmhDWS93Qm5rdFd2WnBKVnVzMXIrZkJKeURaOHNlb25ITkFwSkFvSUJBUURDRmlta25HaDcKdzRpK1ZITHdxdGVYaDhIc3N0WndKUHFuRDBTN1FNSStXTHpHOEhVZnZuRmlGcnBuK0RkL3JZcGphSDA5YUlCVQo5U214by82dEVqWjVRWHRIYUVKUnJGSWhhcUg2WmcrRTI1SGx2c0FPNDB0elpWZ2ZrT0llVXVGTHNJc2UyM1FICk9HRy9VOVBsa1M0N2ZFYVJ4RnZoT2pvaDZrRUxqd293Yk1vOEQ1YVF5N2tlZDJmTHhYRzkwaklkWjBia3NzeUkKNVM3UWg0Wmh2b1BOYUhld1pJZG9zdC9PUGxjVFFwekFlalRxMDgyek5IT3JIUnU3UDk2bHdQam5IYVo2QVlxZwpKdUtBRHRURTFUU1E2ZkNXUDIwa2kzSmRLTFZwTzMvZ0daU25pbFFoR0lmTmVNZVdNSE9YdSttOE5vdEJORmRuCmdWZlZZQXVscHNNRkFvSUJBUURRb09iSUROTHAvcTNUWDBaN2tKZDFLY2FrS1JwRVNNcld2S3V5RHFQU0MwOUYKMkhCQnhGZmNYeDltZWVsN1dSYUt5a3hIblUrZmpzcm9HTVU1cXVYbyt6TFh6TGdZUnRVenMvM0UxTENqNnY3SgpHeGxXR3kzNDNJRndGTmJCOXgraE5TV3h1eU1lYmlCcitnSnlPd09zY05SSk5mRVM1NmJ2eTI4THREWnR2VXR5CnIvbHNyVzJwNVQ5VERhTUdZRWlCRG9UcEl4NHJ3NFVQOVJCVjRoV21mVVdXSyt4bFd1bDh0M0NZNVhSc0g5cCsKakRQYzJWNDBUc1JSc1NjRHprMll4YVNEWjFQNUNnanpUK2YxUUloYmtmSGI0Ri9YRS9SR3o0c1M5NkE5SWRPdQo0MlE5Y1A3MmNvMTdlKytEQVZqQzl6MEZhYSsvSkczcEFwbk1HWWFKQW9JQkFGQ3BiMU1uWWRFVithM0lZU0NlCmtBMDg4WjZTME1ZNHlDZElGRE9TZldmMTd6YnExbktEN3BGcWlyd05EOXV6WHhGamFyRnJ6ZklCRmZ2ckFUd2kKbHBzY1dNVGJrcnhvMXBWbXdMelZUOXZTZVRjM2FKQ0hiR01nR2xpOEdRMnJPbEQvcFVJRXlKcjdscnd5ZFoweQpFam5NczNOL1hRUWs4K1lHZWxQNGRhNmNlQXd3R2s1QkxNVjVzSnlpaVZ2dmtMNWhucmdMaXkvVnQvZ1lhd1FTCmJxcWVvU2VoRUJtMlJZZHNwem1zOUlLV0I0b1V6cWVNeEFtNGhqN3pFM0JsMjh3SnFaZUpMbmpTMEUyU1hHRVYKanN3dlBicmp6MU5oMVB6Y24xQ0YxdVpuR3ozcUluN0N1Q1h2N1ZzQTlmbDRzbkp6WkxxTHEwdXNHTG5vT2M3MQptSlVDZ2dFQVFMSGpDaU1ZWGRxSTMwRm5JeEpJZDFDNmdSci9aN3BLK3NGdWE2Rm1ZMEZFeFlWNis4cWR3SHU1CjNWMEh6NTVmUGJoa1dQKzN5VWxzejlOenhEOTMyOTdWQ3N0ZFRpK29QcWpHbG9mRzVYcEgraGF2emt6RUFLc0cKelZDY1RZNXdSMHVBMll5YzJ6ZGlaM0tWOHJuMkZ1cXV3WENSMHFySUJWR0FFNzgyTTVOcDh4cEErRm9CSHl1ZQpoWnEvdGF1ZnZJR3B5cEFGejdsOHdQTTM4SjdzMEEwYlVQRjlQMDdLbitEcGJyd1BIcFMrZU9RZGVFVjdtSTRMCnZqV1kwVVFZV3k5QUxGMG1oQUJrM2ttKzlzYXQ1YjJXcDR6eFFZaDREWW1rL09qWWJ2bS9VV0cySEdXbjl4ZUsKeGJndkVJQlNRczZHdmVqY0xWTWJJTWlwTmxDWUVRPT0KLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo=
    "password": |- 
          cGFzc3dvcmQK
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data:
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    template:
      metadata:
          labels: 
            name: ~NAME~
          name: ~NAME~
      spec:
        volumes:
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret
              - secret:
                  name: ~NAME~-secret-config
              - secret:
                  name: ~NAME~-secret-cert
        containers:
          - name: ~NAME~
            image: ~IMAGE_STREAM~
            volumeMounts:
            - name:  ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe/sf/cmod/secrets
            env:
              - name: MY_POD_NAME
                valueFrom:
                  fieldRef:
                    fieldPath: metadata.name
              - name: MY_POD_IP
                valueFrom:
                  fieldRef:
                    fieldPath: status.podIP
            ports:
              - name: https
                containerPort: 8060
                protocol: TCP
            resources:
              {}
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: ClusterIP
    ports:
      - port: 8060
        protocol: TCP
        name: https-cmod
    selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;

//================================================
hpe5gResources.defaults['nrf-reg-agent']['template']=
//================================================
`
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-swarm-configmap
    namespace: ~PROJECT~
  data:
    project-nnrf-reg-agent.yml: |
      # Sample Thorntail global configuration.
      #
      swarm:
        https:
          only: false
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
        io:
          workers:
            default:
              io-threads: 4
              task-max-threads: 32
        undertow:
          alias: localhost
          servers:
            default-server:
              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx
                  buffer-pool: null
                  http2-header-table-size: null
                  http2-initial-window-size: null
                  http2-max-concurrent-streams: null
                  http2-max-frame-size: null
                  http2-max-header-list-size: null
                  max-buffered-request-size: null
                  max-connections: 2000
                  max-header-size: null
                  max-headers: null
                  max-processing-time: null
                  no-request-timeout: null
                  read-timeout: null
                  receive-buffer: null
                  send-buffer: null
                  ssl-session-cache-size: null
                  ssl-session-timeout: null
                  url-charset: null
                  verify-client: null
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
              cipher-suite-filter: DEFAULT
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: password
          key-stores:
            ks:
              path: /etc/opt/hpe-5g/hpe-nnrf-reg-agent/security/keystore.p12
              credential-reference:
                clear-text: password
              type: PKCS12
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
            com.hpe:
              level: INFO
            com.hpe.imsc:
              level: ERROR
            io.jaegertracing.internal.reporters.LoggingReporter:
              level: ERROR
            io.netty:
              level: INFO
            io.undertow:
              level: INFO
            metrics_influxdb.measurements:
              level: ERROR
            okhttp3:
              level: INFO
            org.jboss.as:
              level: INFO
            org.wildfly:
              level: INFO
            stdout:
              handlers:
              - STDOUT
              level: INFO
              use-parent-handlers: false
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c{1.1.1.20.}] (%t) %s%e%n"
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap
    namespace: ~PROJECT~
  data:
    nnrf-reg-agent-config.yaml: |
      # Network function NNRF Client MicroService configuration.
      # The parameters below can be overridden by an external configuration.
      # HTTP/2 REST client subsystem
      rest-client:
        connector-provider: com.hpe.paas.middleware.jersey.okhttp.connector.OkhttpConnectorProvider
        properties:
          jersey.config.client.async.threadPoolSize: 50
          jersey.config.client.followRedirects: false
          jersey.config.client.connectTimeout: 100
          jersey.config.client.readTimeout: 1000
        security:
          keyCertificateLocation:
          keystoreLocation:
          keystorePassword: password
          keyCertificatePKLocation:
          keyCertificateKeyPairPassword:
          keyManagerFactoryAlgorithm:
          truststoreLocation:
          trustCertificateLocation:
          truststorePassword:
          trustCertificatePKLocation:
          trustCertificateKeyPairPassword:
          trustManagerFactoryAlgorithm:
          cryptoProtocol: TLSv1.2
          passwordEncoded: false
      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
          - name: fluentd
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.fluent.FluentI18nLoggerFactoryImpl
            properties:
              host: ~fluentd_NAME~.~PROJECT~.svc.cluster.local
              port: 24224
      statistics-configuration:
        id: hpe-nf-nrf-reg-agent-statistics
        jmx:
          domain: nnrf-reg-agent
          enabled: false
          properties:
            com.hpe.imsc.statistics.jmx.descriptors: false
            com.hpe.imsc.statistics.jmx.notifications: false
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.database: nnrf-reg-agent
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 10
          com.hpe.imsc.statistics.influxdb.server.port: 8086
          com.hpe.imsc.statistics.influxdb.server.protocol: http
      nnrf-client:
        discover-stub-mode: false
        # json file containing remote NF profile to be discovered in stub-mode
        stub-remote-nf-profile: 
        server-scheme: https
        server-fqdn: nrf.server.hpecorp.net
        server-port: 8443
        server-version: v1
        retry-limit: -1
        nfprofile-uri: file:/etc/opt/hpe-5g/hpe-nnrf-reg-agent/nnrf-register.config
        disable-register: false 
        disable-deregister: false
        opentracing-enabled: false
        enable-cache: false
        default-cache-validity-period-secs: 3600
        self-service-name: hpe-nf-nrf-reg-agent
        monitor-service-name: 
        monitor-interval: 15000
        kubernetes-namespace: default
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-register-configmap
    namespace: ~PROJECT~
  data:
    nnrf-register.config: |
      {
        "nfInstanceId": "0590E150-4C69-4d86-A49C-990BF056F994",
        "nfType":"UDM",
        "nfStatus":"REGISTERED",
        "heartBeatTimer": "45", 
        "ipv4Addresses":["127.0.0.1"],
        "plmnList":[{"mcc":111,"mnc":222}, {"mcc":111,"mnc":333}],
        "fqdn":"localhost",
        "allowedNfTypes": ["NEF"],
        "nfServices" : [ {
            "serviceInstanceId" : "UDM-EE-HPE",
            "serviceName" : "nudm-ee",
            "versions" : [ {
              "apiVersionInUri" : "v1",
              "apiFullVersion" : "1.0.2"
            } ],
            "scheme" : "https",
            "nfServiceStatus" : "REGISTERED",
            "fqdn":"localhost",
            "ipEndPoints" : [ {
              "ipv4Address" : "127.0.0.1",
              "transport" : "TCP",
              "port" : "30045"
            } ],
            "allowedNfTypes": ["NEF"]
          } ]
      }
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data: 
    "keystore.p12": |- 
      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
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    template:
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:  
        volumes:
          - name: ~NAME~-config-volume
            projected:
              sources:
              - configMap:
                  name: ~NAME~-swarm-configmap
              - configMap:
                  name: ~NAME~-application-configmap
              - configMap:
                  name: ~NAME~-register-configmap
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret
        containers:
          - name: ~NAME~ 
            image: ~IMAGE_STREAM~  
            volumeMounts:
            - name:  ~NAME~-config-volume
              mountPath: /etc/opt/hpe-5g/hpe-nnrf-reg-agent
            - name:  ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe-5g/hpe-nnrf-reg-agent/security
            ports:
              - name: https
                containerPort: 8443
                protocol: TCP
              - name: health
                containerPort: 8080
                protocol: TCP
            env:
              - name: JAVA_OPTS
                value:  -Xms512m -Xmx512m -Djava.net.preferIPv4Stack=true -Dgeneric.configuration.uri=file:/etc/opt/hpe-5g/hpe-nnrf-reg-agent/nnrf-reg-agent-config.yaml
            livenessProbe:
              httpGet:
                path: /probes/healthy
                port: health
              initialDelaySeconds: 60
              periodSeconds: 10
              timeoutSeconds: 10
            readinessProbe:
              httpGet:
                path: /probes/healthz
                port: health
              initialDelaySeconds: 60
              periodSeconds: 10
              timeoutSeconds: 10
            resources:
              {}
        serviceAccountName: ~NAME~
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: 
    ports:
      - port: 8443
        protocol: TCP
        name: nnrf-reg-agent-https
    selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;
//================================================
hpe5gResources.defaults['nudm-ee']['template']=
//================================================
`
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-swarm-configmap
    namespace: ~PROJECT~
  data:
    project-5g-nudm-ee.yml: |
      #
      # Sample Thorntail global configuration.
      #
      swarm:
        https:
          only: false
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
        io:
          workers:
            default:
              io-threads: 4
              task-max-threads: 32
        undertow:
          alias: localhost
          servers:
            default-server:
              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx
                  buffer-pool:
                  http2-header-table-size: 
                  http2-initial-window-size: 
                  http2-max-concurrent-streams: 
                  http2-max-frame-size: 
                  http2-max-header-list-size:
                  max-buffered-request-size:
                  max-connections: 2000
                  max-header-size:
                  max-headers:
                  max-processing-time:
                  no-request-timeout: 
                  read-timeout:
                  receive-buffer:
                  send-buffer: 
                  ssl-session-cache-size:
                  ssl-session-timeout:
                  url-charset:
                  verify-client:
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: password
          key-stores:
            ks:
              path: /etc/opt/hpe/nf/udm/ee/security/keystore.jks
              credential-reference:
                clear-text: password
              type: JKS
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
            com.hpe:
              level: INFO
            io.netty:
              level: INFO
            io.undertow:
              level: INFO
            okhttp3:
              level: INFO
            org.jboss.as:
              level: INFO
            org.wildfly:
              level: INFO
            stdout:
              handlers:
              - STDOUT
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c{1.1.1.20.}] (%t) %s%e%n"
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap
    namespace: ~PROJECT~
  data:
    nudm-ee-nf-config.yaml: |
      #
      # Sample Network function configuration.
      #
      # HTTP/2 REST client subsystem
      rest-client:
        connector-provider: com.hpe.paas.middleware.jersey.okhttp.connector.OkhttpConnectorProvider
        properties:
          jersey.config.client.async.threadPoolSize: 50
          jersey.config.client.followRedirects: false
          jersey.config.client.connectTimeout: 1000
          jersey.config.client.readTimeout: 10000
        security:
          keyCertificateLocation:
          keystoreLocation:
          keystorePassword: password
          keyCertificatePKLocation:
          keyCertificateKeyPairPassword:
          keyManagerFactoryAlgorithm:
          truststoreLocation:
          trustCertificateLocation:
          truststorePassword:
          trustCertificatePKLocation:
          trustCertificateKeyPairPassword:
          trustManagerFactoryAlgorithm:
          cryptoProtocol: TLSv1.2
          passwordEncoded: false
      nudm-ee:
        hplmn.mcc: 909
        hplmn.mnc: 88
        eeSubscirpionExpiryDuration: 172800
        udr:
          hostname: localhost
          port: 5090
          scheme: http
          version: v1
          basepath: http://15.213.52.238:5090
          eeExprityMaxDays: 2
      nnrf-client:
        server-scheme: https
        server-fqdn: nrf.server.hpecorp.net
        server-port: 8443
        server-version: v1
        nfprofile-uri: /etc/opt/hpe/nf/udm/ee/nnrf-register.config
        enable-cache: false
        default-cache-validity-period-secs: 3600
        discover-stub-mode: false
        # json file containing remote NF profile to be discovered in stub-mode
        stub-remote-nf-profile: /etc/opt/hpe/nf/udm/ee/udr-disc.json
      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
          - name: fluentd
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.fluent.FluentI18nLoggerFactoryImpl
            properties:
              host: fluentd.logging
              port: 24224
      statistics-configuration:
        id: nudm-ee-statistics
        enabled: true
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.port: 8086
          com.hpe.imsc.statistics.influxdb.server.protocol: http
          com.hpe.imsc.statistics.influxdb.server.database: nudm-nf
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 10
        jmx:
          enabled: false
      call-tracing:
        properties:
          JAEGER_SERVICE_NAME: ~NAME~
          JAEGER_AGENT_HOST: localhost
          JAEGER_AGENT_PORT: 8090
          JAEGER_ENDPOINT: http://localhost:6831/api/traces
          JAEGER_REPORTER_FLUSH_INTERVAL: 100
          JAEGER_REPORTER_LOG_SPANS: false
          JAEGER_SAMPLER_TYPE: "probabilistic"
          JAEGER_SAMPLER_PARAM: 1.0
        enabled: true
        trace-all-operations: true
        trace-all-ues: false
        provisioning-uri: "file:/etc/opt/hpe/nf/udm/ee/call-tracing-provisioning.yaml"
        max-trace-depth: MINIMUM
        max-body-length: 1200
        autorefresh-provisioning-period: 30
      caching-providers:
        - cache-managers:
          - caches: null
            classloader: '#notused'
            properties: null
            uri: paas://redis-cache-manager
          classloader: '#notused'
          properties:
            caching.provider.class.name: com.hpe.paas.middleware.sdk.impl.cache.redis.RedisCachingProvider
          uri: paas://redis-caching-provider
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-nnrf-registration
    namespace: ~PROJECT~
  data:
    nnrf-register.config: |
      {
        "nfInstanceId": "0590E150-4C69-4d86-A49C-990BF056F994",
        "nfType":"UDM",
        "nfStatus":"REGISTERED",
        "heartBeatTimer": "45", 
        "ipv4Addresses":["127.0.0.1"],
        "plmnList":[{"mcc":111,"mnc":222}, {"mcc":111,"mnc":333}],
      
        "fqdn":"localhost",
        "allowedNfTypes": ["NEF"],
        "nfServices" : [ {
            "serviceInstanceId" : "UDM-EE-HPE",
            "serviceName" : "nudm-ee",
            "versions" : [ {
              "apiVersionInUri" : "v1",
              "apiFullVersion" : "1.0.2"
            } ],
      
            "scheme" : "https",
      
            "nfServiceStatus" : "REGISTERED",
            "fqdn":"localhost",
            "ipEndPoints" : [ {
              "ipv4Address" : "127.0.0.1",
              "transport" : "TCP",
              "port" : "30045"
            } ],
            "allowedNfTypes": ["NEF"]
          } ]
      }
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-log4j
    namespace: ~PROJECT~
  data:
    log4j2.xml: |
`
+log4j2xml+
`
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-udr-discovery
    namespace: ~PROJECT~
  data:
    udr-disc.json: |
      [ {
      "nfInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
      "nfType" : "UDR",
      "nfStatus" : "REGISTERED",
      "plmnList" : [ {
        "mcc" : "111",
        "mnc" : "222"
      } ],
      "ipv4Addresses":["127.0.0.1"],
      "nfServicePersistence" : false,
      "nfServices" : [ {
          "serviceInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
          "serviceName" : "~nudr-dr_NAME~",
          "versions" : [ {
            "apiVersionInUri" : "v1",
            "apiFullVersion" : "1.0.0"
          } ],
          "scheme" : "https",
          "nfServiceStatus" : "REGISTERED",
          "ipEndPoints" : [ {
            "ipv4Address" : "127.0.0.1",
            "transport" : "TCP",
            "port" : "5090"
          } ],
        "allowedPlmns" : [ {
          "mcc" : "208",
          "mnc" : "01"
        } ],
        "allowedNfTypes" : [ "NEF", "UDM", "PCF", "BSF" ],
        "allowedNfDomains" : [ "pfdmanagement.nnef.cms5g.hpe.com" ]
      } ]
      } ]
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data:
    keystore.jks: |- 
      /u3+7QAAAAIAAAABAAAAAQAFYWxpYXMAAAFwKUVx5gAABQIwggT+MA4GCisGAQQBKgIRAQEFAASCBOqaZb+B8sohwziKl6IiRwrLTfMMtd/LqX/eSpFJtDIkYxVlSR9j5OTone60qs0Sn7mWqf2R9uDXLC7cujb6YXcqvXTO7SpozW+rBZz9XjyCSDNlxSrK962GJuSBCFLEnKOsSFxspNUJLYI827ZKVdJ9OQ2Rb50oO3Ruzy6CA9O4K/lXjDtZOJ0SEi9EY4BjlASb3jtSnnZ/IYxnxIztEgwub/4+V2UTPAUiSs4dx3U54s8+nTKczhVN+rL6z/EqirZ3ukNIg3Uu73c4r6iDMqMfxD3DhvVcbY+k/sQs+FFL/fhYdU5Y/X2ILgLz+AqgdEZZ8tW9XhkkDdmncPx5YgWGyys7KWNuReFIuWXbfCC4bIjTHgVzjci4R2JdrfiEjJ8vA295Xijo0ZJK62PemayiFr5xoY4D770+L5I17l79q4iYQylqgCTduEaHv+jOehrGZuyz32YPZYmZpgR8fITKGhxCUEErfQ8CHjFfuCwGTEzrQnedN5YbR3/j4ZshP6JhIaOTEgOsWcb8b6w7OARMzTjAFfo+9xqcSTO+39PElsF+4tYkqaSamGa/6E4gE4yNKU51EXXhbnKJ3IrgVnOZlRkIGaL4FMInWwe0zmQcqk5f39bfriPKh8BtlaxZCC4B3w0UpYStcvpHEYu+xO8aUb6BVzckm/vW69PXjvrWKTD/OhmVCJl6fX5W0eha5FeF7Wul/srpTmFdZtuItc/YfmAONhVpiHksXKMBnlM8d1FHibGZpvMiFM52RuHx1WjpW58IEIx2H3G81TLbeaVo7ldhyaZozJf6khwzKaKHqxeromrlWR8no2PmzjQe3FNv1rjca9gdW6wo9zVBib0aqvxEtpq5oKt18DEELLKMLr9IuRIcOV+v3WqLRoJmf2feuYFvF8SXMWJ0V1SJH41H29uDWZDhEi3rEIuIca+uxudYxs3mGcSrDVbF4nAdlvJDzf96oHjB0m+i2pMlHQjwxeVWP1Zp0SOWYX2CvUPua/7Kj27k5etBTv4Sa+TZt1MDt7sgdZdA+JQ/eGScYRhcmGDktPqnZ0zJZzsZsXRq895FORcJW3C1BOi3LnAI171WOdcVWaL9UJRBh3wYi3SETXTlS3pKCJq7zAS9dArYiakCoxXUDyxMJDbnOTIKDmf6OtEID7j1enHuBDz19UujNjzpbkyAzgxPl9evy/dpN41sA9JlOaD2QyRL0Xali2PR9wbuiwGqMG1Jrne2Cf/MRkmUcTsoDviAxPxjMGrVOYUFh4dpTksY64vlQaok6+FVL3PJYW2kt10RWegSm8b4HWShPKJBcTq5Pv5fzLt7z26VILMNn4CZBv40aMP+1riQ22/w3IKVKWaYaITZ54petaZDd+21zeHPxRXAsPMNwDlTsm3UdN9X1DUavBxI+MXSqOxn93l3K/qu2cGkw96R3k0mFCXHg+tgW9IfBnS9lwywOMoXOwU2aj9ioUdfsLFBChl/DHobeATEt5auZrievuqND30ofcE3MafpPtPI5JBp8eFe1WovSC3YtwIVK878la1U0pxTz7Za8dRWw+pGIoHpYCWQI74IuKLl41YjqOFr/3aevfDHBtzOuXgswU/wJgI2YpyizJZfh4Ngrbs+bzcCG9rSjWG+mTeYi7nugmxW74chn03cHGXTISXGxbfqgdci505YQF7yAAAAAQAFWC41MDkAAANjMIIDXzCCAkegAwIBAgIEM7Re6TANBgkqhkiG9w0BAQsFADBgMQswCQYDVQQGEwJVUzELMAkGA1UECBMCQ0ExEjAQBgNVBAcTCVBhbG8gQXRsbzEMMAoGA1UEChMDSFBFMQwwCgYDVQQLEwNDTVMxFDASBgNVBAMTC2hwZWNvcnAubmV0MB4XDTIwMDIwOTA5MjYyMVoXDTI1MDIwNzA5MjYyMVowYDELMAkGA1UEBhMCVVMxCzAJBgNVBAgTAkNBMRIwEAYDVQQHEwlQYWxvIEF0bG8xDDAKBgNVBAoTA0hQRTEMMAoGA1UECxMDQ01TMRQwEgYDVQQDEwtocGVjb3JwLm5ldDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAILdpPdjj0DB2yfApHz63CLzVxdfzzN26ZSBztxS2MP2UcbyxvLcqThv9Kao6+DKqzmnu5vUfJ4Gv0DPCRE4s70IGw5fHE3fa9Nrl8Usah4YogiD9i3T+tzaRJoa4ZpdQVIjAnHCWvo/UI76mcJ4Fssf4XYruYThwlTZFkBPijMeU0+YGGuQ6PUV4gmbNyqUKhyFby5iDuhgmjNtj9oKblibEBewAT5qu+dlAKcHdcaOa5Re0xrB85xCD+KLOWqGOyPibt/IuiLJRIhuupfvpc0ci7/WcEskc97bdBwbAqqKHPnRzROyZsKcrKFoAuOqRM8GgKx8RLAuLIen7viaYJECAwEAAaMhMB8wHQYDVR0OBBYEFOf6Ae1MFM/A3keQM0UdBM8mR1cRMA0GCSqGSIb3DQEBCwUAA4IBAQBUCC5uHyLg+sBupMlZZUfcsYEEC9U87WyCkB5HRHErwlOCw6ERt5hxZ2wuj7rK1YmVIf3EjMmv9sL4iiV38x2AjKf3FNK9ejNen+nJqKJUN3PFwGoGL4v5o2QBon0ZOh4VDu/m02oQjoVT/49WBvmBSLNvCkWszcgniiB2MGLVFAsnofCyuD0R34/tnc1ihmakEVUhY++HgOve5LfI2340AjuCtQ/06F3Xjh9DWLgF1kOw9l/BOJkECtUEkJKh6TzQOJ4izKi84dQa05SZRml9aARWgKa8BYck1YQTBsPh/IPRh5ifAFc8uP4E/VjWHMnN75MSMoHNdpCvqujnGwjHIsOk5QnVDbbP8SeNkrpnB4Cu0+A=
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    template:
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:  
        volumes:
          - name: ~NAME~-config-volume
            projected:
              sources:
              - configMap:
                  name: ~NAME~-swarm-configmap
              - configMap:
                  name: ~NAME~-application-configmap
              - configMap:
                  name: ~NAME~-application-configmap-nnrf-registration
              - configMap:
                  name: ~NAME~-application-configmap-log4j
              - configMap:
                  name: ~NAME~-application-configmap-udr-discovery
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret
        containers:
          - name: ~NAME~
            image: ~IMAGE_STREAM~
            imagePullPolicy: IfNotPresent
            volumeMounts:
            - name: ~NAME~-config-volume
              mountPath: /etc/opt/hpe/nf/udm/ee
            - name: ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe/nf/udm/ee/security
            ports:
              - name: https
                containerPort: 8443
                protocol: TCP
            ports:
              - name: health
                containerPort: 8080
                protocol: TCP
            env:
              - name: JAVA_OPTS
                value:  -Xms512m -Xmx512m -Djava.net.preferIPv4Stack=true -Dgeneric.configuration.uri=file:/etc/opt/hpe/nf/udm/ee/nudm-ee-nf-config.yaml
            livenessProbe:
              httpGet:
                path: /rest/probes/healthy
                port: health
              initialDelaySeconds: 100
              periodSeconds: 10
              timeoutSeconds: 10
            readinessProbe:
              httpGet:
                path: /rest/probes/healthz
                port: health
              initialDelaySeconds: 100
              periodSeconds: 10
              timeoutSeconds: 10
            resources:
              limits:
                cpu: 1000m
                memory: 2048Mi
              requests:
                cpu: 500m
                memory: 1024Mi
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    ports:
      - port: 8443
        protocol: TCP
        name:  https-nudm-nf
        targetPort: 30045
    selector:
      name: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;
//================================================
hpe5gResources.defaults['nudm-li-poi']['template']=
//================================================
`
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-swarm-configmap
    namespace: ~PROJECT~
  data:
    project-5g-nudm-li-poi.yml: |
      # Sample Thorntail global configuration.
      #
      swarm:
        https:
          only: true
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
        http:
          port: 8080
        undertow:
          alias: localhost
          servers:
            default-server:
              http-listeners:
                default:
                  enabled: true
                  socket-binding: http
                  enable-http2: true
              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: password
          key-stores:
            ks:
              path: "/etc/opt/hpe/nf/udm/li-poi/security/keystore.jks"
              credential-reference:
                clear-text: password
              type: JKS
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
            com.hpe:
              level: INFO
            io.netty:
              level: INFO
            io.undertow:
              level: INFO
            okhttp3:
              level: INFO
            org.jboss.as:
              level: INFO
            org.wildfly:
              level: INFO
            stdout:
              handlers:
              - STDOUT
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c] (%t) %s%e%n"
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-log4j
    namespace: ~PROJECT~
  data:
    log4j2.xml: |
`
+log4j2xml+
`
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap
    namespace: ~PROJECT~
  data:
    nudm-li-poi-nf-config.yaml: |
      # Sample Network function DEFAULT configuration.
      #
      # The parameters below can be overridden by an external configuration.
      #
      # HTTP/2 REST client subsystem
      rest-client:
        connector-provider: com.hpe.paas.middleware.jersey.netty.connector.Http2NettyConnectorProvider
        properties:
          jersey.config.client.async.threadPoolSize: 10
          jersey.config.client.connectTimeout: 100
          jersey.config.client.readTimeout: 100
      poi:
        oid: "0.4.0.2.2.4.19.15.1.4.19.15.1.1" 
      # Kafka configuration 
      pubsub:
        brokers:
         - ~amq-streams_NAME~-kafka-brokers.~PROJECT~.svc.cluster.local:9092
        properties:
          group.id:  UDMMsgConsumerGroup
        udmEventReportQueue: UDMServingSystem
      # X2 Packet configuration
      x2pdu:
        version: 1
        pduType:
           x2: 1
           KeepAlive: 3
           KeepAliveAck: 3
        payloadFormat: 2   
        payloadDirection: 5
        attributes:
           timestamp: 9
           matchedTargetIdentifier: 17
      logging:
        locale: en-US
        loggers:
        - factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
          name: log4j2
      statistics-configuration:
        id: nudm-li-poi-statistics
        enabled: true
        jmx:
          domain: Nnef_UDM_LiPoi
          enabled: true
          properties:
            com.hpe.imsc.statistics.jmx.descriptors: "true"
            com.hpe.imsc.statistics.jmx.notifications: "true"
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.database: nflipoi
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 10
          com.hpe.imsc.statistics.influxdb.server.port: "8086"
          com.hpe.imsc.statistics.influxdb.server.protocol: http
          com.hpe.imsc.statistics.publish.jsonDescriptors: true
        pubsub-publisher-enabled: false
        pubsub-subscriber-enabled: true
      caching-providers:
        - cache-managers:
          - caches:
            - eternal: "true"
              keyType: java.lang.String
              name: simple-redis-cache
              properties:
                cache.codec: com.hpe.cms5g.udm.li.common.utils.TFEncryptionCodec
                cache.connect: false
                cache.uri: redis://~redis_NAME~.~PROJECT~.svc.cluster.local:6379?database=0
              readThrough: "false"
              valueType: java.lang.String
              writeThrough: "false"
            classloader: '#notused'
            properties: null
            uri: paas://redis-caching-manager
          classloader: '#notused'
          properties:
            caching.provider.class.name: com.hpe.paas.middleware.sdk.impl.cache.redis.RedisCachingProvider
          uri: paas://redis-caching-manager      
      # Security
      tls:
        protocols: TLSv1.2
        connection.timeout: 3000
        keystore: "/etc/opt/hpe/nf/udm/li-poi/security/keystore.jks"
        keystorePassword : password
        truststore: "/etc/opt/hpe/nf/udm/li-poi/security/keystore.jks"
        truststorePassword : password
      
      dataEncryption:
        dataSecret: "VU5JWjVBQkNENjc4OTBFRg==" 
        keySecret: "secureMe"
      #UECM data validation
      validation:
        peiImeipattern: "((imei-)([0-9]{14}))"
        peiImeicdpattern: "((imeicd-)([0-9]{15}))"
        peiImeisvpattern: "((imeisv-)([0-9]{16}))"
        guamiPlmnIdpattern: "([0-9]*+[\\\\s])([0-9]*)"
        guamiAmfIdpattern: "([0-9]*+[\\\\s]){2}([0-9]*)"
        supiImsi: "imsi-[0-9]{6,15}"
        supiNai: "nai-(.+)@(.+)"
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    template:
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:  
        volumes:
          - name: ~NAME~-config-volume
            projected:
              sources:
              - configMap:
                  name: ~NAME~-swarm-configmap
              - configMap:
                  name: ~NAME~-application-configmap
              - configMap:
                  name: ~NAME~-application-configmap-log4j
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret
        containers:
          - name: ~NAME~
            image: ~IMAGE_STREAM~
            imagePullPolicy: IfNotPresent
            volumeMounts:
            - name:  ~NAME~-config-volume
              mountPath: /etc/opt/hpe/nf/udm/li-poi
            - name:  ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe/nf/udm/li-poi/security
            ports:
              - name: https
                containerPort: 8443
                protocol: TCP
            ports:
              - name: health
                containerPort: 8080
                protocol: TCP
            env:
              - name: JAVA_OPTS
                value:  -Xms512m -Xmx512m -Djava.net.preferIPv4Stack=true -Dgeneric.configuration.uri=file:/etc/opt/hpe/nf/udm/li-poi/nudm-li-poi-nf-config.yaml -Dpaas.service.name=nudm-li-poi
            livenessProbe:
              httpGet:
                path: /rest/probes/healthy
                port: health
              initialDelaySeconds: 60
              periodSeconds: 10
              timeoutSeconds: 10
            readinessProbe:
              httpGet:
                path: /rest/probes/healthz
                port: health
              initialDelaySeconds: 60
              periodSeconds: 10
              timeoutSeconds: 10
            resources:
              {}
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data:
    keystore.jks: |- 
      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
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    ports:
      - port: 8443
        protocol: TCP
        name:  https-nudm-nf
        targetPort: 30045
    selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;
//================================================
hpe5gResources.defaults['nudm-li-tf']['template']=
//================================================
`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data: 
    "keystore.jks": |- 
      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
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-log4j
    namespace: ~PROJECT~
  data:
    log4j2.xml: |
  `
  +log4j2xml+
  `
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap
    namespace: ~PROJECT~
  data:
    nudm-li-tf-nf-config.yaml: |
      # Sample Network function DEFAULT configuration.
      #
      # The parameters below can be overridden by an external configuration.
      #
      # HTTP/2 REST client subsystem
      caching-providers:
        - cache-managers:
          - caches:
            - eternal: "true"
              keyType: java.lang.String
              name: simple-redis-cache
              properties:
                cache.codec: com.hpe.cms5g.udm.li.common.utils.TFEncryptionCodec
                cache.connect: false
                cache.uri: redis://~redis_NAME~.~PROJECT~.svc.cluster.local:6379?database=0
              readThrough: "false"
              valueType: java.lang.String
              writeThrough: "false"
            classloader: '#notused'
            properties: null
            uri: paas://redis-caching-manager
          classloader: '#notused'
          properties:
            caching.provider.class.name: com.hpe.paas.middleware.sdk.impl.cache.redis.RedisCachingProvider
          uri: paas://redis-caching-manager  
      
      logging:
      
        locale: en-US
        loggers:
        - factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
          name: log4j2
      
      statistics-configuration:
        id: nudm-li-tf-statistics
      
        enabled: true
        http-client-enabled: true
        http-server-enabled: true
        jmx:
          domain: Nnef_UDM_LiTf
          enabled: true
          properties:
            com.hpe.imsc.statistics.jmx.descriptors: "true"
            com.hpe.imsc.statistics.jmx.notifications: "true"
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.database: nflitf
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 10
          com.hpe.imsc.statistics.influxdb.server.port: "8086"
          com.hpe.imsc.statistics.influxdb.server.protocol: http
          com.hpe.imsc.statistics.publish.jsonDescriptors: true
      
      # Schema Validation
      validation:
        internationalE164: "[0-9]{1,15}"
        imsi: "[0-9]{6,15}"
        imei: "[0-9]{14}"
        imeiCheckDigit: "[0-9]{15}"
        imeisv: "[0-9]{16}"
        ipv4Address: "((25[0-5]|2[0-4][0-9]|[01]?[0-9]?[0-9])\\\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9]?[0-9])"
        ipv6Address: "([0-9a-f]{4}:){7}([0-9a-f]{4})"
        tcpport: "^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$"
        udpport: "^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$"
        emailAddress: "[a-zA-Z0-9\\\\.!#$%&amp;'\\\\*\\\\+\\\\\\\\/=\\\\?\\\\^_\`\\\\{\\\\|\\\\}~\\\\-]+@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*"
        uuid: "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"
        token: "^(\\\\S+)"
        qualifiedMicrosecondDateTime: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\\\.[0-9]{6}(Z|[+-][0-9]{2}:[0-9]{2})$"
        version: "v1.6.1"
        deliveryType: "X2Only"
        enableKeepAlive: true
      
      keepAlive:
        TIME_P2: 60
        
      dataEncryption:
        dataSecret: "VU5JWjVBQkNENjc4OTBFRg=="
        keySecret: "secureMe"
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-swarm-configmap
    namespace: ~PROJECT~
  data:
    project-5g-nudm-li-tf.yml: |
      # Sample Thorntail global configuration.
      #
      
      swarm:
        https:
          only: true
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
        http:
          port: 8080
        undertow:
          alias: localhost
          servers:
            default-server:
              http-listeners:
                default:
                  enabled: true
                  socket-binding: http
                  enable-http2: true
                  always-set-keep-alive: true
              https-listeners:
                default-https:
                  enabled: true
                  socket-binding: https
                  enable-http2: true
                  ssl-context: twoWaySSC
                  always-set-keep-alive: true
          application-security-domains:
            applicationDomain:
              security-domain: myDomain 
        elytron:
          key-store-realms:
            ksRealm:
              key-store: twoWayTS
          x500-attribute-principal-decoders:
            CNDecoder:
              oid: 2.5.4.3
              maximum-segments: 1
          security-domains:
            myDomain:
              realms:
                - realm: ksRealm
              default-realm: ksRealm
              principal-decoder: CNDecoder
              permission-mapper: default-permission-mapper
             
          server-ssl-contexts:
            twoWaySSC:
              protocols: TLSv1.2
              key-manager: twoWayKM
              trust-manager: twoWayTM
              need-client-auth: true
              security-domain: myDomain
          key-managers:
            twoWayKM:
              key-store: twoWayKS
              credential-reference:
                clear-text: password
          trust-managers:
            twoWayTM:
              key-store: twoWayTS
              credential-reference:
                clear-text: password
          key-stores:
            twoWayKS:
              path: "/etc/opt/hpe/nf/udm/li-tf/security/keystore.jks"
              credential-reference:
                clear-text: password
              type: JKS
            twoWayTS:
              path: "/etc/opt/hpe/nf/udm/li-tf/security/keystore.jks"
              credential-reference:
                clear-text: password
              type: JKS
          file-audit-logs:
            local-audit:
              path: /var/opt/hpe/nf/udm/li-tf/logs/audit.log
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
      
            com.hpe:
              level: INFO
            io.netty:
              level: INFO
            io.undertow:
              level: INFO
            okhttp3:
              level: INFO
            org.jboss.as:
              level: INFO
            org.wildfly:
              level: INFO
            stdout:
              handlers:
              - STDOUT
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c{1.1.1.20.}] (%t) %s%e%n"
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: NodePort
    ports:
      - port: 8443
        nodePort: 30673
        protocol: TCP
        name: https-nudm-nf
  selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    template:
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        volumes:
          - name: ~NAME~-config-volume
            projected:
              sources:
              - configMap:
                  name: ~NAME~-swarm-configmap
              - configMap:
                  name: ~NAME~-application-configmap
              - configMap:
                  name: ~NAME~-application-configmap-log4j   
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret
        containers:
          - name: ~NAME~
            image: ~IMAGE_STREAM~
            imagePullPolicy: IfNotPresent
            volumeMounts:
            - name:  ~NAME~-config-volume
              mountPath: /etc/opt/hpe/nf/udm/li-tf
            - name:  ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe/nf/udm/li-tf/security
            ports:
              - name: https
                containerPort: 8443
                protocol: TCP
            ports:
              - name: health
                containerPort: 8080
                protocol: TCP
            env:
              - name: JAVA_OPTS
                value:  -Xms512m -Xmx512m -Djava.net.preferIPv4Stack=true -Dgeneric.configuration.uri=file:/etc/opt/hpe/nf/udm/li-tf/nudm-li-tf-nf-config.yaml -Dpaas.service.name=nudm-li-tf
            livenessProbe:
              httpGet:
                path: /rest/probes/healthy
                port: health             
              initialDelaySeconds: 60
              periodSeconds: 10
              timeoutSeconds: 10
            readinessProbe:
              httpGet:
                path: /rest/probes/healthz
                port: health              
              initialDelaySeconds: 60
              periodSeconds: 10
              timeoutSeconds: 10
            resources:
              limits:
                cpu: 1000m
                memory: 2048Mi
              requests:
                cpu: 500m
                memory: 1024Mi
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;
//================================================
hpe5gResources.defaults['nudm-ueau']['template']=
//================================================
`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data: 
    "keystore.jks": |- 
      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
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-call-tracing
    namespace: ~PROJECT~
  data:
    call-tracing-provisioning.yaml: |
      ue-provisioning:
        - ue-id:
            - "imsi-0555555555"
            - "msisdn-6666666666"
          traced-service:
            - ~NAME~
          propagate-trace: true
          trace-depth: "MEDIUM"
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-log4j
    namespace: ~PROJECT~
  data:
    log4j2.xml: |
  `
  +log4j2xml+
  `
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-nnrf-registration
    namespace: ~PROJECT~
  data:
    nnrf-register.config: |
      {
      "nfInstanceId": "0590E150-4C69-4d86-A49C-990BF056F993",
      "nfType":"UDM",
      "nfStatus":"REGISTERED",
      "heartBeatTimer": "45",
      "ipv4Addresses":["127.0.0.1"],
      "plmnList":[{"mcc":111,"mnc":222}, {"mcc":111,"mnc":333}],
  
      "fqdn":"localhost",
      "allowedNfTypes": ["AUSF"],
      "nfServices" : [ {
          "serviceInstanceId" : "UDM-UEAU-HPE",
          "serviceName" : "~NAME~",
          "versions" : [ {
            "apiVersionInUri" : "v1",
            "apiFullVersion" : "1.0.1"
          } ],
  
          "scheme" : "https",
  
          "nfServiceStatus" : "REGISTERED",
          "fqdn":"localhost",
          "ipEndPoints" : [ {
            "ipv4Address" : "127.0.0.1",
            "transport" : "TCP",
            "port" : "30046"
          } ],
          "allowedNfTypes": ["AUSF"]
        } ]
      }
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-udr-discovery
    namespace: ~PROJECT~
  data:
    udr-disc.json: |
      [ {
      "nfInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
      "nfType" : "UDR",
      "nfStatus" : "REGISTERED",
      "plmnList" : [ {
        "mcc" : "111",
        "mnc" : "222"
      } ],
      "ipv4Addresses":["127.0.0.1"],
      "nfServicePersistence" : false,
      "nfServices" : [ {
          "serviceInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
          "serviceName" : "~nudr-dr_NAME~",
          "versions" : [ {
            "apiVersionInUri" : "v1",
            "apiFullVersion" : "1.0.0"
          } ],
          "scheme" : "https",
          "nfServiceStatus" : "REGISTERED",
          "ipEndPoints" : [ {
            "ipv4Address" : "127.0.0.1",
            "transport" : "TCP",
            "port" : "5090"
          } ],
        "allowedPlmns" : [ {
          "mcc" : "208",
          "mnc" : "01"
        } ],
        "allowedNfTypes" : [ "NEF", "UDM", "PCF", "BSF" ],
        "allowedNfDomains" : [ "pfdmanagement.nnef.cms5g.hpe.com" ]
      } ]
      } ]
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap
    namespace: ~PROJECT~
  data:
    nudm-ueau-nf-config.yaml: |
      #
      # Sample Network function configuration.
      #
      # HTTP/2 REST client subsystem
      ---
      rest-client:
        connector-provider: com.hpe.paas.middleware.jersey.okhttp.connector.OkhttpConnectorProvider
        properties:
          jersey.config.client.async.threadPoolSize: 50
          jersey.config.client.followRedirects: false
          jersey.config.client.connectTimeout: 1000
          jersey.config.client.readTimeout: 10000
      
        security:
          keyCertificateLocation:
          keystoreLocation:
          keystorePassword: password
          keyCertificatePKLocation:
          keyCertificateKeyPairPassword:
          keyManagerFactoryAlgorithm:
          truststoreLocation:
          trustCertificateLocation:
          truststorePassword:
          trustCertificatePKLocation:
          trustCertificateKeyPairPassword:
          trustManagerFactoryAlgorithm:
          cryptoProtocol: TLSv1.2
          passwordEncoded: false
      
      udm-ueau:
        hplmn.mcc: 909
        hplmn.mnc: 88
      
        cmod:
          hostname: cmod
          port: 8060
          scheme: https
        threadpool:
          size: 30  
      
      nnrf-client:
        server-scheme: https
        server-fqdn: nrf.server.hpecorp.net
        server-port: 8443
        server-version: v1
        nfprofile-uri: /etc/opt/hpe/nf/udm/ueau/nnrf-register.config
        enable-cache: false
        default-cache-validity-period-secs: 3600
        discover-stub-mode: false
        # json file containing remote NF profile to be discovered in stub-mode
        stub-remote-nf-profile: /etc/opt/hpe/nf/udm/ueau/udr-disc.json
      
      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
          - name: fluentd
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.fluent.FluentI18nLoggerFactoryImpl
            properties:
              host: fluentd.logging
              port: 24224
      
      statistics-configuration:
        id: nudm-ueau-statistics
        enabled: true
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.port: 8086
          com.hpe.imsc.statistics.influxdb.server.protocol: http
          com.hpe.imsc.statistics.influxdb.server.database: nudm-nf
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 10
        jmx:
          enabled: false
      call-tracing:
        properties:
          JAEGER_SERVICE_NAME: ~NAME~
          JAEGER_AGENT_HOST: localhost
          JAEGER_AGENT_PORT: 8090
          JAEGER_ENDPOINT: http://localhost:6831/api/traces
          JAEGER_REPORTER_FLUSH_INTERVAL: 100
          JAEGER_REPORTER_LOG_SPANS: false
          JAEGER_SAMPLER_TYPE: "probabilistic"
          JAEGER_SAMPLER_PARAM: 1.0
        enabled: true
        trace-all-operations: true
        trace-all-ues: false
        provisioning-uri: "file:///etc/opt/hpe/nf/udm/ueau/call-tracing-provisioning.yaml"
        max-trace-depth: MINIMUM
        max-body-length: 1200
        autorefresh-provisioning-period: 30
      
      caching-providers:
        - cache-managers:
          - caches: null
            classloader: '#notused'
            properties: null
            uri: paas://redis-cache-manager
          classloader: '#notused'
          properties:
            caching.provider.class.name: com.hpe.paas.middleware.sdk.impl.cache.redis.RedisCachingProvider
          uri: paas://redis-caching-provider

- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-swarm-configmap
    namespace: ~PROJECT~
  data:
    project-5g-nudm-ueau.yml: |
      #
      # Sample Thorntail global configuration.
      #
      swarm:
        
        https:
          only: false
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
  
        io:
          workers:
            default:
              io-threads: 4
              task-max-threads: 32
        undertow:
          alias: localhost
          servers:
            default-server:
              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx
                  buffer-pool: 
                  http2-header-table-size: 
                  http2-initial-window-size: 
                  http2-max-concurrent-streams: 
                  http2-max-frame-size: 
                  http2-max-header-list-size:
                  max-buffered-request-size:
                  max-connections: 2000
                  max-header-size:
                  max-headers:
                  max-processing-time:
                  no-request-timeout: 
                  read-timeout:
                  receive-buffer:
                  send-buffer: 
                  ssl-session-cache-size:
                  ssl-session-timeout:
                  url-charset:
                  verify-client:
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: password
          key-stores:
            ks:
              path: /etc/opt/hpe/nf/udm/ueau/security/keystore.jks
              credential-reference:
                clear-text: password
              type: JKS
          file-audit-logs:
            local-audit:
              path: /var/opt/hpe/nf/udm/ueau/logs/audit.log
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
            com.hpe:
              level: INFO
            io.netty:
              level: INFO
            io.undertow:
              level: INFO
            okhttp3:
              level: INFO
            org.jboss.as:
              level: INFO
            org.wildfly:
              level: INFO
            stdout:
              handlers:
              - STDOUT
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c{1.1.1.20.}] (%t) %s%e%n"
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: NodePort
    ports:
      - port: 8443
        protocol: TCP
        name:  https-nudm-nf
        targetPort: 30046
  selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    template:
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        volumes:
          - name: ~NAME~-config-volume
            projected:
              sources:
              - configMap:
                  name: ~NAME~-swarm-configmap
              - configMap:
                  name: ~NAME~-application-configmap
              - configMap:
                  name: ~NAME~-application-configmap-nnrf-registration
              - configMap:
                  name: ~NAME~-application-configmap-log4j
              - configMap:
                  name: ~NAME~-application-configmap-udr-discovery
              - configMap:
                  name: ~NAME~-application-configmap-call-tracing    
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret
        containers:
          - name: ~NAME~
            image: ~IMAGE_STREAM~
            imagePullPolicy: IfNotPresent
            volumeMounts:
            - name:  ~NAME~-config-volume
              mountPath: /etc/opt/hpe/nf/udm/ueau
            - name:  ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe/nf/udm/ueau/security
            ports:
              - name: https
                containerPort: 8443
                protocol: TCP
            ports:
              - name: health
                containerPort: 8080
                protocol: TCP
            env:
              - name: JAVA_OPTS
                value:  -Xms512m -Xmx512m -Djava.net.preferIPv4Stack=true -Dgeneric.configuration.uri=file:/etc/opt/hpe/nf/udm/ueau/nudm-ueau-nf-config.yaml
            livenessProbe:
              httpGet:
                path: /rest/probes/healthy
                port: health             
              initialDelaySeconds: 60
              periodSeconds: 10
              timeoutSeconds: 40
            readinessProbe:
              httpGet:
                path: /rest/probes/healthz
                port: health              
              initialDelaySeconds: 60
              periodSeconds: 10
              timeoutSeconds: 40
            resources:
              limits:
                cpu: 1000m
                memory: 2048Mi
              requests:
                cpu: 500m
                memory: 1024Mi
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;
//================================================
hpe5gResources.defaults['nudm-uecm']['template']=
//================================================
`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data: 
    "keystore.jks": |- 
      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
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-call-tracing
    namespace: ~PROJECT~
  data:
    call-tracing-provisioning.yaml: |
      ue-provisioning:
        - ue-id:
            - "imsi-0555555555"
            - "msisdn-6666666666"
          traced-service:
            - ~NAME~
          propagate-trace: true
          trace-depth: "MEDIUM"
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-log4j
    namespace: ~PROJECT~
  data:
    log4j2.xml: |
  `
  +log4j2xml+
  `
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-nnrf-registration
    namespace: ~PROJECT~
  data:
    nnrf-register.config: |
      {
      "nfInstanceId": "0590E150-4C69-4d86-A49C-990BF056F992",
      "nfType":"UDM",
      "nfStatus":"REGISTERED",
      "heartBeatTimer": "45",
      "ipv4Addresses":["127.0.0.1"],
      "plmnList":[{"mcc":111,"mnc":222}, {"mcc":111,"mnc":333}],
      "fqdn":"localhost",
      "allowedPlmns":[{"mcc":111,"mnc":222}, {"mcc":111,"mnc":333}],
      "allowedNfTypes": ["AMF","SMF", "NEF","GMLC"],
      "nfServices" : [ {
          "serviceInstanceId" : "UDM-UECM-HPE",
          "serviceName" : "nudm-uecm",
          "versions" : [ {
            "apiVersionInUri" : "v1",
            "apiFullVersion" : "1.0.2"
          } ],
          "scheme" : "https",
          "nfServiceStatus" : "REGISTERED",
          "fqdn":"localhost",
          "ipEndPoints" : [ {
            "ipv4Address" : "127.0.0.1",
            "transport" : "TCP",
            "port" : "30044"
          } ],
            "allowedPlmns":[{"mcc":111,"mnc":222}, {"mcc":111,"mnc":333}],
          "allowedNfTypes": ["AMF","SMF","NEF","GMLC"]
        } ]
      }
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-udr-discovery
    namespace: ~PROJECT~
  data:
    udr-disc.json: |
      [ {
      "nfInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
      "nfType" : "UDR",
      "nfStatus" : "REGISTERED",
      "plmnList" : [ {
        "mcc" : "111",
        "mnc" : "222"
      } ],
      "ipv4Addresses":["127.0.0.1"],
      "nfServicePersistence" : false,
      "nfServices" : [ {
          "serviceInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
          "serviceName" : "~nudr-dr_NAME~",
          "versions" : [ {
            "apiVersionInUri" : "v1",
            "apiFullVersion" : "1.0.0"
          } ],
          "scheme" : "https",
          "nfServiceStatus" : "REGISTERED",
          "ipEndPoints" : [ {
            "ipv4Address" : "127.0.0.1",
            "transport" : "TCP",
            "port" : "5090"
          } ],
        "allowedPlmns" : [ {
          "mcc" : "208",
          "mnc" : "01"
        } ],
        "allowedNfTypes" : [ "NEF", "UDM", "PCF", "BSF" ],
        "allowedNfDomains" : [ "pfdmanagement.nnef.cms5g.hpe.com" ]
      } ]
      } ]
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap
    namespace: ~PROJECT~
  data:
    nudm-uecm-nf-config.yaml: |
      #
      # Sample Network function configuration.
      #
      # HTTP/2 REST client subsystem
      rest-client:
        connector-provider: com.hpe.paas.middleware.jersey.okhttp.connector.OkhttpConnectorProvider
        properties:
          jersey.config.client.async.threadPoolSize: 50
          jersey.config.client.followRedirects: false
          jersey.config.client.connectTimeout: 1000
          jersey.config.client.readTimeout: 10000
        security:
          keyCertificateLocation:
          keystoreLocation:
          keystorePassword: password
          keyCertificatePKLocation:
          keyCertificateKeyPairPassword:
          keyManagerFactoryAlgorithm:
          truststoreLocation:
          trustCertificateLocation:
          truststorePassword:
          trustCertificatePKLocation:
          trustCertificateKeyPairPassword:
          trustManagerFactoryAlgorithm:
          cryptoProtocol: TLSv1.2
          passwordEncoded: false
      udm-uecm:
        hplmn.mcc: 909
        hplmn.mnc: 88
        features:
          ee-enable: false
          roamingODBDataCheck: false
          OperatorPolicyForSharedData:
            Registration: AllowedWithSharedData
          LIEnbld: false
      nnrf-client:
        server-scheme: https
        server-fqdn: nrf.server.hpecorp.net
        server-port: 8443
        server-version: v1
        nfprofile-uri: /etc/opt/hpe/nf/udm/uecm/nnrf-register.config
        enable-cache: false
        default-cache-validity-period-secs: 3600
        discover-stub-mode: false
        # json file containing remote NF profile to be discovered in stub-mode
        stub-remote-nf-profile: /etc/opt/hpe/nf/udm/uecm/udr-disc.json
      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl
          - name: fluentd
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.fluent.FluentI18nLoggerFactoryImpl
            properties:
              host: fluentd.logging
              port: 24224
      statistics-configuration:
        id: nudm-uecm-statistics
        enabled: true
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.port: 8086
          com.hpe.imsc.statistics.influxdb.server.protocol: http
          com.hpe.imsc.statistics.influxdb.server.database: nudm-nf
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 10
        jmx:
          enabled: false
      call-tracing:
        properties:
          JAEGER_SERVICE_NAME: ~NAME~
          JAEGER_AGENT_HOST: localhost
          JAEGER_AGENT_PORT: 8090
          JAEGER_ENDPOINT: http://localhost:6831/api/traces
          JAEGER_REPORTER_FLUSH_INTERVAL: 100
          JAEGER_REPORTER_LOG_SPANS: false
          JAEGER_SAMPLER_TYPE: "probabilistic"
          JAEGER_SAMPLER_PARAM: 1.0
        enabled: true
        trace-all-operations: true
        trace-all-ues: false
        provisioning-uri: "file:/etc/opt/hpe/nf/udm/uecm/call-tracing-provisioning.yaml"
        max-trace-depth: MINIMUM
        max-body-length: 1200
        autorefresh-provisioning-period: 30
      caching-providers:
        - cache-managers:
          - caches: null
            classloader: '#notused'
            properties: null
            uri: paas://redis-cache-manager
          classloader: '#notused'
          properties:
            caching.provider.class.name: com.hpe.paas.middleware.sdk.impl.cache.redis.RedisCachingProvider
          uri: paas://redis-caching-provider
      # Kafka configuration
      pubsub:
        brokers:
         - 10.233.3.53:9092
        properties:
          group.id: UDMMsgConsumerGroup
          max.block.ms: 1000
        ServingSystemMsgQueue: UDMServingSystem
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-swarm-configmap
    namespace: ~PROJECT~
  data:
    project-5g-nudm-uecm.yml: |
      #
      # Sample Thorntail global configuration.
      #
      swarm:
        
        https:
          only: false
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost
  
        io:
          workers:
            default:
              io-threads: 4
              task-max-threads: 32
        undertow:
          alias: localhost
          servers:
            default-server:
              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx
                  buffer-pool: 
                  http2-header-table-size: 
                  http2-initial-window-size: 
                  http2-max-concurrent-streams: 
                  http2-max-frame-size: 
                  http2-max-header-list-size:
                  max-buffered-request-size:
                  max-connections: 2000
                  max-header-size:
                  max-headers:
                  max-processing-time:
                  no-request-timeout: 
                  read-timeout:
                  receive-buffer:
                  send-buffer: 
                  ssl-session-cache-size:
                  ssl-session-timeout:
                  url-charset:
                  verify-client:
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: password
          key-stores:
            ks:
              path: /etc/opt/hpe/nf/udm/uecm/security/keystore.jks
              credential-reference:
                clear-text: password
              type: JKS
          file-audit-logs:
            local-audit:
              path: /var/opt/hpe/nf/udm/uecm/logs/audit.log
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:
            com.hpe:
              level: INFO
            io.netty:
              level: INFO
            io.undertow:
              level: INFO
            okhttp3:
              level: INFO
            org.jboss.as:
              level: INFO
            org.wildfly:
              level: INFO
            stdout:
              handlers:
              - STDOUT
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c{1.1.1.20.}] (%t) %s%e%n"
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: NodePort
    ports:
      - port: 8443
        protocol: TCP
        name:  https-nudm-nf
        targetPort: 30044
  selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    template:
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        volumes:
          - name: ~NAME~-config-volume
            projected:
              sources:
              - configMap:
                  name: ~NAME~-swarm-configmap
              - configMap:
                  name: ~NAME~-application-configmap
              - configMap:
                  name: ~NAME~-application-configmap-nnrf-registration
              - configMap:
                  name: ~NAME~-application-configmap-log4j
              - configMap:
                  name: ~NAME~-application-configmap-udr-discovery
              - configMap:
                  name: ~NAME~-application-configmap-call-tracing    
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret
        containers:
          - name: ~NAME~
            image: ~IMAGE_STREAM~
            imagePullPolicy: IfNotPresent
            volumeMounts:
            - name:  ~NAME~-config-volume
              mountPath: /etc/opt/hpe/nf/udm/uecm
            - name:  ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe/nf/udm/uecm/security
            ports:
              - name: https
                containerPort: 8443
                protocol: TCP
            ports:
              - name: health
                containerPort: 8080
                protocol: TCP
            env:
              - name: JAVA_OPTS
                value:  -Xms512m -Xmx512m -Djava.net.preferIPv4Stack=true -Dgeneric.configuration.uri=file:/etc/opt/hpe/nf/udm/uecm/nudm-uecm-nf-config.yaml
            livenessProbe:
              httpGet:
                path: /rest/probes/healthy
                port: health             
              initialDelaySeconds: 100
              periodSeconds: 10
              timeoutSeconds: 10
            readinessProbe:
              httpGet:
                path: /rest/probes/healthz
                port: health              
              initialDelaySeconds: 100
              periodSeconds: 10
              timeoutSeconds: 10
            resources:
              limits:
                cpu: 1000m
                memory: 2048Mi
              requests:
                cpu: 500m
                memory: 1024Mi
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;

//================================================
hpe5gResources.defaults['nudm-sdm']['template']=
//================================================
`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data: 
    "keystore.jks": |- 
      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

- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-call-tracing
    namespace: ~PROJECT~
  data:
    call-tracing-provisioning.yaml: |
      ue-provisioning:
        - ue-id:
            - "imsi-0555555555"
            - "msisdn-6666666666"
          traced-service:
            - ~NAME~
          propagate-trace: true
          trace-depth: "MEDIUM"
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-log4j
    namespace: ~PROJECT~
  data:
    log4j2.xml: |
      <?xml version="1.0" encoding="UTF-8"?>
        
      <!-- ===================================================================== -->
      <!-- -->
      <!-- Log4j Configuration -->
      <!-- -->
      <!-- ===================================================================== -->

      <!-- | For more configuration information and examples see the Jakarta Log4j 
           | website: http://jakarta.apache.org/log4j -->

      <Configuration status="WARN">

        <!-- ============================== -->
        <!-- Append messages to the console -->
        <!-- ============================== -->
        
        <Appenders>
          <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c] (%t) %msg%n"/>
              <Filters>
                  <ThresholdFilter level="TRACE" onMatch="ACCEPT" />
              </Filters>
          </Console>
        </Appenders>

        <!-- ================ -->
        <!-- Limit categories -->
        <!-- ================ -->
        <Loggers>
          <Logger name="com.hpe" level="DEBUG"/>
          <Logger name="org.apache" level="WARN"/>
          <Logger name="kafka" level="WARN"/>
        
        <!-- ======================= -->
        <!-- Setup the Root category -->
        <!-- ======================= -->
        
          <Root level="INFO">
            <AppenderRef ref="Console"/>
          </Root>
        </Loggers>

      </Configuration>
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-nnrf-registration
    namespace: ~PROJECT~
  data:
    nnrf-register.config: |
      {
      "nfInstanceId": "0590E150-4C69-4d86-A49C-990BF056F991",
      "nfType":"UDM",
      "nfStatus":"REGISTERED",
      "heartBeatTimer": "45",
      "ipv4Addresses":["127.0.0.1"],
      "plmnList":[{"mcc":111,"mnc":222}, {"mcc":111,"mnc":333}],

      "fqdn":"localhost",
      "allowedNfTypes": ["AMF","SMF"],
      "nfServices" : [ {
          "serviceInstanceId" : "UDM-SDM-HPE",
          "serviceName" : "nudm-sdm",
          "versions" : [ {
            "apiVersionInUri" : "v2",
            "apiFullVersion" : "2.0.2"
          } ],

          "scheme" : "https",

          "nfServiceStatus" : "REGISTERED",
          "fqdn":"localhost",
          "ipEndPoints" : [ {
            "ipv4Address" : "127.0.0.1",
            "transport" : "TCP",

            "port" : "30043"

          } ],
          "allowedNfTypes": ["AMF","SMF"]
        } ]
      }

- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-udr-discovery
    namespace: ~PROJECT~
  data:
    udr-disc.json: |
      [ {
      "nfInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
      "nfType" : "UDR",
      "nfStatus" : "REGISTERED",
      "plmnList" : [ {
        "mcc" : "111",
        "mnc" : "222"
      } ],
      "ipv4Addresses":["127.0.0.1"],
      "nfServicePersistence" : false,
      "nfServices" : [ {
          "serviceInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
          "serviceName" : "~nudr-dr_NAME~",
          "versions" : [ {
            "apiVersionInUri" : "v1",
            "apiFullVersion" : "1.0.0"
          } ],
          "scheme" : "https",
          "nfServiceStatus" : "REGISTERED",
          "ipEndPoints" : [ {
            "ipv4Address" : "127.0.0.1",
            "transport" : "TCP",
            "port" : "5090"
          } ],
        "allowedPlmns" : [ {
          "mcc" : "208",
          "mnc" : "01"
        } ],
        "allowedNfTypes" : [ "NEF", "UDM", "PCF", "BSF" ],
        "allowedNfDomains" : [ "pfdmanagement.nnef.cms5g.hpe.com" ]
      } ]
      } ]
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap
    namespace: ~PROJECT~
  data:
    nudm-sdm-nf-config.yaml: |
      #
      # Sample Network function configuration.

      #
      # HTTP/2 REST client subsystem

      rest-client:
        connector-provider: com.hpe.paas.middleware.jersey.okhttp.connector.OkhttpConnectorProvider
        properties:
          jersey.config.client.async.threadPoolSize: 50
          jersey.config.client.followRedirects: false
          jersey.config.client.connectTimeout: 1000
          jersey.config.client.readTimeout: 10000

        security:
          keyCertificateLocation:
          keystoreLocation:
          keystorePassword: password
          keyCertificatePKLocation:
          keyCertificateKeyPairPassword:
          keyManagerFactoryAlgorithm:
          truststoreLocation:
          trustCertificateLocation:
          truststorePassword:
          trustCertificatePKLocation:
          trustCertificateKeyPairPassword:
          trustManagerFactoryAlgorithm:
          cryptoProtocol: TLSv1.2
          passwordEncoded: false

      nudm-sdm:
        hplmn.mcc: 909
        hplmn.mnc: 88
        features:
          UDR-Support-Multi-data-set: true
          OperatorPolicyForSharedData: SendSubscriptionDataWithSharedData
          SubsToNotifyCallbackUri: https://localhost.com:8080/nudm-notify/v1/notify/sendNotification
          SdmSubscribeInUdr: true
          AMFRegMonitorInUDR: true
          ODBMonitorInUDR: false
          MultipleHplmnEnabled: false


      nnrf-client:
        server-scheme: https
        server-fqdn: nrf.server.hpecorp.net
        server-port: 8443
        server-version: v1
        nfprofile-uri: /etc/opt/hpe/nf/udm/sdm/nnrf-register.config
        enable-cache: false
        default-cache-validity-period-secs: 3600
        discover-stub-mode: false
        # json file containing remote NF profile to be discovered in stub-mode
        stub-remote-nf-profile: /etc/opt/hpe/nf/udm/sdm/udr-disc.json


      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl


          - name: fluentd
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.fluent.FluentI18nLoggerFactoryImpl
            properties:
              host: fluentd.logging
              port: 24224

      statistics-configuration:
        id: nudm-sdm-statistics
        enabled: true
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.port: 8086
          com.hpe.imsc.statistics.influxdb.server.protocol: http
          com.hpe.imsc.statistics.influxdb.server.database: nudm-nf
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 10
        jmx:
          enabled: false
      call-tracing:
        properties:
          JAEGER_SERVICE_NAME: ~NAME~
          JAEGER_AGENT_HOST: localhost
          JAEGER_AGENT_PORT: 8090
          JAEGER_ENDPOINT: http://localhost:6831/api/traces
          JAEGER_REPORTER_FLUSH_INTERVAL: 100
          JAEGER_REPORTER_LOG_SPANS: false
          JAEGER_SAMPLER_TYPE: "probabilistic"
          JAEGER_SAMPLER_PARAM: 1.0
        enabled: true
        trace-all-operations: true
        trace-all-ues: false
        provisioning-uri: file:/etc/opt/hpe/nf/udm/sdm/call-tracing-provisioning.yaml
        max-trace-depth: MINIMUM
        max-body-length: 1200
        autorefresh-provisioning-period: 30

      caching-providers:

        - cache-managers:
          - caches: null
            classloader: '#notused'
            properties: null
            uri: paas://redis-cache-manager
          classloader: '#notused'
          properties:
            caching.provider.class.name: com.hpe.paas.middleware.sdk.impl.cache.redis.RedisCachingProvider
          uri: paas://redis-caching-provider
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-swarm-configmap
    namespace: ~PROJECT~
  data:
    project-5g-nudm-sdm.yml: |
      #
      # Sample Thorntail global configuration.
      #
      swarm:
        
        https:
          only: false
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost

        io:
          workers:
            default:
              io-threads: 4
              task-max-threads: 32
        undertow:
          alias: localhost
          servers:
            default-server:

              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx

                  buffer-pool: 
                  http2-header-table-size: 
                  http2-initial-window-size: 
                  http2-max-concurrent-streams:  
                  http2-max-frame-size: 
                  http2-max-header-list-size:
                  max-buffered-request-size:
                  max-connections: 2000
                  max-header-size:
                  max-headers:
                  max-processing-time:
                  no-request-timeout: 
                  read-timeout:
                  receive-buffer:
                  send-buffer: 
                  ssl-session-cache-size:
                  ssl-session-timeout:
                  url-charset:
                  verify-client:
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: password
          key-stores:
            ks:
              path: /etc/opt/hpe/nf/udm/sdm/security/keystore.jks
              credential-reference:
                clear-text: password
              type: JKS
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:

            com.hpe:
              level: INFO
            io.netty:
              level: INFO
            io.undertow:
              level: INFO
            okhttp3:
              level: INFO
            org.jboss.as:
              level: INFO
            org.wildfly:
              level: INFO
            stdout:
              handlers:
              - STDOUT
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c{1.1.1.20.}] (%t) %s%e%n"
- kind: Service
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
    labels:
      name: ~NAME~
      deploymentconfig: ~NAME~
  spec:
    type: LoadBalancer
    ports:
      - port: 8443
        protocol: TCP
        name:  https-nudm-nf
        targetPort: 30043
    selector:
        name: ~NAME~
        deploymentconfig: ~NAME~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    template:
      metadata:
        labels:
          app.kubernetes.io/name: ~NAME~
          app.kubernetes.io/instance: ~PROJECT~
      spec:
        volumes:
          - name: ~NAME~-config-volume
            projected:
              sources:
              - configMap:
                  name: ~NAME~-swarm-configmap
              - configMap:
                  name: ~NAME~-application-configmap
              - configMap:
                  name: ~NAME~-application-configmap-nnrf-registration
              - configMap:
                  name: ~NAME~-application-configmap-log4j
              - configMap:
                  name: ~NAME~-application-configmap-udr-discovery
              - configMap:
                  name: ~NAME~-application-configmap-call-tracing    
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret

        containers:
          - name: ~NAME~
            namespace: ~PROJECT~
            image: ~IMAGE_STREAM~

            volumeMounts:
            - name:  ~NAME~-config-volume
              mountPath: /etc/opt/hpe/nf/udm/sdm
            - name:  ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe/nf/udm/sdm/security

            ports:
              - name: https
                containerPort: 8443
                protocol: TCP
            ports:
              - name: health
                
                containerPort: 8080
               
                protocol: TCP
            env:
              - name: JAVA_OPTS
                value:  -Xms512m -Xmx512m -Djava.net.preferIPv4Stack=true   -Dgeneric.configuration.uri=file:/etc/opt/hpe/nf/udm/sdm/nudm-sdm-nf-config.yaml
            livenessProbe:
              httpGet:
                path: /rest/probes/healthy
                port: health
              initialDelaySeconds: 100
              periodSeconds: 10
              timeoutSeconds: 10
            readinessProbe:
              httpGet:
                path: /rest/probes/healthz
                port: health
              initialDelaySeconds: 100
              periodSeconds: 10
              timeoutSeconds: 10
            resources:
              limits:
                cpu: 1000m
                memory: 2048Mi
              requests:
                cpu: 500m
                memory: 1024Mi
`;

//================================================
hpe5gResources.defaults['nudm-notify']['template']=
//================================================
`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~-secret
    namespace: ~PROJECT~
  type: Opaque
  data: 
    "keystore.jks": |- 
      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

- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-call-tracing
    namespace: ~PROJECT~
  data:
    call-tracing-provisioning.yaml: |
      ue-provisioning:
        - ue-id:
            - "imsi-0555555555"
            - "msisdn-6666666666"
          traced-service:
            - ~NAME~
          propagate-trace: true
          trace-depth: "MEDIUM"

- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-log4j
    namespace: ~PROJECT~
  data:
    log4j2.xml: |
      <?xml version="1.0" encoding="UTF-8"?>
        
      <!-- ===================================================================== -->
      <!-- -->
      <!-- Log4j Configuration -->
      <!-- -->
      <!-- ===================================================================== -->

      <!-- | For more configuration information and examples see the Jakarta Log4j 
           | website: http://jakarta.apache.org/log4j -->

      <Configuration status="WARN">

        <!-- ============================== -->
        <!-- Append messages to the console -->
        <!-- ============================== -->
        
        <Appenders>
          <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c] (%t) %msg%n"/>
              <Filters>
                  <ThresholdFilter level="TRACE" onMatch="ACCEPT" />
              </Filters>
          </Console>
        </Appenders>

        <!-- ================ -->
        <!-- Limit categories -->
        <!-- ================ -->
        <Loggers>
          <Logger name="com.hpe" level="DEBUG"/>
          <Logger name="org.apache" level="WARN"/>
          <Logger name="kafka" level="WARN"/>
        
        <!-- ======================= -->
        <!-- Setup the Root category -->
        <!-- ======================= -->
        
          <Root level="INFO">
            <AppenderRef ref="Console"/>
          </Root>
        </Loggers>

      </Configuration>
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-nnrf-registration
    namespace: ~PROJECT~
  data:
    nnrf-register.config: |
      {
      "nfInstanceId": "0590E150-4C69-4d86-A49C-990BF056F995",
      "nfType":"UDM",
      "nfStatus":"REGISTERED",
      "heartBeatTimer": "45",
      "ipv4Addresses":["127.0.0.1"],
      "plmnList":[{"mcc":111,"mnc":222}, {"mcc":111,"mnc":333}],

      "fqdn":"localhost",
      "allowedNfTypes": ["AMF","SMF"],
      "nfServices" : [ {
          "serviceInstanceId" : "UDM-NOTIFY-HPE",
          "serviceName" : "~NAME~",
          "versions" : [ {
            "apiVersionInUri" : "v2",
            "apiFullVersion" : "2.0.2"
          } ],

          "scheme" : "https",

          "nfServiceStatus" : "REGISTERED",
          "fqdn":"localhost",
          "ipEndPoints" : [ {
            "ipv4Address" : "127.0.0.1",
            "transport" : "TCP",

            "port" : "30047"

          } ],
          "allowedNfTypes": ["AMF","SMF"]
        } ]
      }

- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap-udr-discovery
    namespace: ~PROJECT~
  data:
    udr-disc.json: |
      [ {
      "nfInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
      "nfType" : "UDR",
      "nfStatus" : "REGISTERED",
      "plmnList" : [ {
        "mcc" : "111",
        "mnc" : "222"
      } ],
      "ipv4Addresses":["127.0.0.1"],
      "nfServicePersistence" : false,
      "nfServices" : [ {
          "serviceInstanceId" : "57fc19a1-b366-477a-8c2b-080044e680b5",
          "serviceName" : "~nudr-dr_NAME~",
          "versions" : [ {
            "apiVersionInUri" : "v1",
            "apiFullVersion" : "1.0.0"
          } ],
          "scheme" : "https",
          "nfServiceStatus" : "REGISTERED",
          "ipEndPoints" : [ {
            "ipv4Address" : "127.0.0.1",
            "transport" : "TCP",
            "port" : "5090"
          } ],
        "allowedPlmns" : [ {
          "mcc" : "208",
          "mnc" : "01"
        } ],
        "allowedNfTypes" : [ "NEF", "UDM", "PCF", "BSF" ],
        "allowedNfDomains" : [ "pfdmanagement.nnef.cms5g.hpe.com" ]
      } ]
      } ]
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-application-configmap
    namespace: ~PROJECT~
  data:
    nudm-notify-nf-config.yaml: |
      #
      # Sample Network function configuration.

      #
      # HTTP/2 REST client subsystem

      rest-client:
        connector-provider: com.hpe.paas.middleware.jersey.okhttp.connector.OkhttpConnectorProvider
        properties:
          jersey.config.client.async.threadPoolSize: 50
          jersey.config.client.followRedirects: false
          jersey.config.client.connectTimeout: 1000
          jersey.config.client.readTimeout: 10000

        security:
          keyCertificateLocation:
          keystoreLocation:
          keystorePassword: password
          keyCertificatePKLocation:
          keyCertificateKeyPairPassword:
          keyManagerFactoryAlgorithm:
          truststoreLocation:
          trustCertificateLocation:
          truststorePassword:
          trustCertificatePKLocation:
          trustCertificateKeyPairPassword:
          trustManagerFactoryAlgorithm:
          cryptoProtocol: TLSv1.2
          passwordEncoded: false

      nudm-notify:
        hplmn.mcc: 909
        hplmn.mnc: 88
        features:
          NotifyThreadPoolSize: 50
          OperatorPolicyForSharedData: SendSubscriptionDataWithSharedData
          SubsToNotifyCallbackUri: https://localhost.com:8080/nudm-notify/v1/notify/sendNotification
          SdmSubscribeInUdr: true
          AMFRegMonitorInUDR: true
          ODBMonitorInUDR: false
          MultipleHplmnEnabled: false


      nnrf-client:
        server-scheme: https
        server-fqdn: nrf.server.hpecorp.net
        server-port: 8443
        server-version: v1
        nfprofile-uri: /etc/opt/hpe/nf/udm/notify/nnrf-register.config
        enable-cache: false
        default-cache-validity-period-secs: 3600
        discover-stub-mode: false
        # json file containing remote NF profile to be discovered in stub-mode
        stub-remote-nf-profile: /etc/opt/hpe/nf/udm/notify/udr-disc.json


      logging:
        locale: en-US
        loggers:
          - name: log4j2
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.log4j.Log4j2I18nLoggerFactoryImpl


          - name: fluentd
            factory-class: com.hpe.paas.middleware.sdk.impl.logging.fluent.FluentI18nLoggerFactoryImpl
            properties:
              host: fluentd.logging
              port: 24224

      statistics-configuration:
        id: nudm-notify-statistics
        enabled: true
        jvm-metrics: true
        properties:
          com.hpe.imsc.statistics.influxdb.server.host: ~influxdb_NAME~.~PROJECT~.svc.cluster.local
          com.hpe.imsc.statistics.influxdb.server.port: 8086
          com.hpe.imsc.statistics.influxdb.server.protocol: http
          com.hpe.imsc.statistics.influxdb.server.database: nudm-nf
          com.hpe.imsc.statistics.influxdb.server.polling.interval: 10
        jmx:
          enabled: false
      call-tracing:
        properties:
          JAEGER_SERVICE_NAME: ~NAME~
          JAEGER_AGENT_HOST: localhost
          JAEGER_AGENT_PORT: 8090
          JAEGER_ENDPOINT: http://localhost:6831/api/traces
          JAEGER_REPORTER_FLUSH_INTERVAL: 100
          JAEGER_REPORTER_LOG_SPANS: false
          JAEGER_SAMPLER_TYPE: "probabilistic"
          JAEGER_SAMPLER_PARAM: 1.0
        enabled: true
        trace-all-operations: true
        trace-all-ues: false
        provisioning-uri: file:/etc/opt/hpe/nf/udm/notify/call-tracing-provisioning.yaml
        max-trace-depth: MINIMUM
        max-body-length: 1200
        autorefresh-provisioning-period: 30

      caching-providers:

        - cache-managers:
          - caches: null
            classloader: '#notused'
            properties: null
            uri: paas://redis-cache-manager
          classloader: '#notused'
          properties:
            caching.provider.class.name: com.hpe.paas.middleware.sdk.impl.cache.redis.RedisCachingProvider
          uri: paas://redis-caching-provider
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~-swarm-configmap
    namespace: ~PROJECT~
  data:
    project-5g-nudm-notify.yml: |
      #
      # Sample Thorntail global configuration.
      #
      swarm:
        
        https:
          only: false
          port: 8443
          keystore:
            embedded: true
          certificate:
            generate: true
            host: localhost

        io:
          workers:
            default:
              io-threads: 4
              task-max-threads: 32
        undertow:
          alias: localhost
          servers:
            default-server:

              https-listeners:
                default-https:
                  socket-binding: https
                  enable-http2: true
                  ssl-context: sslctx

                  buffer-pool: 
                  http2-header-table-size: 
                  http2-initial-window-size: 
                  http2-max-concurrent-streams:  
                  http2-max-frame-size: 
                  http2-max-header-list-size:
                  max-buffered-request-size:
                  max-connections: 2000
                  max-header-size:
                  max-headers:
                  max-processing-time:
                  no-request-timeout: 
                  read-timeout:
                  receive-buffer:
                  send-buffer: 
                  ssl-session-cache-size:
                  ssl-session-timeout:
                  url-charset:
                  verify-client:
        elytron:
          server-ssl-contexts:
            sslctx:
              protocols: TLSv1.2
              key-manager: km
          key-managers:
            km:
              key-store: ks
              credential-reference:
                clear-text: password
          key-stores:
            ks:
              path: /etc/opt/hpe/nf/udm/notify/security/keystore.jks
              credential-reference:
                clear-text: password
              type: JKS
        logging:
          root-logger:
            level: INFO
            handlers:
            - CONSOLE
          loggers:

            com.hpe:
              level: INFO
            io.netty:
              level: INFO
            io.undertow:
              level: INFO
            okhttp3:
              level: INFO
            org.jboss.as:
              level: INFO
            org.wildfly:
              level: INFO
            stdout:
              handlers:
              - STDOUT
              level: INFO
          console-handlers:
            STDOUT:
              named-formatter: null
              formatter: "%s%e%n"
            CONSOLE:
              named-formatter: null
              formatter: "%d{yyyy-MM-dd HH:mm:ss,SSS} %-5p [%c{1.1.1.20.}] (%t) %s%e%n"
- kind: Service
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
    labels:
      name: ~NAME~
      deploymentconfig: ~NAME~
  spec:
    type: LoadBalancer
    ports:
      - port: 8443
        protocol: TCP
        name:  https-nudm-nf
        targetPort: 30047
    selector:
        name: ~NAME~
        deploymentconfig: ~NAME~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    template:
      metadata:
        labels:
          app.kubernetes.io/name: ~NAME~
          app.kubernetes.io/instance: ~PROJECT~
      spec:
        volumes:
          - name: ~NAME~-config-volume
            projected:
              sources:
              - configMap:
                  name: ~NAME~-swarm-configmap
              - configMap:
                  name: ~NAME~-application-configmap
              - configMap:
                  name: ~NAME~-application-configmap-nnrf-registration
              - configMap:
                  name: ~NAME~-application-configmap-log4j
              - configMap:
                  name: ~NAME~-application-configmap-udr-discovery
              - configMap:
                  name: ~NAME~-application-configmap-call-tracing    
          - name: ~NAME~-secrets-volume
            projected:
              sources:
              - secret:
                  name: ~NAME~-secret

        containers:
          - name: ~NAME~
            namespace: ~PROJECT~
            image: ~IMAGE_STREAM~

            volumeMounts:
            - name:  ~NAME~-config-volume
              mountPath: /etc/opt/hpe/nf/udm/sdm
            - name:  ~NAME~-secrets-volume
              mountPath: /etc/opt/hpe/nf/udm/sdm/security

            ports:
              - name: https
                containerPort: 8443
                protocol: TCP
            ports:
              - name: health
                
                containerPort: 8080
               
                protocol: TCP
            env:
              - name: JAVA_OPTS
                value:  -Xms512m -Xmx512m -Djava.net.preferIPv4Stack=true   -Dgeneric.configuration.uri=file:/etc/opt/hpe/nf/udm/sdm/nudm-notify-nf-config.yaml
            livenessProbe:
              httpGet:
                path: /rest/probes/healthy
                port: health
              initialDelaySeconds: 100
              periodSeconds: 10
              timeoutSeconds: 10
            readinessProbe:
              httpGet:
                path: /rest/probes/healthz
                port: health
              initialDelaySeconds: 100
              periodSeconds: 10
              timeoutSeconds: 10
            resources:
              limits:
                cpu: 1000m
                memory: 2048Mi
              requests:
                cpu: 500m
                memory: 1024Mi
`;

//================================================
hpe5gResources.defaults['ignite']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
~PERSISTENCE_START~
- kind: PersistentVolumeClaim
  apiVersion: v1
  metadata:
    name: ~NAME~-work
  spec:
    accessModes:
    - ReadWriteOnce
    resources:
      requests:
        storage: ~STORAGE~
    ~VOLUME~
- kind: PersistentVolumeClaim
  apiVersion: v1
  metadata:
    name: ~NAME~-wal
  spec:
    accessModes:
    - ReadWriteOnce
    resources:
      requests:
        storage: ~STORAGE~
    ~VOLUME~
- kind: PersistentVolumeClaim
  apiVersion: v1
  metadata:
    name: ~NAME~-walarchive
  spec:
    accessModes:
    - ReadWriteOnce
    resources:
      requests:
        storage: ~STORAGE~
    ~VOLUME~
~PERSISTENCE_END~
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        serviceAccountName: ~NAME~
        containers:
        - name: ~NAME~
          namespace: ~PROJECT~
          image: ~IMAGE_STREAM~
          env:
          - name: OPTION_LIBS
            value: ignite-kubernetes,ignite-rest-http
          - name: CONFIG_URI
            value: file:/etc/opt/hpe-5g/ignite/igniteConfig.xml
~PERSISTENCE_START~
          - name: JVM_OPTS
            value: "-DIGNITE_WAL_MMAP=false"
~PERSISTENCE_END~
          ports:
          # Ports to open.
          # Might be optional depending on your Kubernetes environment.
          - containerPort: 11211 # REST port number.
          - containerPort: 47100 # communication SPI port number.
          - containerPort: 47500 # discovery SPI port number.
          - containerPort: 49112 # JMX port number.
          - containerPort: 10800 # SQL port number.
          - containerPort: 10900 # Thin clients port number.
          volumeMounts:
            - name: ~NAME~
              namespace: ~PROJECT~
              mountPath: /etc/opt/hpe-5g/ignite/
~PERSISTENCE_START~
            - mountPath: /gridgain/work
              name: ~NAME~-work
            - mountPath: /gridgain/wal
              name: ~NAME~-wal
            - mountPath: /gridgain/walarchive
              name: ~NAME~-walarchive
~PERSISTENCE_END~
        volumes:
          - name: ~NAME~
            namespace: ~PROJECT~
            configMap:
              name: ~NAME~
~PERSISTENCE_START~
          - name: ~NAME~-work
            persistentVolumeClaim:
              claimName: ~NAME~-work
          - name: ~NAME~-wal
            persistentVolumeClaim:
              claimName: ~NAME~-wal
          - name: ~NAME~-walarchive
            persistentVolumeClaim:
              claimName: ~NAME~-walarchive
~PERSISTENCE_END~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: LoadBalancer
    ports:
      - name: rest
        port: 8080
        targetPort: 8080
      - name: sql
        port: 10800
        targetPort: 10800
      - name: thinclients
        port: 10900
        targetPort: 10900
    # Optional - remove 'sessionAffinity' property if the Ignite cluster
    # and applications deployed within Kubernetes
    sessionAffinity: ClientIP   
    selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  data:
    igniteConfig.xml: |+
      <beans xmlns="http://www.springframework.org/schema/beans" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation=" http://www.springframework.org/schema/beans  http://www.springframework.org/schema/beans/spring-beans-3.1.xsd">
       <bean id="ignite.cfg" class="org.apache.ignite.configuration.IgniteConfiguration">
~PERSISTENCE_START~
       <property name="workDirectory" value="/gridgain/work"/>
           <property name="dataStorageConfiguration">
               <bean class="org.apache.ignite.configuration.DataStorageConfiguration">
                   <property name="defaultDataRegionConfiguration">
                       <bean class="org.apache.ignite.configuration.DataRegionConfiguration">
                           <property name="persistenceEnabled" value="true"/>
                       </bean>
                   </property>
                   <property name="walPath" value="/gridgain/wal"/>
                   <property name="walArchivePath" value="/gridgain/walarchive"/>
               </bean>
           </property>
~PERSISTENCE_END~
         <property name="discoverySpi">
            <bean class="org.apache.ignite.spi.discovery.tcp.TcpDiscoverySpi">
              <property name="ipFinder">
                 <bean class="org.apache.ignite.spi.discovery.tcp.ipfinder.kubernetes.TcpDiscoveryKubernetesIpFinder">
                 <property name="namespace" value="~PROJECT~"/>
                 <property name="serviceName" value="~NAME~"/>
                 <property name="masterUrl" value="https://#{systemEnvironment['KUBERNETES_SERVICE_HOST']}:443"/>
                 </bean>
              </property>
            </bean>
         </property>
        </bean>
       </beans>
`;
//================================================
hpe5gResources.defaults['redis']['template']=redis_template(true);
hpe5gResources.defaults['redis-nopwd']['template']=redis_template(false);
//================================================
function redis_template(setPassword){
	var result=
`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  name: ~NAME~
  stringData:
    database-password: ~NAME~
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    ports:
    - name: redis
      nodePort: 0
      port: 6379
      protocol: TCP
      targetPort: 6379
    selector:
      name: ~NAME~
      deploymentconfig: ~NAME~
    sessionAffinity: None
    type: ClusterIP
  status:
    loadBalancer: {}
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
- kind: PersistentVolumeClaim
  apiVersion: v1
  metadata:
    name: ~NAME~
  spec:
    accessModes:
    - ReadWriteOnce
    resources:
      requests:
        storage: ~STORAGE~
    ~VOLUME~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    annotations:
      template.alpha.openshift.io/wait-for-ready: 'true'
    name: ~NAME~
  spec:
    replicas: ~REPLICAS~
    selector:
      name: ~NAME~
    strategy:
      type: Recreate
    template:
      metadata:
        labels:
          name: ~NAME~
      spec:
        containers:
        - capabilities: {}
          env:
          - name: REDIS_PORT
            value: "6379"
`;
result+=setPassword?`
          - name: REDIS_PASSWORD
            valueFrom:
              secretKeyRef:
                key: database-password
                name: ~NAME~`:`
          - name: ALLOW_EMPTY_PASSWORD
            value: "true"`;
result+=`
          image: ~IMAGE_STREAM~
          livenessProbe:
            initialDelaySeconds: 30
            tcpSocket:
              port: 6379
            timeoutSeconds: 1
          name: redis
          ports:
          - containerPort: 6379
            protocol: TCP
          readinessProbe:
            exec:
              command:
              - "/bin/bash"
              - "-i"
              - "-c"
              - "test \\\"$(redis-cli -h 127.0.0.1 -a ~NAME~ ping)\\\" == \\"PONG\\\""
            initialDelaySeconds: 5
            timeoutSeconds: 1
          resources:
            limits:
              memory: ~STORAGE~
          securityContext:
            capabilities: {}
            privileged: false
          terminationMessagePath: "/dev/termination-log"
          volumeMounts:
          - mountPath: "/var/lib/redis/data"
            name: "~NAME~-data"
        dnsPolicy: ClusterFirst
        restartPolicy: Always
        volumes:
        - name: "~NAME~-data"
          persistentVolumeClaim:
            claimName: ~NAME~
  status: {}
`;
return result;
}
//================================================
hpe5gResources.defaults['influxdb']['template']=
//================================================
`
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  name: ~NAME~
  stringData:
    admin-user-password: ~NAME~
  type: Opaque
- kind: PersistentVolumeClaim
  apiVersion: v1
  metadata:
    name: ~NAME~
  spec:
    accessModes:
    - ReadWriteOnce
    resources:
      requests:
        storage: ~STORAGE~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: ClusterIP
    ports:
      - port: 8086
        targetPort: http
        protocol: TCP
        name: http
        nodePort: null
      - port: 8088
        targetPort: rpc
        protocol: TCP
        name: rpc
        nodePort: null
    selector:
        name: ~NAME~
        deploymentconfig: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    annotations:
      template.alpha.openshift.io/wait-for-ready: 'true'
    name: ~NAME~
  spec:
    replicas: ~REPLICAS~
    selector:
        name: ~NAME~
    template:
      metadata:
        labels:
          name: ~NAME~
      spec:
        containers:
          - name: ~NAME~
            image: ~IMAGE_STREAM~
            imagePullPolicy: IfNotPresent
            env:
              - name: BITNAMI_DEBUG
                value: "false"
              - name: POD_IP
                valueFrom:
                  fieldRef:
                    fieldPath: status.podIP
              - name: INFLUXDB_HTTP_AUTH_ENABLED
                value: "false"
              - name: INFLUXDB_ADMIN_USER
                value: "admin"
              - name: INFLUXDB_ADMIN_USER_PASSWORD
                valueFrom:
                  secretKeyRef:
                    name: ~NAME~
                    key: admin-user-password
              - name: INFLUXDB_DB
                value: ~NAME~
            ports:
              - name: http
                containerPort: 8086
                protocol: TCP
              - name: rpc
                containerPort: 8088
                protocol: TCP
            livenessProbe:
              exec:
                command:
                  - "/bin/bash"
                  - "-i"
                  - "-c"
                  - "INFLUX_USERNAME=\\\"$INFLUXDB_ADMIN_USER\\\" INFLUX_PASSWORD=\\\"$INFLUXDB_ADMIN_USER_PASSWORD\\\" timeout 29s influx -host $POD_IP -port 8086 -execute \\\"SHOW DATABASES\\\" "
              initialDelaySeconds: 180
              periodSeconds: 45
              timeoutSeconds: 30
              successThreshold: 1
              failureThreshold: 6
            readinessProbe:
              exec:
                command:
                  - "/bin/bash"
                  - "-i"
                  - "-c"
                  - "INFLUX_USERNAME=\\\"$INFLUXDB_ADMIN_USER\\\" INFLUX_PASSWORD=\\\"$INFLUXDB_ADMIN_USER_PASSWORD\\\" timeout 29s influx -host $POD_IP -port 8086 -execute \\\"SHOW DATABASES\\\" "
              initialDelaySeconds: 60
              periodSeconds: 45
              timeoutSeconds: 30
              successThreshold: 1
              failureThreshold: 6
            resources:
              limits: {}
              requests: {}
            volumeMounts:
              - name: data
                mountPath: /bitnami/influxdb
        volumes:
          - name: data
            persistentVolumeClaim:
              claimName: ~NAME~
`;
//================================================
hpe5gResources.defaults['jenkins']['template']=
//================================================
`
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: Route
  apiVersion: v1
  metadata:
    annotations:
      haproxy.router.openshift.io/timeout: 4m
      template.openshift.io/expose-uri: http://{.spec.host}{.spec.path}
    name: ~NAME~
  spec:
    tls:
      insecureEdgeTerminationPolicy: Redirect
      termination: edge
    to:
      kind: Service
      name: ~NAME~
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    annotations:
      template.alpha.openshift.io/wait-for-ready: "true"
    name: ~NAME~
  spec:
    replicas: 1
    selector:
      name: ~NAME~
    strategy:
      type: Recreate
    template:
      metadata:
        labels:
          name: ~NAME~
      spec:
        containers:
        - capabilities: {}
          env:
          - name: OPENSHIFT_ENABLE_OAUTH
            value: "true"
          - name: OPENSHIFT_ENABLE_REDIRECT_PROMPT
            value: "true"
          - name: KUBERNETES_MASTER
            value: https://kubernetes.default:443
          - name: KUBERNETES_TRUST_CERTIFICATES
            value: "true"
          - name: JENKINS_SERVICE_NAME
            value: ~NAME~
          - name: JNLP_SERVICE_NAME
            value: ~NAME~-jnlp
          image: ~IMAGE_STREAM~
          imagePullPolicy: IfNotPresent
          livenessProbe:
            failureThreshold: 2
            httpGet:
              path: /login
              port: 8080
            initialDelaySeconds: 420
            periodSeconds: 360
            timeoutSeconds: 240
          name: jenkins
          readinessProbe:
            httpGet:
              path: /login
              port: 8080
            initialDelaySeconds: 3
            timeoutSeconds: 240
          resources:
            limits:
              memory: 2048Mi
          securityContext:
            capabilities: {}
            privileged: false
          terminationMessagePath: /dev/termination-log
          volumeMounts:
          - mountPath: /var/lib/jenkins
            name: ~NAME~-data
        dnsPolicy: ClusterFirst
        restartPolicy: Always
        serviceAccountName: ~NAME~
        volumes:
        - emptyDir:
            medium: ""
          name: ~NAME~-data
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    annotations:
      serviceaccounts.openshift.io/oauth-redirectreference.jenkins: '{"kind":"OAuthRedirectReference","apiVersion":"v1","reference":{"kind":"Route","name":"~NAME~"}}'
    name: ~NAME~
- apiVersion: v1
  groupNames: null
  kind: RoleBinding
  metadata:
    name: ~NAME~_edit
  roleRef:
    name: edit
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
- kind: Service
  apiVersion: v1
  metadata:
    name: ~NAME~-jnlp
  spec:
    ports:
    - name: agent
      nodePort: 0
      port: 50000
      protocol: TCP
      targetPort: 50000
    selector:
      name: ~NAME~
    sessionAffinity: None
    type: ClusterIP
- kind: Service
  apiVersion: v1
  metadata:
    annotations:
      service.alpha.openshift.io/dependencies: '[{"name": "~NAME~-jnlp", "namespace": "", "kind": "Service"}]'
      service.openshift.io/infrastructure: "true"
    name: ~NAME~
  spec:
    ports:
    - name: web
      nodePort: 0
      port: 80
      protocol: TCP
      targetPort: 8080
    selector:
      name: ~NAME~
    sessionAffinity: None
    type: ClusterIP
`;
//================================================
hpe5gResources.defaults['elasticsearch']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source        
- kind: PersistentVolumeClaim
  apiVersion: v1
  metadata:
    name: ~NAME~
  spec:
    accessModes:
    - ReadWriteOnce 
    resources:
       requests:
         storage: ~STORAGE~
    ~VOLUME~
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        serviceAccountName: ~NAME~
        containers:
        - name: ~NAME~
          namespace: ~PROJECT~
          image: ~IMAGE_STREAM~
          readinessProbe:
            httpGet:
              path: /_cluster/health
              port: 9200
            initialDelaySeconds: 5
          livenessProbe:
            httpGet:
              path: /_cluster/health?local=true
              port: 9200
            initialDelaySeconds: 90
          env:
            - name: NODE_DATA
              value: 'false'
            - name: NODE_MASTER
              value: 'false'
            - name: DISCOVERY_SERVICE
              value: elasticsearch-discovery
            - name: PROCESSORS
              valueFrom:
                resourceFieldRef:
                  divisor: '0'
                  resource: limits.cpu
            - name: ES_JAVA_OPTS
              value: "-Djava.net.preferIPv4Stack=true -Xms512m -Xmx512m  "
            - name: MINIMUM_MASTER_NODES
              value: '2'
            - name: TAKE_FILE_OWNERSHIP
              value: 'true'
          volumeMounts:
            - mountPath: /usr/share/elasticsearch/data/
              name: ~NAME~
        volumes:
          - name: ~NAME~
            namespace: ~PROJECT~
            persistentVolumeClaim:
              claimName: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: LoadBalancer
    ports:
      - name: rest
        port: 8080
        targetPort: 8080
      - name: sql
        port: 10800
        targetPort: 10800
      - name: thinclients
        port: 10900
        targetPort: 10900
    # Optional - remove 'sessionAffinity' property if the Ignite cluster
    # and applications deployed within Kubernetes
    sessionAffinity: ClientIP   
    selector:
      name: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;
//================================================
hpe5gResources.defaults['telegraf']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source        
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        serviceAccountName: ~NAME~
        containers:
        - name: ~NAME~
          namespace: ~PROJECT~
          image: ~IMAGE_STREAM~
          env:
          - name: HOSTNAME
            value: telegraf-polling-service
          volumeMounts:
          - name: config-volume
            mountPath: /etc/telegraf
        volumes:
          - name: config-volume
            configMap:
              name: ~NAME~
    selector:
      name: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: ClusterIP
    ports:
    - port: 8888
      targetPort: 8888
      name: "health"
    - port: 8125
      targetPort: 8125
      protocol: "UDP"
      name: "statsd"
    selector:
      name: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  data:
    telegraf.conf: |+    
      [agent]
        collection_jitter = "0s"
        debug = false
        flush_interval = "10s"
        flush_jitter = "0s"
        hostname = "$HOSTNAME"
        interval = "10s"
        logfile = ""
        metric_batch_size = 1000
        metric_buffer_limit = 10000
        omit_hostname = false
        precision = ""
        quiet = false
        round_interval = true
      [[processors.enum]]
        [[processors.enum.mapping]]
          dest = "status_code"
          field = "status"
          [processors.enum.mapping.value_mappings]
              critical = 3
              healthy = 1
              problem = 2
      [[outputs.prometheus_client]]
        listen = ":9273"
        path = "/metrics"
      [[inputs.internal]]
        collect_memstats = false
      [[inputs.influxdb_listener]]
        service_address = ":8888"
`;

//================================================
hpe5gResources.defaults['prometheus-alertmanager']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source        
- kind: PersistentVolumeClaim
  apiVersion: v1
  metadata:
    name: ~NAME~
  spec:
    accessModes:
    - ReadWriteOnce 
    resources:
       requests:
         storage: ~STORAGE~
    ~VOLUME~
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        serviceAccountName: ~NAME~
        containers:
        - name: ~NAME~
          namespace: ~PROJECT~
          image: ~IMAGE_STREAM~
          env:
            - name: POD_IP
              valueFrom:
                fieldRef:
                  apiVersion: v1
                  fieldPath: status.podIP
          args:
            - --config.file=/etc/config/alertmanager.yml
            - --storage.path=/data
            - --cluster.advertise-address=$(POD_IP):6783
            - --web.external-url=http://localhost:9093
          ports:
            - containerPort: 9093
          readinessProbe:
            httpGet:
              path: /-/ready
              port: 9093
            initialDelaySeconds: 30
            timeoutSeconds: 30
          resources:
            {}
          volumeMounts:
            - name: config-volume
              mountPath: /etc/config
            - name: storage-volume
              mountPath: "/data"
        volumes:
          - name: config-volume
            configMap:
              name: ~NAME~
          - name: storage-volume
            namespace: ~PROJECT~
            persistentVolumeClaim:
              claimName: ~NAME~
    selector:
      name: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    ports:
      - name: http
        port: 80
        protocol: TCP
        targetPort: 9093
    selector:
      name: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  data:
    alertmanager.yml: |
      global: {}
      receivers:
      - name: default-receiver
      route:
        group_interval: 5m
        group_wait: 10s
        receiver: default-receiver
        repeat_interval: 3h
`;
//================================================
hpe5gResources.defaults['prometheus']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source        
- kind: PersistentVolumeClaim
  apiVersion: v1
  metadata:
    name: ~NAME~
  spec:
    accessModes:
    - ReadWriteOnce 
    resources:
       requests:
         storage: ~STORAGE~
    ~VOLUME~
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        serviceAccountName: ~NAME~
        containers:
        - name: ~NAME~
          namespace: ~PROJECT~
          image: ~IMAGE_STREAM~
          args:
            - --storage.tsdb.retention.time=15d
            - --config.file=/etc/config/prometheus.yml
            - --storage.tsdb.path=/data
            - --web.console.libraries=/etc/prometheus/console_libraries
            - --web.console.templates=/etc/prometheus/consoles
            - --web.enable-lifecycle
          ports:
            - containerPort: 9090
          readinessProbe:
            httpGet:
              path: /-/ready
              port: 9090
            initialDelaySeconds: 30
            timeoutSeconds: 30
            failureThreshold: 3
            successThreshold: 1
          livenessProbe:
            httpGet:
              path: /-/healthy
              port: 9090
            initialDelaySeconds: 30
            timeoutSeconds: 30
            failureThreshold: 3
            successThreshold: 1
          resources:
            {}
          volumeMounts:
            - name: config-volume
              mountPath: /etc/config
            - mountPath: /data
              name: storage-volume
        volumes:
          - name: config-volume
            configMap:
              name: ~NAME~
          - name: storage-volume
            namespace: ~PROJECT~
            persistentVolumeClaim:
              claimName: ~NAME~
    selector:
      name: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    ports:
      - name: http
        port: 80
        protocol: TCP
        targetPort: 9090
    selector:
      name: ~NAME~
    sessionAffinity: None
    type: "ClusterIP"
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  data:
    alerting_rules.yml: |
      {}
    alerts: |
      {}
    prometheus.yml: |
      global:
        evaluation_interval: 1m
        scrape_interval: 1m
        scrape_timeout: 10s
      rule_files:
      - /etc/config/recording_rules.yml
      - /etc/config/alerting_rules.yml
      - /etc/config/rules
      - /etc/config/alerts
      scrape_configs:
      - job_name: prometheus
        static_configs:
        - targets:
          - localhost:9090
      - bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        job_name: kubernetes-apiservers
        kubernetes_sd_configs:
        - role: endpoints
        relabel_configs:
        - action: keep
          regex: default;kubernetes;https
          source_labels:
          - __meta_kubernetes_namespace
          - __meta_kubernetes_service_name
          - __meta_kubernetes_endpoint_port_name
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
          insecure_skip_verify: true
      - bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        job_name: kubernetes-nodes
        kubernetes_sd_configs:
        - role: node
        relabel_configs:
        - action: labelmap
          regex: __meta_kubernetes_node_label_(.+)
        - replacement: kubernetes.default.svc:443
          target_label: __address__
        - regex: (.+)
          replacement: /api/v1/nodes/$1/proxy/metrics
          source_labels:
          - __meta_kubernetes_node_name
          target_label: __metrics_path__
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
          insecure_skip_verify: true
      - bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        job_name: kubernetes-nodes-cadvisor
        kubernetes_sd_configs:
        - role: node
        relabel_configs:
        - action: labelmap
          regex: __meta_kubernetes_node_label_(.+)
        - replacement: kubernetes.default.svc:443
          target_label: __address__
        - regex: (.+)
          replacement: /api/v1/nodes/$1/proxy/metrics/cadvisor
          source_labels:
          - __meta_kubernetes_node_name
          target_label: __metrics_path__
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
          insecure_skip_verify: true
      - job_name: kubernetes-service-endpoints
        kubernetes_sd_configs:
        - role: endpoints
        relabel_configs:
        - action: keep
          regex: true
          source_labels:
          - __meta_kubernetes_service_annotation_prometheus_io_scrape
        - action: replace
          regex: (https?)
          source_labels:
          - __meta_kubernetes_service_annotation_prometheus_io_scheme
          target_label: __scheme__
        - action: replace
          regex: (.+)
          source_labels:
          - __meta_kubernetes_service_annotation_prometheus_io_path
          target_label: __metrics_path__
        - action: replace
          regex: ([^:]+)(?::\d+)?;(\d+)
          replacement: $1:$2
          source_labels:
          - __address__
          - __meta_kubernetes_service_annotation_prometheus_io_port
          target_label: __address__
        - action: labelmap
          regex: __meta_kubernetes_service_label_(.+)
        - action: replace
          source_labels:
          - __meta_kubernetes_namespace
          target_label: kubernetes_namespace
        - action: replace
          source_labels:
          - __meta_kubernetes_service_name
          target_label: kubernetes_name
        - action: replace
          source_labels:
          - __meta_kubernetes_pod_node_name
          target_label: kubernetes_node
      - job_name: kubernetes-service-endpoints-slow
        kubernetes_sd_configs:
        - role: endpoints
        relabel_configs:
        - action: keep
          regex: true
          source_labels:
          - __meta_kubernetes_service_annotation_prometheus_io_scrape_slow
        - action: replace
          regex: (https?)
          source_labels:
          - __meta_kubernetes_service_annotation_prometheus_io_scheme
          target_label: __scheme__
        - action: replace
          regex: (.+)
          source_labels:
          - __meta_kubernetes_service_annotation_prometheus_io_path
          target_label: __metrics_path__
        - action: replace
          regex: ([^:]+)(?::\d+)?;(\d+)
          replacement: $1:$2
          source_labels:
          - __address__
          - __meta_kubernetes_service_annotation_prometheus_io_port
          target_label: __address__
        - action: labelmap
          regex: __meta_kubernetes_service_label_(.+)
        - action: replace
          source_labels:
          - __meta_kubernetes_namespace
          target_label: kubernetes_namespace
        - action: replace
          source_labels:
          - __meta_kubernetes_service_name
          target_label: kubernetes_name
        - action: replace
          source_labels:
          - __meta_kubernetes_pod_node_name
          target_label: kubernetes_node
        scrape_interval: 5m
        scrape_timeout: 30s
      - honor_labels: true
        job_name: prometheus-pushgateway
        kubernetes_sd_configs:
        - role: service
        relabel_configs:
        - action: keep
          regex: pushgateway
          source_labels:
          - __meta_kubernetes_service_annotation_prometheus_io_probe
      - job_name: kubernetes-services
        kubernetes_sd_configs:
        - role: service
        metrics_path: /probe
        params:
          module:
          - http_2xx
        relabel_configs:
        - action: keep
          regex: true
          source_labels:
          - __meta_kubernetes_service_annotation_prometheus_io_probe
        - source_labels:
          - __address__
          target_label: __param_target
        - replacement: blackbox
          target_label: __address__
        - source_labels:
          - __param_target
          target_label: instance
        - action: labelmap
          regex: __meta_kubernetes_service_label_(.+)
        - source_labels:
          - __meta_kubernetes_namespace
          target_label: kubernetes_namespace
        - source_labels:
          - __meta_kubernetes_service_name
          target_label: kubernetes_name
      - job_name: kubernetes-pods
        kubernetes_sd_configs:
        - role: pod
        relabel_configs:
        - action: keep
          regex: true
          source_labels:
          - __meta_kubernetes_pod_annotation_prometheus_io_scrape
        - action: replace
          regex: (.+)
          source_labels:
          - __meta_kubernetes_pod_annotation_prometheus_io_path
          target_label: __metrics_path__
        - action: replace
          regex: ([^:]+)(?::\d+)?;(\d+)
          replacement: $1:$2
          source_labels:
          - __address__
          - __meta_kubernetes_pod_annotation_prometheus_io_port
          target_label: __address__
        - action: labelmap
          regex: __meta_kubernetes_pod_label_(.+)
        - action: replace
          source_labels:
          - __meta_kubernetes_namespace
          target_label: kubernetes_namespace
        - action: replace
          source_labels:
          - __meta_kubernetes_pod_name
          target_label: kubernetes_pod_name
      - job_name: kubernetes-pods-slow
        kubernetes_sd_configs:
        - role: pod
        relabel_configs:
        - action: keep
          regex: true
          source_labels:
          - __meta_kubernetes_pod_annotation_prometheus_io_scrape_slow
        - action: replace
          regex: (.+)
          source_labels:
          - __meta_kubernetes_pod_annotation_prometheus_io_path
          target_label: __metrics_path__
        - action: replace
          regex: ([^:]+)(?::\d+)?;(\d+)
          replacement: $1:$2
          source_labels:
          - __address__
          - __meta_kubernetes_pod_annotation_prometheus_io_port
          target_label: __address__
        - action: labelmap
          regex: __meta_kubernetes_pod_label_(.+)
        - action: replace
          source_labels:
          - __meta_kubernetes_namespace
          target_label: kubernetes_namespace
        - action: replace
          source_labels:
          - __meta_kubernetes_pod_name
          target_label: kubernetes_pod_name
        scrape_interval: 5m
        scrape_timeout: 30s
      alerting:
        alertmanagers:
        - kubernetes_sd_configs:
            - role: pod
          tls_config:
            ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
          bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
          relabel_configs:
          - source_labels: [__meta_kubernetes_namespace]
            regex: ~NAME~
            action: keep
          - source_labels: [__meta_kubernetes_pod_label_app]
            regex: prometheus
            action: keep
          - source_labels: [__meta_kubernetes_pod_label_component]
            regex: alertmanager
            action: keep
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_probe]
            regex: .*
            action: keep
          - source_labels: [__meta_kubernetes_pod_container_port_number]
            regex:
            action: drop
    recording_rules.yml: |
      {}
    rules: |
      {}
`;
//================================================
hpe5gResources.defaults['kube-state-metrics']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ClusterRole
  apiVersion: rbac.authorization.k8s.io/v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  rules:
  - apiGroups: ["certificates.k8s.io"]
    resources:
    - certificatesigningrequests
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - configmaps
    verbs: ["list", "watch"]
  - apiGroups: ["batch"]
    resources:
    - cronjobs
    verbs: ["list", "watch"]
  - apiGroups: ["extensions", "apps"]
    resources:
    - daemonsets
    verbs: ["list", "watch"]
  - apiGroups: ["extensions", "apps"]
    resources:
    - deployments
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - endpoints
    verbs: ["list", "watch"]
  - apiGroups: ["autoscaling"]
    resources:
    - horizontalpodautoscalers
    verbs: ["list", "watch"]
  - apiGroups: ["extensions", "networking.k8s.io"]
    resources:
    - ingresses
    verbs: ["list", "watch"]
  - apiGroups: ["batch"]
    resources:
    - jobs
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - limitranges
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - namespaces
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - nodes
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - persistentvolumeclaims
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - persistentvolumes
    verbs: ["list", "watch"]
  - apiGroups: ["policy"]
    resources:
      - poddisruptionbudgets
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - pods
    verbs: ["list", "watch"]
  - apiGroups: ["extensions", "apps"]
    resources:
    - replicasets
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - replicationcontrollers
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - resourcequotas
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - secrets
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources:
    - services
    verbs: ["list", "watch"]
  - apiGroups: ["apps"]
    resources:
    - statefulsets
    verbs: ["list", "watch"]
  - apiGroups: ["storage.k8s.io"]
    resources:
      - storageclasses
    verbs: ["list", "watch"]
- kind: ClusterRoleBinding
  apiVersion: rbac.authorization.k8s.io/v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  roleRef:
    kind: ClusterRole
    name: ~NAME~
    namespace: ~PROJECT~
    apiGroup: rbac.authorization.k8s.io
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source        
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        hostNetwork: false
        serviceAccountName: ~NAME~
        securityContext:
          fsGroup: 65534
          runAsUser: 65534
        containers:
        - name: ~NAME~
          namespace: ~PROJECT~
          args:
          - --collectors=certificatesigningrequests
          - --collectors=configmaps
          - --collectors=cronjobs
          - --collectors=daemonsets
          - --collectors=deployments
          - --collectors=endpoints
          - --collectors=horizontalpodautoscalers
          - --collectors=ingresses
          - --collectors=jobs
          - --collectors=limitranges
          - --collectors=namespaces
          - --collectors=nodes
          - --collectors=persistentvolumeclaims
          - --collectors=persistentvolumes
          - --collectors=poddisruptionbudgets
          - --collectors=pods
          - --collectors=replicasets
          - --collectors=replicationcontrollers
          - --collectors=resourcequotas
          - --collectors=secrets
          - --collectors=services
          - --collectors=statefulsets
          - --collectors=storageclasses
          imagePullPolicy: IfNotPresent
          image: ~IMAGE_STREAM~
          ports:
          - containerPort: 8080
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 5
            timeoutSeconds: 5
    selector:
      name: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: "ClusterIP"
    ports:
    - name: "http"
      protocol: TCP
      port: 8080
      targetPort: 8080
    selector:
      name: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;
//================================================
hpe5gResources.defaults['pushgateway']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source        
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        serviceAccountName: ~NAME~
        containers:
        - name: ~NAME~
          namespace: ~PROJECT~
          image: ~IMAGE_STREAM~
          ports:
            - containerPort: 9091
          livenessProbe:
            httpGet:
              path: /-/healthy
              port: 9091
            initialDelaySeconds: 10
            timeoutSeconds: 10
          readinessProbe:
            httpGet:
              path: /-/ready
              port: 9091
            initialDelaySeconds: 10
            timeoutSeconds: 10
          resources:
            {}
    selector:
      name: ~NAME~
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata: 
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    selector:
      name: ~NAME~
    ports:
      - name: http
        port: 9091
        protocol: TCP
        targetPort: 9091
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
`;
//================================================
hpe5gResources.defaults['fluentd']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: Role
  apiVersion: rbac.authorization.k8s.io/v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  rules:
  - apiGroups: ['extensions']
    resources: ['podsecuritypolicies']
    verbs:     ['use']
    resourceNames:
    - ~NAME~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template: 
      metadata:
        labels: 
          name: ~NAME~
        name: ~NAME~
      spec:
        serviceAccountName: ~NAME~
        terminationGracePeriodSeconds: 30
        containers:
        - name: ~NAME~
          namespace: ~PROJECT~
          image: ~IMAGE_STREAM~
          imagePullPolicy: IfNotPresent
          env:
            - name: OUTPUT_HOST
              value: "elasticsearch-client.default.svc.cluster.local"
            - name: OUTPUT_PORT
              value: "9200"
            - name: OUTPUT_SCHEME
              value: "http"
            - name: OUTPUT_SSL_VERSION
              value: "TLSv1"
            - name: OUTPUT_BUFFER_CHUNK_LIMIT
              value: "2M"
            - name: OUTPUT_BUFFER_QUEUE_LIMIT
              value: "8"
          resources:
              {}
          ports:
            - name: monitor-agent
              containerPort: 24220
              protocol: TCP
            - name: http-input
              containerPort: 9880
              protocol: TCP
          livenessProbe:
            httpGet:
              # Use percent encoding for query param.
              # The value is {"log": "health check"}.
              # the endpoint itself results in a new fluentd
              # tag 'fluentd.pod-healthcheck'
              path: /fluentd.pod.healthcheck?json=%7B%22log%22%3A+%22health+check%22%7D
              port: 9880
            initialDelaySeconds: 5
            timeoutSeconds: 1
          volumeMounts:
            - name: ~NAME~-config
              mountPath: /etc/fluent/config.d
            - name: ~NAME~-buffer
              mountPath: "/var/log/fluentd-buffers"
        volumes:
          - name: ~NAME~-config
            configMap:
              name: ~NAME~
              defaultMode: 0777
          - name: ~NAME~-buffer
            emptyDir: {}
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
    annotations:
      {}
  spec:
    type: ClusterIP
    ports:
      - name: monitor-agent
        port: 24220
        targetPort: 24220
        protocol: TCP
    selector:
      name: ~NAME~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  data:
    forward-input.conf: |-
      <source>
        @type forward
        port 24224
        bind 0.0.0.0
      </source>
      
    general.conf: |-
      # Prevent fluentd from handling records containing its own logs. Otherwise
      # it can lead to an infinite loop, when error in sending one message generates
      # another message which also fails to be sent and so on.
      <match fluentd.**>
        @type null
      </match>
      
      # Used for health checking
      <source>
        @type http
        port 9880
        bind 0.0.0.0
      </source>
      
      # Emits internal metrics to every minute, and also exposes them on port
      # 24220. Useful for determining if an output plugin is retryring/erroring,
      # or determining the buffer queue length.
      <source>
        @type monitor_agent
        bind 0.0.0.0
        port 24220
        tag fluentd.monitor.metrics
      </source>
      
    output.conf: |-
      <match **>
        @id elasticsearch
        @type elasticsearch
        @log_level info
        include_tag_key true
        # Replace with the host/port to your Elasticsearch cluster.
        host "#{ENV['OUTPUT_HOST']}"
        port "#{ENV['OUTPUT_PORT']}"
        scheme "#{ENV['OUTPUT_SCHEME']}"
        ssl_version "#{ENV['OUTPUT_SSL_VERSION']}"
        logstash_format true
        <buffer>
        @type file
      	path /var/log/fluentd-buffers/kubernetes.system.buffer
      	flush_mode interval
      	retry_type exponential_backoff
      	flush_thread_count 2
      	flush_interval 5s
      	retry_forever
      	retry_max_interval 30
      	chunk_limit_size "#{ENV['OUTPUT_BUFFER_CHUNK_LIMIT']}"
      	queue_limit_length "#{ENV['OUTPUT_BUFFER_QUEUE_LIMIT']}"
      	overflow_action block
        </buffer>
      </match>
      
    system.conf: |-
      <system>
        root_dir /tmp/fluentd-buffers/
      </system>
`;
//================================================
hpe5gResources.defaults['grafana']['template']=
//================================================
`
- kind: ServiceAccount
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
- kind: RoleBinding
  apiVersion: authorization.openshift.io/v1
  metadata:
    name: ~NAME~-view
    namespace: ~PROJECT~
  roleRef:
    kind: Role
    name: view
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: PodSecurityPolicy
  apiVersion: policy/v1beta1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
    annotations:
      seccomp.security.alpha.kubernetes.io/allowedProfileNames: 'docker/default'
      seccomp.security.alpha.kubernetes.io/defaultProfileName:  'docker/default'
      apparmor.security.beta.kubernetes.io/allowedProfileNames: 'runtime/default'
      apparmor.security.beta.kubernetes.io/defaultProfileName:  'runtime/default'
  spec:
    privileged: false
    allowPrivilegeEscalation: false
    requiredDropCapabilities:
      # Default set from Docker, without DAC_OVERRIDE or CHOWN
      - FOWNER
      - FSETID
      - KILL
      - SETGID
      - SETUID
      - SETPCAP
      - NET_BIND_SERVICE
      - NET_RAW
      - SYS_CHROOT
      - MKNOD
      - AUDIT_WRITE
      - SETFCAP
    volumes:
      - 'configMap'
      - 'emptyDir'
      - 'projected'
      - 'secret'
      - 'downwardAPI'
      - 'persistentVolumeClaim'
    hostNetwork: false
    hostIPC: false
    hostPID: false
    runAsUser:
      rule: 'RunAsAny'
    seLinux:
      rule: 'RunAsAny'
    supplementalGroups:
      rule: 'RunAsAny'
    fsGroup:
      rule: 'RunAsAny'
    readOnlyRootFilesystem: false
- kind: Secret
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  type: Opaque
  stringData:
    admin-user: "admin"
    admin-password: "~NAME~"
    ldap-toml: ""
- kind: Role
  apiVersion: rbac.authorization.k8s.io/v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  rules:
  - apiGroups:      ['extensions']
    resources:      ['podsecuritypolicies']
    verbs:          ['use']
    resourceNames:  [~NAME~]
- kind: RoleBinding
  apiVersion: rbac.authorization.k8s.io/v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  roleRef:
    apiGroup: rbac.authorization.k8s.io
    kind: Role
    name: ~NAME~
  subjects:
  - kind: ServiceAccount
    name: ~NAME~
    namespace: ~PROJECT~
- kind: ImageStream
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    lookupPolicy:
      local: false
    tags:
    - annotations:
      from:
        kind: DockerImage
        name: ~IMAGE_STREAM~
      generation: 1
      importPolicy: {}
      name: ""
      referencePolicy:
        type: Source
- kind: DeploymentConfig
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    template:
      metadata:
        labels:
          app.kubernetes.io/name: ~NAME~
          app.kubernetes.io/instance: ~PROJECT~
        annotations:
          checksum/config: 4475028f2c9539fd7734add184328dab2f3276bb67234eaa341bf31148a57a95
          checksum/dashboards-json-config: 01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b
          checksum/sc-dashboard-provider-config: 01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b
          checksum/secret: ce5751f7f7d101eaf061a9daac6dcc70a2aced1e3099af5448c3fe23c66dd633
      spec:
        serviceAccountName: ~NAME~
        securityContext:
          fsGroup: 472
          runAsUser: 472
        containers:
        - name: ~NAME~
          namespace: ~PROJECT~
          image: ~IMAGE_STREAM~
          env:
            - name: GF_SECURITY_ADMIN_USER
              valueFrom:
                secretKeyRef:
                  name: ~NAME~
                  key: admin-user
            - name: GF_SECURITY_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: ~NAME~
                  key: admin-password
          ports:
            - name: service
              containerPort: 80
              protocol: TCP
            - name: grafana
              containerPort: 3000
              protocol: TCP
          volumeMounts:
            - name: ~NAME~-config
              namespace: ~PROJECT~
              mountPath: "/etc/grafana/grafana.ini"
              subPath: grafana.ini
            - name: ~NAME~-storage
              mountPath: "/var/lib/grafana"
          livenessProbe:
            failureThreshold: 10
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 60
            timeoutSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
          resources:
            {}
        volumes:
          - name: ~NAME~-config
            namespace: ~PROJECT~
            configMap:
              name: ~NAME~
          - name: ~NAME~-storage
            emptyDir: {}
    replicas: ~REPLICAS~
- kind: Service
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    type: ClusterIP
    ports:
      - name: service
        port: 80
        protocol: TCP
        targetPort: 3000
    selector:
      app.kubernetes.io/name: ~NAME~
      app.kubernetes.io/instance: ~PROJECT~
- kind: Route
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    to:
      kind: Service
      name: ~NAME~
- kind: ConfigMap
  apiVersion: v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  data:
    grafana.ini: |
      [analytics]
      check_for_updates = true
      [grafana_net]
      url = https://grafana.net
      [log]
      mode = console
      [paths]
      data = /var/lib/grafana/data
      logs = /var/log/grafana
      plugins = /var/lib/grafana/plugins
      provisioning = /etc/grafana/provisioning
`;
//================================================
hpe5gResources.defaults['jaeger-product']['template']=
//================================================
`
- kind: Jaeger
  apiVersion: jaegertracing.io/v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
`;
//================================================
hpe5gResources.defaults['cert-manager']['template']=
//================================================
`
- kind: CertManager
  apiVersion: operator.cert-manager.io/v1alpha1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec: {}
`;
//================================================
hpe5gResources.defaults['kiali-ossm']['template']=
//================================================
`
- kind: MonitoringDashboard
  apiVersion: monitoring.kiali.io/v1alpha1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    title: My App Dashboard
    items:
      - chart:
        name: My App Processing Duration
        unit: seconds
        spans: 6
        metricName: my_app_duration_seconds
        dataType: histogram
        aggregations:
          - label: id
            displayName: ID
`;
//================================================
hpe5gResources.defaults['servicemeshoperator']['template']=
//================================================
`
- kind: ServiceMeshControlPlane
  apiVersion: maistra.io/v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    istio:
      gateways:
        istio-egressgateway:
          autoscaleEnabled: false
        istio-ingressgateway:
          autoscaleEnabled: false
      mixer:
        policy:
          autoscaleEnabled: false
        telemetry:
          autoscaleEnabled: false
      pilot:
        autoscaleEnabled: false
        traceSampling: 100
      kiali:
        enabled: true
      grafana:
        enabled: true
      tracing:
        enabled: true
        jaeger:
          template: all-in-one
`;
//================================================
hpe5gResources.defaults['amq-streams']['template']=
//================================================
`
- kind: Kafka
  apiVersion: kafka.strimzi.io/v1beta1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    kafka:
      version: 2.4.0
      replicas: ~REPLICAS~
      listeners:
        plain: {}
        tls: {}
      config:
        offsets.topic.replication.factor: 3
        transaction.state.log.replication.factor: 3
        transaction.state.log.min.isr: 2
        log.message.format.version: '2.4'
      storage:
        type: ephemeral
    zookeeper:
      replicas: ~REPLICAS~
      storage:
        type: ephemeral
    entityOperator:
      topicOperator: {}
      userOperator: {}
`;
//================================================
hpe5gResources.defaults['elasticsearch-operator']['template']=
//================================================
`
- kind: Elasticsearch
  apiVersion: logging.openshift.io/v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    managementState: Managed
    nodeSpec:
      image: >-
        registry.redhat.io/openshift4/ose-logging-elasticsearch5@sha256:7ec49695f518ffab41e97fd2eb3c6ce79a4237cf537f6202ee35dbebcbecf444
      resources:
        limits:
          memory: 1Gi
        requests:
          memory: 512Mi
    redundancyPolicy: SingleRedundancy
    nodes:
      - nodeCount: 1
        roles:
          - client
          - data
          - master
`;
//================================================
hpe5gResources.defaults['prometheus-operator']['template']=
//================================================
`
- kind: OperatorGroup
  apiVersion: operators.coreos.com/v1
  metadata:
    name: prometheus-operator-~PROJECT~
    namespace: ~PROJECT~
  spec:
    targetNamespaces:
    - ~PROJECT~
- kind: Subscription
  apiVersion: operators.coreos.com/v1alpha1
  metadata:
    name: prometheus-~PROJECT~
    namespace: ~PROJECT~
  spec:
    channel: beta
    installPlanApproval: Automatic
    name: prometheus
    source: community-operators
    sourceNamespace: openshift-marketplace
- kind: Prometheus
  apiVersion: monitoring.coreos.com/v1
  metadata:
    name: ~NAME~-prometheus
    labels:
      prometheus: k8s
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    serviceAccountName: prometheus-k8s
    securityContext: {}
    serviceMonitorSelector:
      matchExpressions:
      - key: k8s-app
        operator: Exists
    ruleSelector:
      matchLabels:
        role: prometheus-rulefiles
        prometheus: k8s
    alerting:
      alertmanagers:
      - namespace: ~PROJECT~
        name: ~NAME~-alertmanager
        port: web
- kind: ServiceMonitor
  apiVersion: monitoring.coreos.com/v1
  metadata:
    name: ~NAME~-servicemonitor
    labels:
      k8s-app: prometheus
    namespace: ~PROJECT~
  spec:
    namespaceSelector:
      matchNames:
      - ~PROJECT~
    selector:
      matchLabels:
        team: telegraf
    endpoints:
    - interval: 15s
      path: /metrics
      port: prometheus-client
- kind: Alertmanager
  apiVersion: monitoring.coreos.com/v1
  metadata:
    name: ~NAME~-alertmanager
    namespace: ~PROJECT~
  spec:
    replicas: ~REPLICAS~
    securityContext: {}
- kind: PrometheusRule
  apiVersion: monitoring.coreos.com/v1
  metadata:
    labels:
      role: prometheus-rulefiles
      prometheus: k8s
    name: ~NAME~-prometheusrule
    namespace: ~PROJECT~
  spec:
    groups:
    - name: general.rules
      rules:
      - alert: TargetDown-serviceprom
        annotations:
          description: '{{ $value }}% of {{ $labels.job }} targets are down.'
          summary: Targets are down
          expr: 100 * (count(up == 0) BY (job) / count(up) BY (job)) > 10
          for: 10m
          labels:
            severity: warning
        expr: vector(1)
      - alert: DeadMansSwitch-serviceprom
        annotations:
          description: This is a DeadMansSwitch meant to ensure that the entire Alerting pipeline is functional.
          summary: Alerting DeadMansSwitch
        expr: vector(1)
        labels:
          severity: none
`;
//================================================
hpe5gResources.defaults['grafana-operator']['template']=
//================================================
`
- kind: OperatorGroup
  apiVersion: operators.coreos.com/v1
  metadata:
    name: grafana-operator-~PROJECT~
    namespace: ~PROJECT~
  spec:
    targetNamespaces:
    - ~PROJECT~
- kind: Subscription
  apiVersion: operators.coreos.com/v1alpha1
  metadata:
    name: grafana-operator-~PROJECT~
    namespace: ~PROJECT~
  spec:
    channel: alpha
    installPlanApproval: Automatic
    name: grafana-operator
    source: community-operators
    sourceNamespace: openshift-marketplace
- kind: Grafana
  apiVersion: integreatly.org/v1alpha1
  metadata:
    name: ~NAME~-grafana
    namespace: ~PROJECT~
  spec:
    ingress:
      enabled: true
    config:
      auth:
        disable_signout_menu: true
      auth.anonymous:
        enabled: true
      log:
        level: warn
        mode: console
      security:
        admin_password: secret
        admin_user: root
      dashboardLabelSelector:
        - matchExpressions:
          - key: app
            operator: In
            values:
              - grafana
- kind: GrafanaDataSource
  apiVersion: integreatly.org/v1alpha1
  metadata:
    name: ~NAME~-grafanadatasource
    namespace: ~PROJECT~
  spec:
    datasources:
      - access: proxy
        editable: true
        isDefault: true
        jsonData:
          timeInterval: 5s
        name: Prometheus
        type: prometheus
        url: 'http://prometheus-operated.~PROJECT~.svc.cluster.local:9090'
        version: 1
    name: example-datasources.yaml
- kind: GrafanaDashboard
  apiVersion: integreatly.org/v1alpha1
  metadata:
    name: ~NAME~-grafanadashboard
    namespace: ~PROJECT~
  spec:
    json: |
      {
        "id": null,
        "title": "grafana CMS5G core stack Dashboard",
        "tags": [],
        "style": "dark",
        "timezone": "browser",
        "editable": true,
        "hideControls": false,
        "graphTooltip": 1,
        "panels": [],
        "time": {
          "from": "now-6h",
          "to": "now"
        },
        "timepicker": {
          "time_options": [],
          "refresh_intervals": []
        },
        "templating": {
          "list": []
        },
        "annotations": {
          "list": []
        },
        "refresh": "5s",
        "schemaVersion": 17,
        "version": 0,
        "links": []
      }
    name: simple-dashboard.json
`;
//================================================
hpe5gResources.defaults['etcd-operator']['template']=
//================================================
`
- kind: OperatorGroup
  apiVersion: operators.coreos.com/v1
  metadata:
    name: etcd-operator-~PROJECT~
    namespace: ~PROJECT~
  spec:
    targetNamespaces:
    - ~PROJECT~
- kind: Subscription
  apiVersion: operators.coreos.com/v1alpha1
  metadata:
    name: etcd-operator-~PROJECT~
    namespace: ~PROJECT~
  spec:
    channel: singlenamespace-alpha
    installPlanApproval: Automatic
    name: etcd
    source: community-operators
    sourceNamespace: openshift-marketplace
- kind: EtcdCluster
  apiVersion: etcd.database.coreos.com/v1beta2
  metadata:
  metadata:
    name: ~NAME~-etcd
    namespace: ~PROJECT~
  spec:
    size: ~REPLICAS~
    version: 3.2.13
`;
//================================================
hpe5gResources.defaults['local-storage-operator']['template']=
//================================================
`
- kind: OperatorGroup
  apiVersion: operators.coreos.com/v1alpha2
  metadata:
    name: local-operator-group
    namespace: ~PROJECT~
  spec:
    targetNamespaces:
      - ~PROJECT~
- kind: Subscription
  apiVersion: operators.coreos.com/v1alpha1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    installPlanApproval: Automatic
    name: ~NAME~
    source: redhat-operators
    sourceNamespace: openshift-marketplace
- kind: LocalVolumeDiscovery
  apiVersion: local.storage.openshift.io/v1alpha1
  metadata:
    name: auto-discover-devices
    namespace: ~PROJECT~
  spec:
    nodeSelector:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values: ~LOCAL_STORAGE_NODES~
- kind: LocalVolumeSet
  apiVersion: local.storage.openshift.io/v1alpha1
  metadata:
    name: localblock
    namespace: ~PROJECT~
  spec:
    deviceInclusionSpec:
      deviceTypes:
      - disk
      - part
      minSize: 1Gi
    storageClassName: localblock
    volumeMode: Block
    nodeSelector:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values: ~LOCAL_STORAGE_NODES~
`;
//================================================
hpe5gResources.defaults['container-storage-operator']['template']=
//================================================
`
- apiVersion: operators.coreos.com/v1alpha2
  kind: OperatorGroup
  metadata:
    name: openshift-storage
    namespace: openshift-storage
  spec:
    targetNamespaces:
      - ~PROJECT~
- kind: Subscription
  apiVersion: operators.coreos.com/v1alpha1
  metadata:
    name: ocs-operator
    namespace: ~PROJECT~
  spec:
    installPlanApproval: Automatic
    name: ocs-operator
    source: redhat-operators
    sourceNamespace: openshift-marketplace
- kind: StorageCluster
  apiVersion: ocs.openshift.io/v1
  metadata:
    name: ~NAME~
    namespace: ~PROJECT~
  spec:
    encryption: {}
    externalStorage: {}
    manageNodes: false
    managedResources:
      cephBlockPools:
        reconcileStrategy: manage
      cephFilesystems:
        reconcileStrategy: manage
      cephObjectStoreUsers:
        reconcileStrategy: manage
      cephObjectStores:
        reconcileStrategy: manage
      snapshotClasses:
        reconcileStrategy: manage
      storageClasses:
        reconcileStrategy: manage
    multiCloudGateway:
      reconcileStrategy: manage
    monDataDirHostPath: /var/lib/rook
    storageDeviceSets:
    - config: {}
      count: 1
      dataPVCTemplate:
        spec:
          accessModes:
          - ReadWriteOnce
          resources:
            requests:
              storage: "1"
          storageClassName: localblock
          volumeMode: Block
      name: ocs-deviceset-localblock
      replica: ~REPLICAS~
`;
//================================================
hpe5gResources.defaults['operator-source']['template']=
//================================================
`
apiVersion: operators.coreos.com/v1
kind: OperatorSource
metadata:
  name: ~NAME~-operators
  namespace: ~PROJECT~
spec:
  type: appregistry
  endpoint: ~URL~
  registryNamespace: ~NAME~
`;
//================================================
hpe5gResources.defaults['catalog-source']['template']=
//================================================
`
apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  name: ~NAME~
  namespace: ~PROJECT~
spec:
  sourceType: grpc
  image: ~URL~
`;
//================================================
hpe5gResources.defaults['hpe5gcs-operator']['template']=
//================================================
`
- kind: OperatorGroup
  apiVersion: operators.coreos.com/v1
  metadata:
    name: hpe5gcs-operator-~PROJECT~
    namespace: ~PROJECT~
  spec:
    targetNamespaces:
    - ~PROJECT~
- kind: Subscription
  apiVersion: operators.coreos.com/v1alpha1
  metadata:
    name: hpe5gcs-operator
    namespace: ~PROJECT~
  spec:
    channel: alpha
    name: hpe5gcs-operator
    source: hpe5gcs-operator
    sourceNamespace: openshift-marketplace
`;