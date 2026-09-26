terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "= 5.3.0" }
  }
}

resource "terraform_data" "unknown_id" {

}
# One declaration per azurerm rule whose resource_group_name reference yields an ownership context.

resource "azurerm_resource_group" "platform" {
  name     = "platform"
  location = "West Europe"
}

# ai-ml
resource "azurerm_ai_foundry" "owned" {
  identity {
    type = "UserAssigned"
  }
  location            = "westeurope"
  storage_account_id  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Storage/storageAccounts/fx-owned-storage-account-id"
  key_vault_id        = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.KeyVault/vaults/fx-owned-key-vault-id"
  name                = "ai-foundry"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_bot_channels_registration" "owned" {
  microsoft_app_type  = "MultiTenant"
  microsoft_app_id    = "00000000-0000-0000-0000-000000000004"
  sku                 = "F0"
  location            = "westeurope"
  name                = "bot-channels-registration"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_bot_service_azure_bot" "owned" {
  location            = "westeurope"
  microsoft_app_type  = "MultiTenant"
  microsoft_app_id    = "00000000-0000-0000-0000-000000000008"
  sku                 = "F0"
  name                = "bot-service-azure-bot"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_bot_web_app" "owned" {
  microsoft_app_id    = "00000000-0000-0000-0000-000000000009"
  microsoft_app_type  = "MultiTenant"
  sku                 = "F0"
  location            = "westeurope"
  name                = "bot-web-app"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_cognitive_account" "owned" {
  kind                = "AIServices"
  sku_name            = "C2"
  location            = "westeurope"
  name                = "cognitive-account"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_healthbot" "owned" {
  location            = "westeurope"
  sku_name            = "C1"
  name                = "healthbot"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_machine_learning_workspace" "owned" {
  identity {
    type = "UserAssigned"
  }
  location                = "westeurope"
  application_insights_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Insights/components/fx-owned-application-insights-id"
  key_vault_id            = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.KeyVault/vaults/fx-owned-key-vault-id"
  storage_account_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Storage/storageAccounts/fx-owned-storage-account-id"
  name                    = "machine-learning-workspace"
  resource_group_name     = azurerm_resource_group.platform.name
}
resource "azurerm_search_service" "owned" {
  location            = "westeurope"
  sku                 = "free"
  name                = "search-service"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_video_indexer_account" "owned" {
  storage {
    storage_account_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Storage/storageAccounts/fx-owned-storage-account-id"
  }
  identity {
    type = "UserAssigned"
  }
  location            = "westeurope"
  name                = "video-indexer-account"
  resource_group_name = azurerm_resource_group.platform.name
}

# api-integration
resource "azurerm_api_management" "owned" {
  publisher_email     = "fx-owned-publisher-email@example.com"
  publisher_name      = "fx-owned-publisher-name"
  sku_name            = "Developer_1"
  location            = "westeurope"
  name                = "api-management"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_api_management_standalone_gateway" "owned" {
  sku {
    name = "WorkspaceGatewayPremium"
  }
  location            = "westeurope"
  name                = "api-management-standalone-gateway"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_app_configuration" "owned" {
  location            = "westeurope"
  name                = "app-configuration"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_logic_app_integration_account" "owned" {
  location            = "westeurope"
  sku_name            = "Basic"
  name                = "logic-app-integration-account"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_logic_app_standard" "owned" {
  storage_account_access_key = "Zml4dHVyZQ=="
  storage_account_name = "rootformlogic"
  app_service_plan_id  = azurerm_service_plan.owned_logic.id
  location             = "westeurope"
  name                 = "logic-app-standard"
  resource_group_name  = azurerm_resource_group.platform.name
}
resource "azurerm_logic_app_workflow" "owned" {
  location            = "westeurope"
  name                = "logic-app-workflow"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_maps_account" "owned" {
  sku_name            = "S0"
  location            = "westeurope"
  name                = "maps-account"
  resource_group_name = azurerm_resource_group.platform.name
}

# communication
resource "azurerm_communication_service" "owned" {
  data_location       = "Africa"
  name                = "communication-service"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_email_communication_service" "owned" {
  data_location       = "Africa"
  name                = "email-communication-service"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_fluid_relay_server" "owned" {
  location            = "westeurope"
  name                = "fluid-relay-server"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_signalr_service" "owned" {
  sku {
    name     = "Free_F1"
    capacity = 1
  }
  location            = "westeurope"
  name                = "signalr-service"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_web_pubsub" "owned" {
  location            = "westeurope"
  sku                 = "Premium_P1"
  name                = "web-pubsub"
  resource_group_name = azurerm_resource_group.platform.name
}

