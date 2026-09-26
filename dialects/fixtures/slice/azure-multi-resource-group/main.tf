terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.3.0"
    }
  }
}

resource "azurerm_resource_group" "platform" {
  name     = "platform"
  location = "West Europe"
}

resource "azurerm_resource_group" "apps" {
  name     = "apps"
  location = "West Europe"
}

resource "azurerm_resource_group" "data" {
  name     = "data"
  location = "North Europe"
}

resource "azurerm_virtual_network" "platform" {
  name                = "platform"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  address_space       = ["10.70.0.0/16"]
}

resource "azurerm_subnet" "aks" {
  name                 = "aks"
  resource_group_name  = azurerm_resource_group.platform.name
  virtual_network_name = azurerm_virtual_network.platform.name
  address_prefixes     = ["10.70.1.0/24"]
}

resource "azurerm_subnet" "gateway" {
  name                 = "gateway"
  resource_group_name  = azurerm_resource_group.platform.name
  virtual_network_name = azurerm_virtual_network.platform.name
  address_prefixes     = ["10.70.2.0/24"]
}

resource "azurerm_application_gateway" "edge" {
  http_listener {
    frontend_ip_configuration_name = "fx-edge-frontend-ip-configuration-name"
    protocol                       = "Http"
    frontend_port_name             = "fx-edge-frontend-port-name"
    name                           = "fx-edge-name"
  }
  backend {
    protocol = "Tcp"
    port     = 1
    name     = "fx-edge-name"
  }
  request_routing_rule {
    name               = "fx-edge-name"
    rule_type          = "Basic"
    http_listener_name = "fx-edge-http-listener-name"
  }
  sku {
    tier     = "Basic"
    name     = "Basic"
    capacity = 1
  }
  gateway_ip_configuration {
    subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-edge-subnet-id"
    name      = "fx-edge-name"
  }
  frontend_port {
    port = 1
    name = "fx-edge-name"
  }
  frontend_ip_configuration {
    name = "fx-edge-name"
  }
  backend_address_pool {
    name = "fx-edge-name"
  }
  name                = "edge"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_lb" "internal" {
  name                = "internal"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  sku                 = "Standard"
}

resource "azurerm_user_assigned_identity" "platform" {
  name                = "platform"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_kubernetes_cluster" "workloads" {
  node_provisioning_profile {
    default_node_pools = "Auto"
  }
  name                = "workloads"
  location            = azurerm_resource_group.apps.location
  resource_group_name = azurerm_resource_group.apps.name
  dns_prefix          = "workloads"

  default_node_pool {
    name           = "system"
    node_count     = 2
    vm_size        = "Standard_D2s_v5"
    vnet_subnet_id = azurerm_subnet.aks.id
  }

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "workers" {
  name                  = "workers"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.workloads.id
  vm_size               = "Standard_D4s_v5"
  node_count            = 3
  vnet_subnet_id        = azurerm_subnet.aks.id
}

resource "azurerm_storage_account" "artifacts" {
  name                     = "rootformartifacts"
  location                 = azurerm_resource_group.apps.location
  resource_group_name      = azurerm_resource_group.apps.name
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_user_assigned_identity" "apps" {
  name                = "apps"
  location            = azurerm_resource_group.apps.location
  resource_group_name = azurerm_resource_group.apps.name
}

resource "azurerm_virtual_network" "data" {
  name                = "data"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  address_space       = ["10.80.0.0/16"]
}

resource "azurerm_subnet" "records" {
  name                 = "records"
  resource_group_name  = azurerm_resource_group.data.name
  virtual_network_name = azurerm_virtual_network.data.name
  address_prefixes     = ["10.80.1.0/24"]

  delegation {
    name = "postgresql"

    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "endpoints" {
  name                 = "endpoints"
  resource_group_name  = azurerm_resource_group.data.name
  virtual_network_name = azurerm_virtual_network.data.name
  address_prefixes     = ["10.80.2.0/24"]
}

resource "azurerm_postgresql_flexible_server" "records" {
  name                          = "records"
  resource_group_name           = azurerm_resource_group.data.name
  location                      = azurerm_resource_group.data.location
  version                       = "17"
  delegated_subnet_id           = azurerm_subnet.records.id
  public_network_access_enabled = false
  sku_name                      = "B_Standard_B1ms"
}

resource "azurerm_mssql_server" "legacy" {
  administrator_login_password = "fx-legacy-administrator-login-password"
  administrator_login          = "fx-legacy-administrator-login"
  name                         = "legacy"
  location                     = azurerm_resource_group.data.location
  resource_group_name          = azurerm_resource_group.data.name
  version                      = "12.0"
}

resource "azurerm_mssql_database" "legacy" {
  name      = "legacy"
  server_id = azurerm_mssql_server.legacy.id
}

resource "azurerm_private_endpoint" "legacy" {
  name                = "legacy"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.endpoints.id

  private_service_connection {
    name                           = "legacy"
    private_connection_resource_id = azurerm_mssql_server.legacy.id
    is_manual_connection           = false
  }
}

resource "azurerm_storage_account" "archive" {
  name                     = "rootformarchive"
  location                 = azurerm_resource_group.data.location
  resource_group_name      = azurerm_resource_group.data.name
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_user_assigned_identity" "data" {
  name                = "data"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
}
