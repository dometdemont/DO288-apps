//=================================
//Vanilla kubernetes deployer
//=================================
//Return a shell script deploying Vanilla kubernetes clusters on Azure
function buildVanillaDeployer(){
  // Build or get the errors: the OpenShift nodes have a dependeny on the flavors: build them beforehand
  var warnings=Flavors.build()+VanillaNodes.build();
  // If no instances are defined, display warnings and return
  if(!VanillaNodes.instances){
    userOutput(warnings);
    return '';
  }
  return `
  # Check pre-requisites
  VanillaAzureRequirements() {
    which jq > /dev/null && _log_ "jq CLI available" || _fail_ "Missing json parser jq: please install jq 1.5 or later"
    which az > /dev/null && _log_ Azure CLI available az $(az version | jq -r '."azure-cli"') || _fail_ "Missing Azure CLI az: please install az CLI 2.6.0 or later "
    local azureLoggedUser=$(az ad signed-in-user show | jq -r .userPrincipalName)
    test -n "$azureLoggedUser" && _log_ "Logged in Azure as $azureLoggedUser" || _fail_ "Missing logging in Azure; please run: az login"
    which kubectl > /dev/null && _log_ "kubectl CLI available" || _fail_ "Missing kubectl command; please run: sudo az aks install-cli"
  }

  # Deploy a vanilla kubernetes instance on Azure
  deployVanillaAzure() {
    local _name=$1
    local _flavor=$2
    local _nodes=$3
    local _location=$4
    local _sshKey=$5

    # Dedicate a specific resource group to this aks instance: naming rule: aks_<name>
    local grp_name=aks_$_name
    local _az_aks_create="$_preview az aks create --yes --resource-group $grp_name --name $_name --node-count $_nodes --node-vm-size $_flavor --enable-addons monitoring"
    
    # Check for an existing resource group with this name
    az group show --resource-group $grp_name > /dev/null 2>&1 && _fail_ "Azure resource group $grp_name already exists"
    $_preview az group create --name $grp_name --location $_location &>> $logfile && _log_ "Azure resource group $grp_name created" || _fail_ "Cannot create Azure resource group $grp_name"
    _log_ "Creating aks instance $_name in $_location consisting in $_nodes nodes with flavor $_flavor"
    # generate-ssh-keys if no key was provided
    if test -n "$_sshKey" ; then 
      $_az_aks_create --ssh-key-value "$_sshKey" &>> $logfile || _fail_ "Cannot create Azure aks $_name in group $grp_name located in $_location"
    else
      $_az_aks_create --generate-ssh-keys &>> $logfile || _fail_ "Cannot create Azure aks $_name in group $grp_name located in $_location"
    fi
    $_preview az aks get-credentials --overwrite-existing --resource-group $grp_name --name $_name &>> $logfile || _fail_ "Cannot get credentials from aks instance $_name "
    $_preview kubectl get nodes &>> $logfile || _fail_ "Cannot connect to aks instance $_name using kubectl"
    _log_ "aks instance $_name successfully created" 
  }
  
  # Deploy a vanilla kubernetes instance on Azure
  undeployVanillaAzure() {
    local _name=$1
    # Dedicate a specific resource group to this aks instance: naming rule: aks_<name>
    local grp_name=aks_$_name
    _log_  "Deleting aks instance $_name"
    $_preview az aks delete --yes --name $_name --resource-group $grp_name &>> $logfile || _fail_ "Cannot delete aks instance $_name"
    _log_ "Deleting Azure resource group $grp_name"
    $_preview az group delete --name $grp_name --yes &>> $logfile || _fail_ "Cannot delete Azure resource group $grp_name"
  }

# For all instance names, deploy or undeploy
i=0 && while (( i <  $\{#VANILLA[@]} )) ; do 
  case $\{VANILLACLOUD[i]} in
  azure)
    VanillaAzureRequirements
    $_deploy && deployVanillaAzure $\{VANILLA[i]:-$VANILLA} $\{VANILLAFLAVOR[i]:-$VANILLAFLAVOR} $\{VANILLANODES[i]:-$VANILLANODES} $\{VANILLALOCATION[i]:-$VANILLALOCATION} "$\{VANILLASSHKEY[i]:-$VANILLASSHKEY}" || undeployVanillaAzure $\{VANILLA[i]:-$VANILLA}   
    ;;
  *) _fail_ Unsupported cloud type $\{VANILLACLOUD[i]}: expecting azure ;;
  esac  
  ((i+=1))
done


`;
}