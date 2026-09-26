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

resource "azurerm_virtual_network" "hub" {
  address_space       = ["fixture"]
  location            = "westeurope"
  name                = "hub"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_virtual_network" "spoke" {
  address_space       = ["fixture"]
  location            = "westeurope"
  name                = "spoke"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_subnet" "aks" {
  address_prefixes     = ["10.0.0.0/24"]
  name                 = "aks"
  resource_group_name  = azurerm_resource_group.platform.name
  virtual_network_name = azurerm_virtual_network.spoke.name
}

resource "azurerm_subnet" "private_services" {
  address_prefixes     = ["10.0.0.0/24"]
  name                 = "private-services"
  resource_group_name  = azurerm_resource_group.platform.name
  virtual_network_name = azurerm_virtual_network.spoke.name
}

resource "azurerm_subnet" "aks_user" {
  address_prefixes     = ["10.0.0.0/24"]
  name                 = "aks-user"
  resource_group_name  = azurerm_resource_group.platform.name
  virtual_network_name = azurerm_virtual_network.spoke.name
}

resource "azurerm_subnet" "postgres" {
  address_prefixes     = ["10.0.0.0/24"]
  name                 = "postgres"
  resource_group_name  = azurerm_resource_group.platform.name
  virtual_network_name = azurerm_virtual_network.spoke.name
}

resource "azurerm_subnet" "ingress" {
  address_prefixes     = ["10.0.0.0/24"]
  name                 = "ingress"
  resource_group_name  = azurerm_resource_group.platform.name
  virtual_network_name = azurerm_virtual_network.spoke.name
}

resource "azurerm_virtual_network_peering" "hub_to_spoke" {
  name                      = "hub-to-spoke"
  resource_group_name       = azurerm_resource_group.platform.name
  virtual_network_name      = azurerm_virtual_network.hub.name
  remote_virtual_network_id = azurerm_virtual_network.spoke.id
}

