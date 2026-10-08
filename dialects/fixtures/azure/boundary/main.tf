terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.3.0"
    }
  }
}

resource "azurerm_virtual_network" "platform" {
  resource_group_name = "fx-platform-resource-group-name"
  location            = "westeurope"
  name                = "platform"
  address_space       = ["10.70.0.0/16"]
}

resource "azurerm_resource_group" "shared_a" {
  name     = "shared"
  location = "West Europe"
}

resource "azurerm_resource_group" "shared_b" {
  name     = "shared"
  location = "West Europe"
}

resource "azurerm_subnet" "dynamic" {
  resource_group_name  = "fx-dynamic-resource-group-name"
  name                 = "dynamic"
  virtual_network_name = "external-network"
  address_prefixes     = ["10.70.1.0/24"]
}

resource "azurerm_subnet" "absent" {
  virtual_network_name = "fx-absent-virtual-network-name"
  resource_group_name  = "fx-absent-resource-group-name"
  name                 = "absent"
  address_prefixes     = ["10.70.2.0/24"]
}

resource "azurerm_subnet" "mismatch" {
  resource_group_name  = "fx-mismatch-resource-group-name"
  name                 = "mismatch"
  virtual_network_name = azurerm_kubernetes_cluster.absent.name
  address_prefixes     = ["10.70.4.0/24"]
}

resource "azurerm_kubernetes_cluster" "absent" {
  identity {
    type = "UserAssigned"
  }
  dns_prefix          = "fx-absent-dns-prefix"
  resource_group_name = "fx-absent-resource-group-name"
  node_provisioning_profile {
    default_node_pools = "Auto"
  }
  location = "westeurope"
  name     = "absent"

  default_node_pool {
    name = "system"
  }
}

resource "azurerm_kubernetes_cluster" "dynamic" {
  identity {
    type = "UserAssigned"
  }
  dns_prefix          = "fx-dynamic-dns-prefix"
  resource_group_name = "fx-dynamic-resource-group-name"
  node_provisioning_profile {
    default_node_pools = "Auto"
  }
  location = "westeurope"
  name     = "dynamic"

  default_node_pool {
    name           = "system"
    vnet_subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-virtualnetworks/subnets/fx-dynamic-vnet-subnet-id"
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "mismatch" {
  name                  = "mismatch"
  kubernetes_cluster_id = azurerm_virtual_network.platform.id
}

resource "azurerm_postgresql_flexible_server" "mismatch" {
  resource_group_name = "fx-mismatch-resource-group-name"
  location            = "westeurope"
  name                = "mismatch"
  delegated_subnet_id = azurerm_virtual_network.platform.id
}

resource "azurerm_postgresql_flexible_server" "absent" {
  resource_group_name = "fx-absent-resource-group-name"
  location            = "westeurope"
  name                = "absent"
}

resource "azurerm_postgresql_flexible_server" "dynamic" {
  resource_group_name = "fx-dynamic-resource-group-name"
  location            = "westeurope"
  name                = "dynamic"
  delegated_subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-virtualnetworks/subnets/fx-dynamic-delegated-subnet-id"
}

resource "azurerm_storage_account" "absent" {
  resource_group_name      = "fx-absent-resource-group-name"
  location                 = "westeurope"
  account_tier             = "Premium"
  account_replication_type = "LRS"
  name                     = "rootformabsent"
}

resource "azurerm_storage_account" "ambiguous" {
  location                 = "westeurope"
  account_tier             = "Premium"
  account_replication_type = "LRS"
  name                     = "rootformambiguous"
  resource_group_name      = "shared"
}

resource "azurerm_storage_account" "mismatch" {
  location                 = "westeurope"
  account_tier             = "Premium"
  account_replication_type = "LRS"
  name                     = "rootformmismatch"
  resource_group_name      = azurerm_virtual_network.platform.name
}

resource "azurerm_mssql_server" "server" {
  administrator_login_password = "fx-server-administrator-login-password"
  administrator_login          = "fx-server-administrator-login"
  version                      = "2.0"
  resource_group_name          = "fx-server-resource-group-name"
  location                     = "westeurope"
  name                         = "server"
}

resource "azurerm_mssql_database" "absent" {
  server_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Sql/servers/fx-absent-server"
  name      = "absent"
}

resource "azurerm_mssql_database" "mismatch" {
  name      = "mismatch"
  server_id = azurerm_virtual_network.platform.id
}

resource "azurerm_lb" "transport" {
  resource_group_name = "fx-transport-resource-group-name"
  location            = "westeurope"
  name                = "transport"
}

resource "azurerm_lb_backend_address_pool" "absent" {
  loadbalancer_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-resourcegroup/providers/Microsoft.Network/loadBalancers/fx-absent-loadbalancer-id"
  name            = "absent"
}

resource "azurerm_lb_rule" "mismatch" {
  protocol                       = "All"
  frontend_port                  = 1
  frontend_ip_configuration_name = "fx-mismatch-frontend-ip-configuration-name"
  backend_port                   = 1
  name                           = "mismatch"
  loadbalancer_id                = azurerm_virtual_network.platform.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "absent" {
  virtual_network_id  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-absent-virtual-network-id"
  private_dns_zone_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/privateDnsZones/fx-absent-private-dns-zone-id"
  name                = "absent"
}

resource "azurerm_private_dns_zone_virtual_network_link" "mismatch" {
  virtual_network_id  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-mismatch-virtual-network-id"
  name                = "mismatch"
  private_dns_zone_id = azurerm_virtual_network.platform.id
}

resource "azurerm_private_endpoint" "absent" {
  subnet_id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-absent-subnet-id"
  resource_group_name = "fx-absent-resource-group-name"
  private_service_connection {
    private_connection_resource_alias = "fx-absent.00000000-0000-0000-0000-000000000000.westeurope.azure.privatelinkservice"
    name                              = "fx-absent-name"
    is_manual_connection              = false
  }
  location = "westeurope"
  name     = "absent"
}

resource "azurerm_private_endpoint" "mismatch" {
  resource_group_name = "fx-mismatch-resource-group-name"
  private_service_connection {
    private_connection_resource_alias = "fx-mismatch.00000000-0000-0000-0000-000000000000.westeurope.azure.privatelinkservice"
    name                              = "fx-mismatch-name"
    is_manual_connection              = false
  }
  location  = "westeurope"
  name      = "mismatch"
  subnet_id = azurerm_virtual_network.platform.id
}
