# Reproducible Rootform Playground source. This is an architecture example, not a deployment recipe.
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "= 2.38.0"
    }
  }
}

resource "azurerm_resource_group" "production" {
  name     = "production"
  location = "West Europe"
}

resource "azurerm_virtual_network" "production" {
  name                = "production"
  location            = azurerm_resource_group.production.location
  resource_group_name = azurerm_resource_group.production.name
  address_space       = ["10.20.0.0/16"]
}

resource "azurerm_subnet" "production_applications" {
  name                 = "applications"
  resource_group_name  = azurerm_resource_group.production.name
  virtual_network_name = azurerm_virtual_network.production.name
  address_prefixes     = ["10.20.1.0/24"]
}

resource "azurerm_subnet" "production_data" {
  name                 = "data"
  resource_group_name  = azurerm_resource_group.production.name
  virtual_network_name = azurerm_virtual_network.production.name
  address_prefixes     = ["10.20.2.0/24"]
}

resource "azurerm_subnet" "production_edge" {
  name                 = "edge"
  resource_group_name  = azurerm_resource_group.production.name
  virtual_network_name = azurerm_virtual_network.production.name
  address_prefixes     = ["10.20.3.0/24"]
}

resource "azurerm_kubernetes_cluster" "production_checkout" {
  name                = "production-checkout"
  location            = azurerm_resource_group.production.location
  resource_group_name = azurerm_resource_group.production.name
  dns_prefix          = "production-checkout"

  default_node_pool {
    name           = "system"
    vm_size        = "Standard_D2_v2"
    node_count     = 2
    vnet_subnet_id = azurerm_subnet.production_applications.id
  }

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_kubernetes_cluster" "production_analytics" {
  name                = "production-analytics"
  location            = azurerm_resource_group.production.location
  resource_group_name = azurerm_resource_group.production.name
  dns_prefix          = "production-analytics"

  default_node_pool {
    name           = "system"
    vm_size        = "Standard_D2_v2"
    node_count     = 2
    vnet_subnet_id = azurerm_subnet.production_edge.id
  }

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "production_workers" {
  name                  = "workers"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.production_analytics.id
  vm_size               = "Standard_D2_v2"
  node_count            = 2
}

resource "azurerm_private_dns_zone" "production" {
  name                = "production.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.production.name
}

resource "azurerm_postgresql_flexible_server" "production_orders" {
  name                = "production-orders"
  resource_group_name = azurerm_resource_group.production.name
  location            = azurerm_resource_group.production.location
  delegated_subnet_id = azurerm_subnet.production_data.id
  private_dns_zone_id = azurerm_private_dns_zone.production.id
}

resource "azurerm_storage_account" "production_archive" {
  name                     = "productionarchive"
  resource_group_name      = azurerm_resource_group.production.name
  location                 = azurerm_resource_group.production.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_mssql_server" "production_ledger" {
  name                = "production-ledger"
  resource_group_name = azurerm_resource_group.production.name
  location            = azurerm_resource_group.production.location
  version             = "12.0"
}

resource "azurerm_mssql_database" "production_ledger" {
  name      = "ledger"
  server_id = azurerm_mssql_server.production_ledger.id
}

resource "azurerm_private_endpoint" "production_archive" {
  name                = "production-archive"
  resource_group_name = azurerm_resource_group.production.name
  location            = azurerm_resource_group.production.location
  subnet_id           = azurerm_subnet.production_data.id

  private_service_connection {
    name                           = "archive"
    private_connection_resource_id = azurerm_storage_account.production_archive.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }
}

resource "azurerm_private_endpoint" "production_ledger" {
  name                = "production-ledger"
  resource_group_name = azurerm_resource_group.production.name
  location            = azurerm_resource_group.production.location
  subnet_id           = azurerm_subnet.production_data.id

  private_service_connection {
    name                           = "ledger"
    private_connection_resource_id = azurerm_mssql_server.production_ledger.id
    subresource_names              = ["sqlServer"]
    is_manual_connection           = false
  }
}

resource "azurerm_resource_group" "staging" {
  name     = "staging"
  location = "West Europe"
}

resource "azurerm_virtual_network" "staging" {
  name                = "staging"
  location            = azurerm_resource_group.staging.location
  resource_group_name = azurerm_resource_group.staging.name
  address_space       = ["10.30.0.0/16"]
}

resource "azurerm_subnet" "staging_applications" {
  name                 = "applications"
  resource_group_name  = azurerm_resource_group.staging.name
  virtual_network_name = azurerm_virtual_network.staging.name
  address_prefixes     = ["10.30.1.0/24"]
}

resource "azurerm_subnet" "staging_data" {
  name                 = "data"
  resource_group_name  = azurerm_resource_group.staging.name
  virtual_network_name = azurerm_virtual_network.staging.name
  address_prefixes     = ["10.30.2.0/24"]
}

resource "azurerm_subnet" "staging_edge" {
  name                 = "edge"
  resource_group_name  = azurerm_resource_group.staging.name
  virtual_network_name = azurerm_virtual_network.staging.name
  address_prefixes     = ["10.30.3.0/24"]
}

resource "azurerm_kubernetes_cluster" "staging_checkout" {
  name                = "staging-checkout"
  location            = azurerm_resource_group.staging.location
  resource_group_name = azurerm_resource_group.staging.name
  dns_prefix          = "staging-checkout"

  default_node_pool {
    name           = "system"
    vm_size        = "Standard_D2_v2"
    node_count     = 2
    vnet_subnet_id = azurerm_subnet.staging_applications.id
  }

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_kubernetes_cluster" "staging_analytics" {
  name                = "staging-analytics"
  location            = azurerm_resource_group.staging.location
  resource_group_name = azurerm_resource_group.staging.name
  dns_prefix          = "staging-analytics"

  default_node_pool {
    name           = "system"
    vm_size        = "Standard_D2_v2"
    node_count     = 2
    vnet_subnet_id = azurerm_subnet.staging_applications.id
  }

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "staging_workers" {
  name                  = "workers"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.staging_analytics.id
  vm_size               = "Standard_D2_v2"
  node_count            = 2
}

resource "azurerm_private_dns_zone" "staging" {
  name                = "staging.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.staging.name
}

resource "azurerm_postgresql_flexible_server" "staging_orders" {
  name                = "staging-orders"
  resource_group_name = azurerm_resource_group.staging.name
  location            = azurerm_resource_group.staging.location
  delegated_subnet_id = azurerm_subnet.staging_data.id
  private_dns_zone_id = azurerm_private_dns_zone.staging.id
}

resource "azurerm_storage_account" "staging_backup" {
  name                     = "stagingarchive"
  resource_group_name      = azurerm_resource_group.staging.name
  location                 = azurerm_resource_group.staging.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_mssql_server" "staging_ledger" {
  name                = "staging-ledger"
  resource_group_name = azurerm_resource_group.staging.name
  location            = azurerm_resource_group.staging.location
  version             = "12.0"
}

resource "azurerm_mssql_database" "staging_ledger" {
  name      = "ledger"
  server_id = azurerm_mssql_server.staging_ledger.id
}

resource "azurerm_private_endpoint" "staging_backup" {
  name                = "staging-archive"
  resource_group_name = azurerm_resource_group.staging.name
  location            = azurerm_resource_group.staging.location
  subnet_id           = azurerm_subnet.staging_data.id

  private_service_connection {
    name                           = "archive"
    private_connection_resource_id = azurerm_storage_account.staging_backup.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }
}

resource "azurerm_private_endpoint" "staging_ledger" {
  name                = "staging-ledger"
  resource_group_name = azurerm_resource_group.staging.name
  location            = azurerm_resource_group.staging.location
  subnet_id           = azurerm_subnet.staging_data.id

  private_service_connection {
    name                           = "ledger"
    private_connection_resource_id = azurerm_mssql_server.staging_ledger.id
    subresource_names              = ["sqlServer"]
    is_manual_connection           = false
  }
}

resource "azurerm_resource_group" "platform" {
  name     = "platform-shared"
  location = "West Europe"
}

resource "azurerm_cdn_frontdoor_profile" "edge" {
  name                = "commerce-edge"
  resource_group_name = azurerm_resource_group.platform.name
  sku_name            = "Standard_AzureFrontDoor"
}

resource "azurerm_api_management" "commerce" {
  name                = "commerce-api"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  publisher_name      = "Platform Engineering"
  publisher_email     = "platform@example.invalid"
  sku_name            = "Developer_1"
}

resource "azurerm_container_registry" "images" {
  name                = "commerceimages"
  resource_group_name = azurerm_resource_group.platform.name
  location            = azurerm_resource_group.platform.location
  sku                 = "Premium"
}

resource "azurerm_key_vault" "workloads" {
  name                = "commerce-workloads"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  tenant_id           = "00000000-0000-0000-0000-000000000000"
  sku_name            = "standard"
}

resource "azurerm_key_vault_secret" "checkout_database" {
  name         = "checkout-database"
  value        = "managed-outside-this-example"
  key_vault_id = azurerm_key_vault.workloads.id
}

resource "azurerm_servicebus_namespace" "commerce" {
  name                = "commerce-events"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  sku                 = "Premium"
}

resource "azurerm_servicebus_queue" "orders" {
  name         = "orders"
  namespace_id = azurerm_servicebus_namespace.commerce.id
}

resource "azurerm_log_analytics_workspace" "platform" {
  name                = "commerce-observability"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  sku                 = "PerGB2018"
}

resource "azurerm_application_insights" "checkout" {
  name                = "checkout"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  workspace_id        = azurerm_log_analytics_workspace.platform.id
  application_type    = "web"
}

resource "azurerm_user_assigned_identity" "checkout" {
  name                = "checkout-workload"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
}

provider "kubernetes" {
  alias = "production"
  host  = azurerm_kubernetes_cluster.production_checkout.kube_config[0].host
}

provider "kubernetes" {
  alias = "staging"
  host  = azurerm_kubernetes_cluster.staging_checkout.kube_config[0].host
}

resource "kubernetes_namespace_v1" "production_checkout" {
  provider = kubernetes.production
  metadata {
    name = "checkout"
  }
}

resource "kubernetes_service_account_v1" "production_checkout" {
  provider = kubernetes.production
  metadata {
    name      = "checkout"
    namespace = kubernetes_namespace_v1.production_checkout.metadata[0].name
  }
}

resource "kubernetes_deployment_v1" "production_checkout_api" {
  provider = kubernetes.production
  metadata {
    name      = "checkout-api"
    namespace = kubernetes_namespace_v1.production_checkout.metadata[0].name
  }
}

resource "kubernetes_deployment_v1" "production_checkout_worker" {
  provider = kubernetes.production
  metadata {
    name      = "checkout-worker"
    namespace = kubernetes_namespace_v1.production_checkout.metadata[0].name
  }
}

resource "kubernetes_deployment_v1" "production_recommendations" {
  provider = kubernetes.production
  metadata {
    name      = "recommendations"
    namespace = kubernetes_namespace_v1.production_checkout.metadata[0].name
  }
}

resource "kubernetes_service_v1" "production_checkout" {
  provider = kubernetes.production
  metadata {
    name      = "checkout-api"
    namespace = kubernetes_namespace_v1.production_checkout.metadata[0].name
  }
}

resource "kubernetes_service_v1" "production_recommendations" {
  provider = kubernetes.production
  metadata {
    name      = "recommendations"
    namespace = kubernetes_namespace_v1.production_checkout.metadata[0].name
  }
}

resource "kubernetes_ingress_v1" "production_checkout" {
  provider = kubernetes.production
  metadata {
    name      = "checkout"
    namespace = kubernetes_namespace_v1.production_checkout.metadata[0].name
  }
}

resource "kubernetes_namespace_v1" "staging_checkout" {
  provider = kubernetes.staging
  metadata {
    name = "checkout"
  }
}

resource "kubernetes_deployment_v1" "staging_checkout_api" {
  provider = kubernetes.staging
  metadata {
    name      = "checkout-api"
    namespace = kubernetes_namespace_v1.staging_checkout.metadata[0].name
  }
}

resource "kubernetes_service_v1" "staging_checkout" {
  provider = kubernetes.staging
  metadata {
    name      = "checkout-api"
    namespace = kubernetes_namespace_v1.staging_checkout.metadata[0].name
  }
}