# compute
resource "azurerm_batch_account" "owned" {
  location            = "westeurope"
  name                = "rootformbatch"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_dedicated_host_group" "owned" {
  platform_fault_domain_count = 1
  location                    = "westeurope"
  name                        = "dedicated-host-group"
  resource_group_name         = azurerm_resource_group.platform.name
}
resource "azurerm_dev_test_linux_virtual_machine" "owned" {
  gallery_image_reference {
    version   = "fx-owned-version"
    sku       = "fx-owned-sku"
    publisher = "fx-owned-publisher"
    offer     = "fx-owned-offer"
  }
  lab_virtual_network_id = "fx-owned-lab-virtual-network-id"
  size                   = "fx-owned-size"
  lab_name               = "fx-owned-lab-name"
  location               = "westeurope"
  username               = "fx-owned-username"
  lab_subnet_name        = "fx-owned-lab-subnet-name"
  storage_type           = "Standard"
  name                   = "dev-test-linux-virtual-machine"
  resource_group_name    = azurerm_resource_group.platform.name
}
resource "azurerm_dev_test_windows_virtual_machine" "owned" {
  gallery_image_reference {
    sku       = "fx-owned-sku"
    publisher = "fx-owned-publisher"
    offer     = "fx-owned-offer"
    version   = "fx-owned-version"
  }
  username               = "fx-owned-username"
  lab_virtual_network_id = "fx-owned-lab-virtual-network-id"
  lab_subnet_name        = "fx-owned-lab-subnet-name"
  storage_type           = "Standard"
  size                   = "fx-owned-size"
  location               = "westeurope"
  password               = "fx-owned-password"
  lab_name               = "fx-owned-lab-name"
  name                   = "dev-test-window"
  resource_group_name    = azurerm_resource_group.platform.name
}
resource "azurerm_image" "owned" {
  location            = "westeurope"
  name                = "image"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_managed_disk" "owned" {
  location             = "westeurope"
  storage_account_type = "Premium_LRS"
  create_option        = "Copy"
  name                 = "managed-disk"
  resource_group_name  = azurerm_resource_group.platform.name
}
resource "azurerm_shared_image" "owned" {
  identifier {
    sku       = "fx-owned-sku"
    publisher = "fx-owned-publisher"
    offer     = "fx-owned-offer"
  }
  location            = "westeurope"
  gallery_name        = azurerm_shared_image_gallery.owned.name
  os_type             = "Linux"
  name                = "shared-image"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_snapshot" "owned" {
  create_option       = "Copy"
  location            = "westeurope"
  name                = "snapshot"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_stack_hci_virtual_hard_disk" "owned" {
  location            = "westeurope"
  custom_location_id  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.ExtendedLocation/customLocations/fx-owned-custom-location-id"
  disk_size_in_gb     = 1
  name                = "stack-hci-virtual-hard-disk"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_virtual_desktop_application_group" "owned" {
  host_pool_id        = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.DesktopVirtualization/hostPools/fx-owned-host-pool-id"
  location            = "westeurope"
  type                = "Desktop"
  name                = "virtual-desktop-application-group"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_virtual_desktop_host_pool" "owned" {
  load_balancer_type  = "BreadthFirst"
  type                = "Personal"
  location            = "westeurope"
  name                = "virtual-desktop-host-pool"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_virtual_desktop_workspace" "owned" {
  location            = "westeurope"
  name                = "virtual-desktop-workspace"
  resource_group_name = azurerm_resource_group.platform.name
}