resource "azurerm_nat_gateway" "egress" {
  location            = "westeurope"
  name                = "egress"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_virtual_network_gateway" "vpn" {
  type     = "ExpressRoute"
  sku      = "Standard"
  location = "westeurope"
  ip_configuration {
    subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/GatewaySubnet"
  }
  name                = "vpn"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_express_route_circuit" "private" {
  sku {
    tier   = "Basic"
    family = "MeteredData"
  }
  location            = "westeurope"
  name                = "private"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_kubernetes_cluster" "workloads" {
  identity {
    type = "UserAssigned"
  }
  dns_prefix = "fx-workloads-dns-prefix"
  node_provisioning_profile {
    default_node_pools = "Auto"
  }
  location            = "westeurope"
  name                = "workloads"
  resource_group_name = azurerm_resource_group.platform.name

  default_node_pool {
    name           = "system"
    vnet_subnet_id = azurerm_subnet.aks.id
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "apps" {
  name                  = "apps"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.workloads.id
  vnet_subnet_id        = azurerm_subnet.aks_user.id
}

resource "azurerm_postgresql_flexible_server" "records" {
  location            = "westeurope"
  name                = "records"
  resource_group_name = azurerm_resource_group.platform.name
  delegated_subnet_id = azurerm_subnet.postgres.id
}

resource "azurerm_service_plan" "apps" {
  sku_name            = "B1"
  os_type             = "Linux"
  location            = "westeurope"
  name                = "apps"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_linux_web_app" "api" {
  site_config {
  }
  location            = "westeurope"
  name                = "api"
  resource_group_name = azurerm_resource_group.platform.name
  service_plan_id     = azurerm_service_plan.apps.id
}

resource "azurerm_linux_function_app" "worker" {
  storage_account_name = "fxf1740287f3fd"
  site_config {
  }
  location            = "westeurope"
  name                = "worker"
  resource_group_name = azurerm_resource_group.platform.name
  service_plan_id     = azurerm_service_plan.apps.id
}

resource "azurerm_mssql_server" "data" {
  administrator_login_password = "fx-data-administrator-login-password"
  administrator_login          = "fx-data-administrator-login"
  version                      = "2.0"
  location                     = "westeurope"
  name                         = "data"
  resource_group_name          = azurerm_resource_group.platform.name
}

resource "azurerm_mssql_database" "orders" {
  name      = "orders"
  server_id = azurerm_mssql_server.data.id
}

resource "azurerm_storage_account" "data" {
  location                 = "westeurope"
  account_tier             = "Premium"
  account_replication_type = "LRS"
  name                     = "rootformscenario"
  resource_group_name      = azurerm_resource_group.platform.name
}

resource "azurerm_storage_container" "events" {
  storage_account_id = azurerm_storage_account.data.id
  name               = "events"
}

resource "azurerm_private_endpoint" "sql" {
  location            = "westeurope"
  name                = "sql"
  resource_group_name = azurerm_resource_group.platform.name
  subnet_id           = azurerm_subnet.private_services.id

  private_service_connection {
    name                           = "sql"
    private_connection_resource_id = azurerm_mssql_server.data.id
    is_manual_connection           = false
  }
}

resource "azurerm_private_endpoint" "storage" {
  location            = "westeurope"
  name                = "storage"
  resource_group_name = azurerm_resource_group.platform.name
  subnet_id           = azurerm_subnet.private_services.id

  private_service_connection {
    name                           = "storage"
    private_connection_resource_id = azurerm_storage_account.data.id
    is_manual_connection           = false
  }
}

resource "azurerm_application_gateway" "ingress" {
  request_routing_rule {
    rule_type          = "Basic"
    name               = "fx-ingress-name"
    http_listener_name = "fx-ingress-http-listener-name"
  }
  http_listener {
    protocol                       = "Http"
    name                           = "fx-ingress-name"
    frontend_port_name             = "fx-ingress-frontend-port-name"
    frontend_ip_configuration_name = "fx-ingress-frontend-ip-configuration-name"
  }
  backend {
    protocol = "Tcp"
    port     = 1
    name     = "fx-ingress-name"
  }
  sku {
    tier     = "Basic"
    name     = "Basic"
    capacity = 1
  }
  location = "westeurope"
  frontend_port {
    port = 1
    name = "fx-ingress-name"
  }
  frontend_ip_configuration {
    name = "fx-ingress-name"
  }
  backend_address_pool {
    name = "fx-ingress-name"
  }
  name                = "ingress"
  resource_group_name = azurerm_resource_group.platform.name

  gateway_ip_configuration {
    name      = "gateway-ip"
    subnet_id = azurerm_subnet.ingress.id
  }
}

resource "azurerm_cdn_frontdoor_profile" "global" {
  sku_name            = "Premium_AzureFrontDoor"
  name                = "global"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_servicebus_namespace" "bus" {
  sku                 = "Basic"
  location            = "westeurope"
  name                = "rootform-bus"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_servicebus_queue" "commands" {
  name         = "commands"
  namespace_id = azurerm_servicebus_namespace.bus.id
}

resource "azurerm_servicebus_topic" "events" {
  name         = "events"
  namespace_id = azurerm_servicebus_namespace.bus.id
}

resource "azurerm_servicebus_subscription" "analytics" {
  max_delivery_count = 1
  name               = "analytics"
  topic_id           = azurerm_servicebus_topic.events.id
}

resource "azurerm_eventhub_namespace" "streams" {
  sku                 = "Basic"
  location            = "westeurope"
  name                = "streams"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_eventhub" "telemetry" {
  message_retention = 1
  partition_count   = 1
  name              = "telemetry"
  namespace_id      = azurerm_eventhub_namespace.streams.id
}

resource "azurerm_eventgrid_topic" "notifications" {
  location            = "westeurope"
  name                = "notifications"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_user_assigned_identity" "workload" {
  location            = "westeurope"
  name                = "workload"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_key_vault" "secrets" {
  tenant_id                  = "00000000-0000-0000-0000-000000000001"
  sku_name                   = "standard"
  rbac_authorization_enabled = false
  location                   = "westeurope"
  name                       = "secrets"
  resource_group_name        = azurerm_resource_group.platform.name
}

resource "azurerm_key_vault_secret" "connection" {
  name         = "connection"
  value        = "synthetic-not-a-real-secret"
  key_vault_id = azurerm_key_vault.secrets.id
}

resource "azurerm_data_factory" "integration" {
  location            = "westeurope"
  name                = "integration"
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_synapse_workspace" "analytics" {
  storage_data_lake_gen2_filesystem_id = "fx-analytics-storage-data-lake-gen2-filesystem-i"
  location                             = "westeurope"
  name                                 = "analytics"
  resource_group_name                  = azurerm_resource_group.platform.name
}
