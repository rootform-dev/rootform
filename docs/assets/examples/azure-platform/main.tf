# Synthetic architecture source for Rootform documentation.
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.3.0"
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
    vnet_subnet_id = azurerm_subnet.production_applications.id
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

resource "azurerm_storage_account" "staging_archive" {
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

resource "azurerm_private_endpoint" "staging_archive" {
  name                = "staging-archive"
  resource_group_name = azurerm_resource_group.staging.name
  location            = azurerm_resource_group.staging.location
  subnet_id           = azurerm_subnet.staging_data.id

  private_service_connection {
    name                           = "archive"
    private_connection_resource_id = azurerm_storage_account.staging_archive.id
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