# containers
resource "azurerm_arc_kubernetes_cluster" "owned" {
  identity {
    type = "SystemAssigned"
  }
  location                     = "westeurope"
  agent_public_key_certificate = "cm9vdGZvcm0="
  name                         = "arc-kubernetes-cluster"
  resource_group_name          = azurerm_resource_group.platform.name
}
resource "azurerm_arc_kubernetes_provisioned_cluster" "owned" {
  identity {
    type = "SystemAssigned"
  }
  location            = "westeurope"
  name                = "arc-kubernetes-provisioned-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_container_group" "owned" {
  container {
    image  = "fx-owned-image"
    cpu    = 1
    name   = "fx-owned-name"
    memory = 1
  }
  location            = "westeurope"
  os_type             = "Windows"
  name                = "container-group"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_container_registry" "owned" {
  sku                 = "Basic"
  location            = "westeurope"
  name                = "rootformregistry"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_kubernetes_automatic_cluster" "owned" {
  identity {
    type = "SystemAssigned"
  }
  location            = "westeurope"
  name                = "kubernetes-automatic-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_kubernetes_fleet_manager" "owned" {
  location            = "westeurope"
  name                = "kubernetes-fleet-manager"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_redhat_openshift_cluster" "owned" {
  service_principal {
    client_id     = "00000000-0000-0000-0000-000000000011"
    client_secret = "rootform-fixture"
  }
  ingress_profile {
    visibility = "Private"
  }
  cluster_profile {
    version = "4.15.27"
    domain  = "rootform"
  }
  api_server_profile {
    visibility = "Private"
  }
  worker_profile {
    disk_size_gb = 128
    vm_size      = "Standard_D4s_v3"
    subnet_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
    node_count   = 3
  }
  network_profile {
    service_cidr = "10.0.0.0/24"
    pod_cidr     = "10.0.0.0/24"
  }
  main_profile {
    vm_size   = "Standard_D8s_v3"
    subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  }
  location            = "westeurope"
  name                = "redhat-openshift-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_service_fabric_cluster" "owned" {
  node_type {
    instance_count       = 1
    is_primary           = false
    http_endpoint_port   = 1
    name                 = "fx-owned-name"
    client_endpoint_port = 1
  }
  vm_image            = "fx-owned-vm-image"
  reliability_level   = "None"
  upgrade_mode        = "Automatic"
  management_endpoint = "fx-owned-management-endpoint"
  location            = "westeurope"
  name                = "service-fabric-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_service_fabric_managed_cluster" "owned" {
  lb_rule {
    probe_request_path = "/"
    probe_protocol = "http"
    frontend_port  = 1
    backend_port   = 1
    protocol       = "tcp"
  }
  client_connection_port = 19000
  location               = "westeurope"
  http_gateway_port      = 19080
  name                   = "service-fabric-managed"
  resource_group_name    = azurerm_resource_group.platform.name
}

# data-analytics
resource "azurerm_analysis_services_server" "owned" {
  location            = "westeurope"
  sku                 = "D1"
  name                = "rootformanalysis"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_data_factory" "owned" {
  location            = "westeurope"
  name                = "data-factory"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_data_share_account" "owned" {
  identity {
    type = "SystemAssigned"
  }
  location            = "westeurope"
  name                = "data-share-account"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_databricks_workspace" "owned" {
  sku                 = "standard"
  location            = "westeurope"
  name                = "databricks-workspace"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_fabric_capacity" "owned" {
  sku {
    tier = "Fabric"
    name = "F2"
  }
  location            = "westeurope"
  name                = "rootformfabric"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_graph_services_account" "owned" {
  application_id      = "00000000-0000-0000-0000-000000000002"
  name                = "graph-services-account"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_hdinsight_hadoop_cluster" "owned" {
  gateway {
    username = "fx-owned-username"
    password = "fx-owned-password"
  }
  component_version {
    hadoop = "3.3"
  }
  roles {
    worker_node {
      target_instance_count = 1
      vm_size               = "ExtraSmall"
      username              = "fx-owned-username"
    }
    head_node {
      vm_size  = "ExtraSmall"
      username = "fx-owned-username"
    }
    zookeeper_node {
      vm_size  = "ExtraSmall"
      username = "fx-owned-username"
    }
  }
  tls_min_version     = "1.0"
  location            = "westeurope"
  tier                = "Standard"
  cluster_version     = "5.1"
  name                = "hdinsight-hadoop-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_hdinsight_hbase_cluster" "owned" {
  component_version {
    hbase = "2.4"
  }
  roles {
    zookeeper_node {
      vm_size  = "ExtraSmall"
      username = "fx-owned-username"
    }
    worker_node {
      vm_size               = "ExtraSmall"
      target_instance_count = 1
      username              = "fx-owned-username"
    }
    head_node {
      username = "fx-owned-username"
      vm_size  = "ExtraSmall"
    }
  }
  gateway {
    username = "fx-owned-username"
    password = "fx-owned-password"
  }
  location            = "westeurope"
  tls_min_version     = "1.0"
  cluster_version     = "5.1"
  tier                = "Standard"
  name                = "hdinsight-hbase-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_hdinsight_interactive_query_cluster" "owned" {
  gateway {
    username = "fx-owned-username"
    password = "fx-owned-password"
  }
  component_version {
    interactive_hive = "3.1"
  }
  roles {
    head_node {
      vm_size  = "ExtraSmall"
      username = "fx-owned-username"
    }
    zookeeper_node {
      vm_size  = "ExtraSmall"
      username = "fx-owned-username"
    }
    worker_node {
      vm_size               = "ExtraSmall"
      username              = "fx-owned-username"
      target_instance_count = 1
    }
  }
  tls_min_version     = "1.0"
  location            = "westeurope"
  cluster_version     = "5.1"
  tier                = "Standard"
  name                = "hdinsight-interactive-query-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_hdinsight_kafka_cluster" "owned" {
  roles {
    head_node {
      vm_size  = "ExtraSmall"
      username = "fx-owned-username"
    }
    zookeeper_node {
      username = "fx-owned-username"
      vm_size  = "ExtraSmall"
    }
    worker_node {
      username                 = "fx-owned-username"
      vm_size                  = "ExtraSmall"
      target_instance_count    = 1
      number_of_disks_per_node = 1
    }
  }
  component_version {
    kafka = "3.2"
  }
  gateway {
    username = "fx-owned-username"
    password = "fx-owned-password"
  }
  tls_min_version     = "1.0"
  tier                = "Standard"
  location            = "westeurope"
  cluster_version     = "5.1"
  name                = "hdinsight-kafka-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_hdinsight_spark_cluster" "owned" {
  component_version {
    spark = "3.3"
  }
  gateway {
    password = "fx-owned-password"
    username = "fx-owned-username"
  }
  roles {
    zookeeper_node {
      vm_size  = "ExtraSmall"
      username = "fx-owned-username"
    }
    worker_node {
      vm_size               = "ExtraSmall"
      target_instance_count = 1
      username              = "fx-owned-username"
    }
    head_node {
      vm_size  = "ExtraSmall"
      username = "fx-owned-username"
    }
  }
  tier                = "Standard"
  location            = "westeurope"
  tls_min_version     = "1.0"
  cluster_version     = "5.1"
  name                = "hdinsight-spark-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_healthcare_fhir_service" "owned" {
  authentication {
    authority = "fx-owned-authority"
    audience  = "fx-owned-audience"
  }
  workspace_id        = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.HealthcareApis/workspaces/fx-owned-workspace-id"
  location            = "westeurope"
  name                = "healthcare-fhir-service"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_healthcare_service" "owned" {
  location            = "westeurope"
  name                = "healthcare-service"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_healthcare_workspace" "owned" {
  location            = "westeurope"
  name                = "rootformhealth"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_powerbi_embedded" "owned" {
  location            = "westeurope"
  administrators      = ["admin@example.com"]
  sku_name            = "A1"
  name                = "rootformpowerbi"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_purview_account" "owned" {
  identity {
    type = "SystemAssigned"
  }
  location            = "westeurope"
  name                = "purview-account"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_stream_analytics_cluster" "owned" {
  streaming_capacity  = 36
  location            = "westeurope"
  name                = "stream-analytics-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_stream_analytics_job" "owned" {
  location             = "westeurope"
  transformation_query = "fx-owned-transformation-query"
  name                 = "stream-analytics-job"
  resource_group_name  = azurerm_resource_group.platform.name
}
resource "azurerm_synapse_workspace" "owned" {
  storage_data_lake_gen2_filesystem_id = "fx-owned-storage-data-lake-gen2-filesystem-id"
  location                             = "westeurope"
  name                                 = "synapse-workspace"
  resource_group_name                  = azurerm_resource_group.platform.name
}

# databases
resource "azurerm_cosmosdb_account" "owned" {
  geo_location {
    failover_priority = 1
    location          = "westeurope"
  }
  consistency_policy {
    consistency_level = "BoundedStaleness"
  }
  offer_type          = "Standard"
  location            = "westeurope"
  name                = "cosmosdb-account"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_cosmosdb_cassandra_cluster" "owned" {
  default_admin_password         = "fx-owned-default-admin-password"
  location                       = "westeurope"
  delegated_management_subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-virtualnetworks/subnets/fx-owned-delegated-management-subnet-id"
  name                           = "cosmosdb-cassandra-cluster"
  resource_group_name            = azurerm_resource_group.platform.name
}
resource "azurerm_cosmosdb_postgresql_cluster" "owned" {
  node_count          = 0
  location            = "westeurope"
  name                = "cosmosdb-postgresql-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_kusto_cluster" "owned" {
  sku {
    name = "Dev(No SLA)_Standard_D11_v2"
  }
  location            = "westeurope"
  name                = "kusto-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_managed_redis" "owned" {
  default_database {
  }
  location            = "westeurope"
  sku_name            = "Balanced_B0"
  name                = "managed-redis"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_mongo_cluster" "owned" {
  version = "7.0"
  storage_size_in_gb = 32
  shard_count = 1
  high_availability_mode = "Disabled"
  compute_tier = "M30"
  administrator_password = "Rootform-Fixture-1"
  administrator_username = "rootformadmin"
  location            = "westeurope"
  name                = "mongo-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_mssql_managed_instance" "owned" {
  administrator_login          = "rootformadmin"
  administrator_login_password = "Rootform-Fixture-1"
  sku_name                     = "BC_Gen4"
  license_type                 = "LicenseIncluded"
  location                     = "westeurope"
  vcores                       = "4"
  storage_size_in_gb           = 32
  subnet_id                    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  name                         = "mssql-managed-instance"
  resource_group_name          = azurerm_resource_group.platform.name
}
resource "azurerm_mysql_flexible_database" "owned" {
  server_name         = "fx-owned-server-name"
  collation           = "fx-owned-collation"
  charset             = "fx-owned-charset"
  name                = "mysql-flexible-database"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_mysql_flexible_server" "owned" {
  location            = "westeurope"
  name                = "mysql-flexible-server"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_oracle_autonomous_database" "owned" {
  character_set                    = "AL32UTF8"
  national_character_set           = "AL16UTF16"
  backup_retention_period_in_days  = 1
  display_name                     = "rootformautonomous"
  location                         = "westeurope"
  compute_count                    = 2
  compute_model                    = "ECPU"
  admin_password                   = "RootformFixture1x"
  data_storage_size_in_tbs         = 1
  auto_scaling_enabled             = false
  mtls_connection_required         = false
  license_model                    = "LicenseIncluded"
  db_workload                      = "AJD"
  auto_scaling_for_storage_enabled = false
  db_version                       = "19c"
  name                             = "rootformautonomous"
  resource_group_name              = azurerm_resource_group.platform.name
}
resource "azurerm_redis_cache" "owned" {
  sku_name            = "Basic"
  family              = "C"
  location            = "westeurope"
  capacity            = 1
  name                = "redis-cache"
  resource_group_name = azurerm_resource_group.platform.name
}

# developer-ci-cd
resource "azurerm_dev_center" "owned" {
  location            = "westeurope"
  name                = "dev-center"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_dev_center_project" "owned" {
  location            = "westeurope"
  dev_center_id       = "fx-owned-dev-center-id"
  name                = "dev-center-project"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_dev_test_lab" "owned" {
  location            = "westeurope"
  name                = "dev-test-lab"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_managed_devops_pool" "owned" {
  stateful_agent {
  }
  azure_devops_organization {
    organization {
      url         = "https://dev.azure.com/rootform"
      parallelism = 1
    }
  }
  virtual_machine_scale_set_fabric {
    image {
      well_known_image_name = "ubuntu-22.04"
    }
    sku_name = "Standard_D2ads_v5"
  }
  maximum_concurrency   = 1
  location              = "westeurope"
  dev_center_project_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.DevCenter/projects/fx-owned-dev-center-project-id"
  name                  = "managed-devops-pool"
  resource_group_name   = azurerm_resource_group.platform.name
}
resource "azurerm_playwright_workspace" "owned" {
  location            = "westeurope"
  name                = "playwright-workspace"
  resource_group_name = azurerm_resource_group.platform.name
}

# dns-cdn
resource "azurerm_dns_zone" "owned" {
  name                = "dns-zone"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_private_dns_resolver" "owned" {
  location            = "westeurope"
  virtual_network_id  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-owned-virtual-network-id"
  name                = "private-dns-resolver"
  resource_group_name = azurerm_resource_group.platform.name
}

# governance-management
resource "azurerm_managed_application" "owned" {
  location                    = "westeurope"
  kind                        = "MarketPlace"
  managed_resource_group_name = "fx-owned-managed-resource-group-name"
  name                        = "managed-application"
  resource_group_name         = azurerm_resource_group.platform.name
}

# hybrid
resource "azurerm_arc_machine" "owned" {
  location            = "westeurope"
  kind                = "AVS"
  name                = "arc-machine"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_arc_resource_bridge_appliance" "owned" {
  identity {
    type = "SystemAssigned"
  }
  infrastructure_provider = "HCI"
  distro                  = "AKSEdge"
  location                = "westeurope"
  name                    = "arc-resource-bridge-appliance"
  resource_group_name     = azurerm_resource_group.platform.name
}
resource "azurerm_extended_location_custom_location" "owned" {
  cluster_extension_ids = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/platform/providers/Microsoft.Kubernetes/connectedClusters/arc/providers/Microsoft.KubernetesConfiguration/extensions/custom"]
  namespace             = "custom-location"
  host_resource_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/platform/providers/Microsoft.Kubernetes/connectedClusters/arc"
  location              = "westeurope"
  name                  = "extended-location-custom-location"
  resource_group_name   = azurerm_resource_group.platform.name
}
resource "azurerm_nginx_deployment" "owned" {
  sku                 = "fx-owned-sku"
  location            = "westeurope"
  name                = "nginx-deployment"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_oracle_cloud_vm_cluster" "owned" {
  location                        = "westeurope"
  cpu_core_count                  = 2
  db_servers                      = ["fx-owned-db-servers"]
  gi_version                      = "fx-owned-gi-version"
  virtual_network_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-owned-virtual-network-id"
  cloud_exadata_infrastructure_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Oracle.Database/cloudExadataInfrastructures/fx-owned-cloud-exadata-infrastructure-id"
  license_model                   = "LicenseIncluded"
  hostname                        = "fx-owned-hostname"
  subnet_id                       = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  ssh_public_keys                 = ["fx-owned-ssh-public-keys"]
  display_name                    = "fx-owned-display-name"
  name                            = "oracle-cloud-vm-cluster"
  resource_group_name             = azurerm_resource_group.platform.name
}
resource "azurerm_oracle_exadata_infrastructure" "owned" {
  location            = "westeurope"
  storage_count       = 3
  display_name        = "rootformexadata"
  shape               = "Exadata.X9M"
  compute_count       = 2
  name                = "oracle-exadata-infrastructure"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_oracle_resource_anchor" "owned" {
  name                = "oracle-resource-anchor"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_palo_alto_next_generation_firewall_virtual_network_local_rulestack" "owned" {
  network_profile {
    vnet_configuration {
      virtual_network_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-owned-virtual-network-id"
    }
    public_ip_address_ids = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/publicIPAddresses/fx-owned-public-ip-address-ids"]
  }
  rulestack_id        = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/PaloAltoNetworks.Cloudngfw/localRulestacks/fx-owned-rulestack-id"
  name                = "palo-alto-next-generation-firewall-virtu"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_stack_hci_cluster" "owned" {
  location            = "westeurope"
  name                = "stack-hci-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_system_center_virtual_machine_manager_server" "owned" {
  location            = "westeurope"
  custom_location_id  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.ExtendedLocation/customLocations/fx-owned-custom-location-id"
  fqdn                = "fx-owned-fqdn"
  username            = "fx-owned-username"
  password            = "fx-owned-password"
  name                = "system-center-virtual-machine-manager-se"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_vmware_private_cloud" "owned" {
  management_cluster {
    size = 3
  }
  network_subnet_cidr = "10.0.0.0/24"
  location            = "westeurope"
  sku_name            = "av20"
  name                = "vmware-private-cloud"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_workloads_sap_discovery_virtual_instance" "owned" {
  environment                       = "NonProd"
  central_server_virtual_machine_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Compute/virtualMachines/fx-owned-central-server-virtual-machine-id"
  sap_product                       = "ECC"
  location                          = "westeurope"
  name                              = "RF2"
  resource_group_name               = azurerm_resource_group.platform.name
}
resource "azurerm_workloads_sap_single_node_virtual_instance" "owned" {
  single_server_configuration {
    virtual_machine_configuration {
      os_profile {
        ssh_public_key  = "fx-owned-ssh-public-key"
        ssh_private_key = "fx-owned-ssh-private-key"
        admin_username  = "fx-owned-admin-username"
      }
      image {
        offer     = "fx-owned-offer"
        version   = "fx-owned-version"
        sku       = "fx-owned-sku"
        publisher = "RedHat"
      }
      virtual_machine_size = "fx-owned-virtual-machine-size"
    }
    app_resource_group_name = "sap-app-single"
    subnet_id               = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  }
  sap_fqdn            = "sap.rootform.example.com"
  location            = "westeurope"
  environment         = "NonProd"
  app_location        = "westeurope"
  sap_product         = "ECC"
  name                = "RF1"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_workloads_sap_three_tier_virtual_instance" "owned" {
  three_tier_configuration {
    application_server_configuration {
      virtual_machine_configuration {
        image {
          publisher = "RedHat"
          offer     = "fx-owned-offer"
          version   = "fx-owned-version"
          sku       = "fx-owned-sku"
        }
        os_profile {
          ssh_public_key  = "fx-owned-ssh-public-key"
          ssh_private_key = "fx-owned-ssh-private-key"
          admin_username  = "fx-owned-admin-username"
        }
        virtual_machine_size = "fx-owned-virtual-machine-size"
      }
      subnet_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
      instance_count = 1
    }
    database_server_configuration {
      virtual_machine_configuration {
        os_profile {
          ssh_private_key = "fx-owned-ssh-private-key"
          admin_username  = "fx-owned-admin-username"
          ssh_public_key  = "fx-owned-ssh-public-key"
        }
        image {
          version   = "fx-owned-version"
          sku       = "fx-owned-sku"
          publisher = "RedHat"
          offer     = "fx-owned-offer"
        }
        virtual_machine_size = "fx-owned-virtual-machine-size"
      }
      subnet_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
      instance_count = 1
    }
    central_server_configuration {
      virtual_machine_configuration {
        image {
          offer     = "fx-owned-offer"
          version   = "fx-owned-version"
          sku       = "fx-owned-sku"
          publisher = "RedHat"
        }
        os_profile {
          ssh_public_key  = "fx-owned-ssh-public-key"
          ssh_private_key = "fx-owned-ssh-private-key"
          admin_username  = "fx-owned-admin-username"
        }
        virtual_machine_size = "fx-owned-virtual-machine-size"
      }
      subnet_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
      instance_count = 1
    }
    app_resource_group_name = "sap-app-three-tier"
  }
  location            = "westeurope"
  environment         = "NonProd"
  sap_product         = "ECC"
  app_location        = "westeurope"
  sap_fqdn            = "sap.rootform.example.com"
  name                = "RF3"
  resource_group_name = azurerm_resource_group.platform.name
}

# identity-iam
resource "azurerm_aadb2c_directory" "owned" {
  data_residency_location = "Asia Pacific"
  sku_name                = "PremiumP1"
  domain_name             = "fx-owned-domain-name"
  resource_group_name     = azurerm_resource_group.platform.name
}
resource "azurerm_active_directory_domain_service" "owned" {
  initial_replica_set {
    subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  }
  sku                 = "Standard"
  location            = "westeurope"
  domain_name         = "rootform.example.com"
  name                = "active-directory-domain-service"
  resource_group_name = azurerm_resource_group.platform.name
}

# iot
resource "azurerm_digital_twins_instance" "owned" {
  location            = "westeurope"
  name                = "digital-twins-instance"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_iotcentral_application" "owned" {
  location            = "westeurope"
  sub_domain          = "fx-owned-sub-domain"
  name                = "iotcentral-application"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_iothub" "owned" {
  sku {
    capacity = 1
    name     = "B1"
  }
  location            = "westeurope"
  name                = "iothub"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_iothub_device_update_account" "owned" {
  location            = "westeurope"
  name                = "iothub-device-update-acc"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_iothub_dps" "owned" {
  sku {
    name     = "S1"
    capacity = 1
  }
  location            = "westeurope"
  name                = "iothub-dps"
  resource_group_name = azurerm_resource_group.platform.name
}

# load-balancing
resource "azurerm_application_load_balancer" "owned" {
  location            = "westeurope"
  name                = "application-load-balancer"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_cdn_frontdoor_profile" "owned" {
  sku_name            = "Premium_AzureFrontDoor"
  name                = "cdn-frontdoor-profile"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_traffic_manager_profile" "owned" {
  monitor_config {
    protocol = "HTTP"
    port     = 1
  }
  dns_config {
    ttl           = 1
    relative_name = "fx-owned-relative-name"
  }
  traffic_routing_method = "Geographic"
  name                   = "traffic-manager-profile"
  resource_group_name    = azurerm_resource_group.platform.name
}

# messaging-eventing
resource "azurerm_eventgrid_domain" "owned" {
  location            = "westeurope"
  name                = "eventgrid-domain"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_eventgrid_namespace" "owned" {
  location            = "westeurope"
  name                = "eventgrid-namespace"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_eventgrid_partner_namespace" "owned" {
  partner_registration_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.EventGrid/partnerRegistrations/fx-owned-partner-registration-id"
  location                = "westeurope"
  name                    = "eventgrid-partner-namespace"
  resource_group_name     = azurerm_resource_group.platform.name
}
resource "azurerm_eventgrid_system_topic" "owned" {
  location            = "westeurope"
  topic_type          = "Microsoft.Resources.ResourceGroups"
  source_resource_id  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/platform"
  name                = "eventgrid-system-topic"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_eventgrid_system_topic_event_subscription" "owned" {
  system_topic        = azurerm_eventgrid_system_topic.owned.name
  name                = "eventgrid-system-topic-event-subscriptio"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_eventgrid_topic" "owned" {
  location            = "westeurope"
  name                = "eventgrid-topic"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_eventhub_cluster" "owned" {
  location            = "westeurope"
  sku_name            = "Dedicated_1"
  name                = "eventhub-cluster"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_eventhub_namespace" "owned" {
  location            = "westeurope"
  sku                 = "Basic"
  name                = "eventhub-namespace"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_notification_hub" "owned" {
  namespace_name      = "fx-owned-namespace-name"
  location            = "westeurope"
  name                = "notification-hub"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_notification_hub_namespace" "owned" {
  location            = "westeurope"
  sku_name            = "Basic"
  namespace_type      = "Messaging"
  name                = "notification-hub-namespace"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_relay_hybrid_connection" "owned" {
  relay_namespace_name = "fx-owned-relay-namespace-name"
  name                 = "relay-hybrid-connection"
  resource_group_name  = azurerm_resource_group.platform.name
}
resource "azurerm_relay_namespace" "owned" {
  sku_name            = "Standard"
  location            = "westeurope"
  name                = "relay-namespace"
  resource_group_name = azurerm_resource_group.platform.name
}

# migration
resource "azurerm_backup_policy_file_share" "owned" {
  backup {
    hourly {
      window_duration = 4
      start_time      = "08:00"
      interval        = "4"
    }
    frequency = "Daily"
  }
  retention_daily {
    count = 1
  }
  recovery_vault_name = azurerm_recovery_services_vault.owned.name
  name                = "backup-policy-file-share"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_backup_policy_vm" "owned" {
  retention_daily {
    count = 7
  }
  backup {
    frequency = "Daily"
    time      = "23:00"
  }
  recovery_vault_name = azurerm_recovery_services_vault.owned.name
  name                = "backup-policy-vm"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_database_migration_project" "owned" {
  location            = "westeurope"
  target_platform     = "AzureDbForMySql"
  source_platform     = "MongoDb"
  service_name        = "fx-owned-service-name"
  name                = "database-migration-project"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_database_migration_service" "owned" {
  location            = "westeurope"
  subnet_id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  sku_name            = "Premium_4vCores"
  name                = "database-migration-service"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_databox_edge_device" "owned" {
  location            = "westeurope"
  sku_name            = "Edge-Standard"
  name                = "databox-edge-device"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_recovery_services_vault" "owned" {
  sku                 = "RS0"
  location            = "westeurope"
  name                = "recovery-services-vault"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_site_recovery_fabric" "owned" {
  location            = "westeurope"
  recovery_vault_name = "fx-owned-recovery-vault-name"
  name                = "site-recovery-fabric"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_site_recovery_protection_container" "owned" {
  recovery_vault_name  = "fx-owned-recovery-vault-name"
  recovery_fabric_name = "fx-owned-recovery-fabric-name"
  name                 = "site-recovery-protection-container"
  resource_group_name  = azurerm_resource_group.platform.name
}
resource "azurerm_storage_mover" "owned" {
  location            = "westeurope"
  name                = "storage-mover"
  resource_group_name = azurerm_resource_group.platform.name
}

# network
resource "azurerm_arc_private_link_scope" "owned" {
  location            = "westeurope"
  name                = "arc-private-link-scope"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_bastion_host" "owned" {
  virtual_network_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/platform/providers/Microsoft.Network/virtualNetworks/platform"
  sku = "Developer"
  location            = "westeurope"
  name                = "bastion-host"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_custom_ip_prefix" "owned" {
  cidr                = "10.0.0.0/24"
  location            = "westeurope"
  name                = "custom-ip-prefix"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_databricks_virtual_network_peering" "owned" {
  workspace_id                  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Databricks/workspaces/fx-owned-workspace-id"
  remote_virtual_network_id     = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-owned-remote-virtual-network-id"
  remote_address_space_prefixes = ["10.0.0.0/24"]
  name                          = "databricks-virtual-network-peering"
  resource_group_name           = azurerm_resource_group.platform.name
}
resource "azurerm_express_route_circuit" "owned" {
  sku {
    tier   = "Basic"
    family = "MeteredData"
  }
  location            = "westeurope"
  name                = "express-route-circuit"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_express_route_gateway" "owned" {
  scale_units         = 1
  location            = "westeurope"
  virtual_hub_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualHubs/fx-owned-virtual-hub-id"
  name                = "express-route-gateway"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_express_route_port" "owned" {
  bandwidth_in_gbps   = 1
  location            = "westeurope"
  encapsulation       = "Dot1Q"
  peering_location    = "fx-owned-peering-location"
  name                = "express-route-port"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_firewall" "owned" {
  location            = "westeurope"
  sku_name            = "AZFW_Hub"
  sku_tier            = "Premium"
  name                = "firewall"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_local_network_gateway" "owned" {
  gateway_address     = "fx-owned-gateway-address"
  location            = "westeurope"
  name                = "local-network-gateway"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_monitor_private_link_scope" "owned" {
  name                = "monitor-private-link-scope"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_nat_gateway" "owned" {
  location            = "westeurope"
  name                = "nat-gateway"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_network_ddos_protection_plan" "owned" {
  location            = "westeurope"
  name                = "network-ddos-protection-plan"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_network_function_azure_traffic_collector" "owned" {
  location            = "westeurope"
  name                = "network-function-azure-traffic-collector"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_network_manager" "owned" {
  scope {
    management_group_ids = ["/providers/Microsoft.Management/managementGroups/rootform"]
  }
  location            = "westeurope"
  name                = "network-manager"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_network_security_group" "owned" {
  location            = "westeurope"
  name                = "network-security-group"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_network_security_perimeter" "owned" {
  location            = "westeurope"
  name                = "network-security-perimeter"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_point_to_site_vpn_gateway" "owned" {
  connection_configuration {
    vpn_client_address_pool {
      address_prefixes = ["10.0.0.0/24"]
    }
    name = "fx-owned-name"
  }
  location                    = "westeurope"
  vpn_server_configuration_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/vpnServerConfigurations/fx-owned-vpn-server-configuration-id"
  virtual_hub_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualHubs/fx-owned-virtual-hub-id"
  scale_unit                  = 1
  name                        = "point-to-site-vpn-gateway"
  resource_group_name         = azurerm_resource_group.platform.name
}
resource "azurerm_private_link_service" "owned" {
  destination_ip_address = "10.0.0.4"
  nat_ip_configuration {
    primary   = false
    name      = "primary"
    subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  }
  location            = "westeurope"
  name                = "private-link-service"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_public_ip_prefix" "owned" {
  location            = "westeurope"
  name                = "public-ip-prefix"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_route_server" "owned" {
  sku                  = "Standard"
  subnet_id            = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  public_ip_address_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/publicIPAddresses/fx-owned-public-ip-address-id"
  location             = "westeurope"
  name                 = "route-server"
  resource_group_name  = azurerm_resource_group.platform.name
}
resource "azurerm_route_table" "owned" {
  location            = "westeurope"
  name                = "route-table"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_synapse_private_link_hub" "owned" {
  location            = "westeurope"
  name                = "rootformsynapsehub"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_virtual_hub" "owned" {
  location            = "westeurope"
  name                = "virtual-hub"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_virtual_network_gateway" "owned" {
  ip_configuration {
    subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/platform/providers/Microsoft.Network/virtualNetworks/platform/subnets/GatewaySubnet"
  }
  sku                 = "Basic"
  location            = "westeurope"
  type                = "ExpressRoute"
  name                = "virtual-network-gateway"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_virtual_network_gateway_connection" "owned" {
  type                       = "ExpressRoute"
  virtual_network_gateway_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworkGateways/fx-owned-virtual-network-gateway-id"
  location                   = "westeurope"
  name                       = "virtual-network-gateway-connection"
  resource_group_name        = azurerm_resource_group.platform.name
}
resource "azurerm_virtual_network_peering" "owned" {
  remote_virtual_network_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-owned-remote-virtual-network-id"
  virtual_network_name      = "fx-owned-virtual-network-name"
  name                      = "virtual-network-peering"
  resource_group_name       = azurerm_resource_group.platform.name
}
resource "azurerm_virtual_wan" "owned" {
  location            = "westeurope"
  name                = "virtual-wan"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_vpn_gateway" "owned" {
  virtual_hub_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualHubs/fx-owned-virtual-hub-id"
  location            = "westeurope"
  name                = "vpn-gateway"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_vpn_site" "owned" {
  virtual_wan_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualWans/fx-owned-virtual-wan-id"
  location            = "westeurope"
  name                = "vpn-site"
  resource_group_name = azurerm_resource_group.platform.name
}

# operations
resource "azurerm_automation_account" "owned" {
  location            = "westeurope"
  sku_name            = "Basic"
  name                = "automation-account"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_automation_runbook" "owned" {
  content                 = "fx-owned-content"
  runbook_type            = "Graph"
  automation_account_name = "fx-owned-automation-account-name"
  log_verbose             = false
  location                = "westeurope"
  log_progress            = false
  name                    = "automation-runbook"
  resource_group_name     = azurerm_resource_group.platform.name
}
resource "azurerm_chaos_studio_experiment" "owned" {
  steps {
    branch {
      actions {
        action_type = "continuous"
      }
      name = "fx-owned-name"
    }
    name = "fx-owned-name"
  }
  selectors {
    name                    = "fx-owned-name"
    chaos_studio_target_ids = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/platform/providers/Microsoft.Compute/virtualMachines/vm/providers/Microsoft.Chaos/targets/Microsoft-VirtualMachine"]
  }
  location            = "westeurope"
  name                = "chaos-studio-experiment"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_dashboard_grafana" "owned" {
  grafana_major_version = "12"
  location              = "westeurope"
  name                  = "dashboard-grafana"
  resource_group_name   = azurerm_resource_group.platform.name
}
resource "azurerm_datadog_monitor" "owned" {
  datadog_organization {
    application_key = "fx-owned-application-key"
    api_key         = "fx-owned-api-key"
  }
  user {
    email = "fx-owned-email@example.com"
    name  = "fx-owned-name"
  }
  location            = "westeurope"
  sku_name            = "fx-owned-sku-name"
  name                = "datadog-monitor"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_dynatrace_monitor" "owned" {
  user {
    email      = "fx-owned-email@example.com"
    last_name  = "fx-owned-last-name"
    first_name = "fx-owned-first-name"
  }
  plan {
    plan = "fx-owned-plan"
  }
  identity {
    type = "SystemAssigned"
  }
  location                 = "westeurope"
  marketplace_subscription = "Active"
  name                     = "dynatrace-monitor"
  resource_group_name      = azurerm_resource_group.platform.name
}
resource "azurerm_elastic_cloud_elasticsearch" "owned" {
  location                    = "westeurope"
  sku_name                    = "fx-owned-sku-name"
  elastic_cloud_email_address = "fx-owned-elastic-cloud-email-address@example.com"
  name                        = "elastic-cloud-elasticsearch"
  resource_group_name         = azurerm_resource_group.platform.name
}
resource "azurerm_load_test" "owned" {
  location            = "westeurope"
  name                = "load-test"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_maintenance_configuration" "owned" {
  scope               = "Extension"
  location            = "westeurope"
  name                = "maintenance-configuration"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_network_watcher" "owned" {
  location            = "westeurope"
  name                = "network-watcher"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_new_relic_monitor" "owned" {
  user {
    phone_number = "fx-owned-phone-number"
    last_name    = "fx-owned-last-name"
    first_name   = "fx-owned-first-name"
    email        = "fx-owned-email@example.com"
  }
  plan {
    effective_date = "2026-01-01T00:00:00Z"
  }
  location            = "westeurope"
  name                = "new-relic-monitor"
  resource_group_name = azurerm_resource_group.platform.name
}

# security
resource "azurerm_attestation_provider" "owned" {
  location            = "westeurope"
  name                = "rootformattestation"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_confidential_ledger" "owned" {
  azuread_based_service_principal {
    tenant_id        = "00000000-0000-0000-0000-000000000007"
    principal_id     = "00000000-0000-0000-0000-000000000006"
    ledger_role_name = "Administrator"
  }
  ledger_type         = "Private"
  location            = "westeurope"
  name                = "confidential-ledger"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_dedicated_hardware_security_module" "owned" {
  network_profile {
    network_interface_private_ip_addresses = ["10.0.0.5"]
    subnet_id                              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  }
  sku_name            = "SafeNet Luna Network HSM A790"
  location            = "westeurope"
  name                = "rootformhsm"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_key_vault" "owned" {
  location                   = "westeurope"
  tenant_id                  = "00000000-0000-0000-0000-000000000003"
  sku_name                   = "standard"
  rbac_authorization_enabled = false
  name                       = "key-vault"
  resource_group_name        = azurerm_resource_group.platform.name
}
resource "azurerm_key_vault_managed_hardware_security_module" "owned" {
  location            = "westeurope"
  tenant_id           = "00000000-0000-0000-0000-000000000001"
  admin_object_ids    = ["00000000-0000-0000-0000-000000000010"]
  sku_name            = "Standard_B1"
  name                = "rootformmanagedhsm"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_trusted_signing_account" "owned" {
  sku_name            = "Basic"
  location            = "westeurope"
  name                = "trusted-signing-account"
  resource_group_name = azurerm_resource_group.platform.name
}

# serverless
resource "azurerm_spring_cloud_app" "owned" {
  service_name        = "fx-owned-service-name"
  name                = "spring-cloud-app"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_spring_cloud_service" "owned" {
  location            = "westeurope"
  name                = "spring-cloud-service"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_static_web_app" "owned" {
  location            = "westeurope"
  name                = "static-web-app"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_windows_function_app" "owned" {
  storage_account_name = "fx2a26cdeecca3"
  site_config {
  }
  location            = "westeurope"
  service_plan_id     = azurerm_service_plan.owned_functions.id
  name                = "windows-function-app"
  resource_group_name = azurerm_resource_group.platform.name
}

# A literal plan ID makes the provider read the plan while planning; the
# fixture plans offline, so the function and logic apps use plans it creates.
resource "azurerm_service_plan" "owned_functions" {
  name                = "owned-functions-plan"
  resource_group_name = azurerm_resource_group.platform.name
  location            = "westeurope"
  os_type             = "Windows"
  sku_name            = "Y1"
}

resource "azurerm_service_plan" "owned_logic" {
  name                = "owned-logic-plan"
  resource_group_name = azurerm_resource_group.platform.name
  location            = "westeurope"
  os_type             = "Windows"
  sku_name            = "WS1"
}

# storage
resource "azurerm_data_protection_backup_vault" "owned" {
  redundancy          = "GeoRedundant"
  location            = "westeurope"
  datastore_type      = "ArchiveStore"
  name                = "data-protection-backup-vault"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_elastic_san" "owned" {
  sku {
    name = "Premium_LRS"
  }
  base_size_in_tib    = 1
  location            = "westeurope"
  name                = "elastic-san"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_managed_lustre_file_system" "owned" {
  maintenance_window {
    time_of_day_in_utc = "01:00"
    day_of_week        = "Friday"
  }
  sku_name               = "AMLFS-Durable-Premium-40"
  subnet_id              = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  location               = "westeurope"
  zones                  = ["1"]
  storage_capacity_in_tb = 48
  name                   = "managed-lustre-file-system"
  resource_group_name    = azurerm_resource_group.platform.name
}
resource "azurerm_netapp_account" "owned" {
  location            = "westeurope"
  name                = "netapp-account"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_netapp_backup_policy" "owned" {
  account_name        = azurerm_netapp_account.owned.name
  location            = "westeurope"
  name                = "netapp-backup-policy"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_netapp_backup_vault" "owned" {
  location            = "westeurope"
  account_name        = azurerm_netapp_account.owned.name
  name                = "netapp-backup-vault"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_netapp_pool" "owned" {
  account_name        = azurerm_netapp_account.owned.name
  size_in_tb          = 1
  location            = "westeurope"
  service_level       = "Premium"
  name                = "netapp-pool"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_netapp_volume" "owned" {
  volume_path         = "rootformvolume"
  pool_name           = azurerm_netapp_pool.owned.name
  account_name        = azurerm_netapp_account.owned.name
  service_level       = "Premium"
  storage_quota_in_gb = 100
  location            = "westeurope"
  subnet_id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  name                = "netapp-volume"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_qumulo_file_system" "owned" {
  subnet_id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-owned-subnet-id"
  location            = "westeurope"
  admin_password      = "Rootform-Fixture-1"
  zone                = "1"
  storage_sku         = "Cold_LRS"
  email               = "owner@example.com"
  name                = "qumulo-file-sys"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_shared_image_gallery" "owned" {
  location            = "westeurope"
  name                = "shared_image_gallery"
  resource_group_name = azurerm_resource_group.platform.name
}
resource "azurerm_storage_sync" "owned" {
  location            = "westeurope"
  name                = "storage-sync"
  resource_group_name = azurerm_resource_group.platform.name
}

# literal and unknown resource group names produce no ownership context
resource "azurerm_container_registry" "literal" {
  sku                 = "Basic"
  location            = "westeurope"
  name                = "rootformliteral"
  resource_group_name = "platform"
}

resource "azurerm_redis_cache" "unknown" {
  location            = "westeurope"
  capacity            = 1
  sku_name            = "Basic"
  family              = "C"
  name                = "unknown"
  resource_group_name = terraform_data.unknown_id.id
}
