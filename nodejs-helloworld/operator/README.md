# Operator build example
# Prerequisites
Reference: https://sdk.operatorframework.io/docs/building-operators/golang/installation/
# Golang
```
wget https://golang.org/dl/go1.15.5.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.15.5.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
go version
rm go1.15.5.linux-amd64.tar.gz
```
# SDK and related tools
```
sudo yum -y install podman make gcc
curl -LO //github.com/operator-framework/operator-sdk/releases/latest/download/operator-sdk_linux_amd64
chmod +x operator-sdk_linux_amd64 && sudo mv operator-sdk_linux_amd64 /usr/local/bin/operator-sdk
operator-sdk version
wget https://mirror.openshift.com/pub/openshift-v4/x86_64/clients/ocp/latest-4.6/opm-linux.tar.gz
tar xzvf opm-linux.tar.gz
sudo mv ./opm /usr/local/bin/
opm version
```
## Name and version
```
OPERATOR_NAME=hpe5gcs-operator
OPERATOR_VERSION=0.2.0
APPLICATION_NAME=HPE5gcsApp
IMAGE_NAME=hpe5gcs
DOMAIN_NAME=cms.hpe.com
USERNAME=dometdemont
OPERATOR_IMG="quay.io/$USERNAME/$OPERATOR_NAME:v$OPERATOR_VERSION"
OPERATOR_BUNDLE_IMG="quay.io/$USERNAME/$OPERATOR_NAME-bundle:v$OPERATOR_VERSION"
OPERATOR_BUNDLE_INDEX="quay.io/$USERNAME/$OPERATOR_NAME-index:v$OPERATOR_VERSION"
podman login quay.io
```
## Project creation
```
mkdir -p $HOME/projects/$OPERATOR_NAME
cd $HOME/projects/$OPERATOR_NAME
PATH=$PATH:/usr/local/go/bin
operator-sdk init --domain=$DOMAIN_NAME --repo=github.com/$USERNAME/$OPERATOR_NAME
operator-sdk create api --version=v1alpha1 --kind=$APPLICATION_NAME --resource --controller
```
## Type and controller code
- update api/v1alpha1/hpe5gcsapp_types.go with spec and status
- update controllers/hpe5gcsapp_controller.go with reconciler code

## Build controller
```
make generate
make manifests
sed -i 's/docker/podman/g' Makefile
make podman-build podman-push IMG=$OPERATOR_IMG
podman image prune -f
make bundle  IMG=$OPERATOR_IMG
```
## Update csv.yaml and replace the version
```
sed -i "s/_OPERATOR_VERSION/$OPERATOR_VERSION/g" bundle/manifests/hpe5gcs-operator.clusterserviceversion.yaml
```
## Build bundle and index
```
make bundle-build BUNDLE_IMG=$OPERATOR_BUNDLE_IMG
make podman-push IMG=$OPERATOR_BUNDLE_IMG
opm index add --bundles $OPERATOR_BUNDLE_IMG --tag $OPERATOR_BUNDLE_INDEX
podman push $OPERATOR_BUNDLE_INDEX
```
## Catalog Source
```
cat <<EOF | oc create -f -
apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  name: $OPERATOR_NAME
  namespace: openshift-marketplace
spec:
  sourceType: grpc
  image: $OPERATOR_BUNDLE_INDEX
EOF
```
