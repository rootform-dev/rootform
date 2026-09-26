terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "= 5.3.0" }
  }
}

resource "terraform_data" "unknown_id" {

}
resource "azurerm_resource_group" "platform" {
  name     = "platform"
  location = "West Europe"
}
resource "azurerm_virtual_network" "platform" {
  address_space       = ["fx-platform-address-space"]
  resource_group_name = "fx-platform-resource-group-name"
  location            = "westeurope"
  name                = "platform"
}
resource "azurerm_subnet" "apps" {
  address_prefixes     = ["10.0.0.0/24"]
  resource_group_name  = "fx-apps-resource-group-name"
  virtual_network_name = "fx-apps-virtual-network-name"
  name                 = "apps"
}
resource "azurerm_log_analytics_workspace" "platform" {
  location            = "westeurope"
  resource_group_name = "fx-platform-resource-group-name"
  name                = "platform"
}
resource "azurerm_container_app_environment" "platform" {
  name                       = "platform"
  resource_group_name        = azurerm_resource_group.platform.name
  location                   = azurerm_resource_group.platform.location
  infrastructure_subnet_id   = azurerm_subnet.apps.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.platform.id
}

resource "azurerm_container_app" "api" {
  template {
    container {
      image  = "fx-api-image"
      cpu    = 1
      name   = "fx-api-name"
      memory = "fx-api-memory"
    }
  }
  revision_mode                = "Single"
  name                         = "api"
  resource_group_name          = azurerm_resource_group.platform.name
  container_app_environment_id = azurerm_container_app_environment.platform.id
}

resource "azurerm_container_app_job" "worker" {
  event_trigger_config {
  }
  template {
    container {
      cpu    = 1
      name   = "fx-worker-name"
      memory = "fx-worker-memory"
      image  = "fx-worker-image"
    }
  }
  replica_timeout_in_seconds   = 1
  location                     = "westeurope"
  name                         = "worker"
  resource_group_name          = azurerm_resource_group.platform.name
  container_app_environment_id = azurerm_container_app_environment.platform.id
}

resource "azurerm_container_app_environment" "literal" {
  name                       = "literal"
  resource_group_name        = "platform"
  location                   = azurerm_resource_group.platform.location
  infrastructure_subnet_id   = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-virtualnetworks/subnets/fx-literal-infrastructure-subnet-id"
  log_analytics_workspace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.OperationalInsights/workspaces/fx-literal-log-analytics-workspace-id"
  logs_destination           = "log-analytics"
}

resource "azurerm_container_app" "unknown" {
  template {
    container {
      memory = "fx-unknown-memory"
      cpu    = 1
      name   = "fx-unknown-name"
      image  = "fx-unknown-image"
    }
  }
  revision_mode                = "Single"
  name                         = "unknown"
  resource_group_name          = terraform_data.unknown_id.id
  container_app_environment_id = terraform_data.unknown_id.id
}
