terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.3.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "= 3.9.0"
    }
    azapi = {
      source  = "azure/azapi"
      version = "= 2.12.0"
    }
  }
}

resource "azurerm_linux_virtual_machine" "compute" {
  source_image_id                 = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Compute/images/fx-image"
  disable_password_authentication = false
  admin_password                  = "Fx-Placeholder-0001"
  admin_username                  = "fxadmin"
  size                            = "Standard_B1s"
  resource_group_name             = "fx-compute-resource-group-name"
  os_disk {
    storage_account_type = "Standard_LRS"
    caching              = "None"
  }
  network_interface_ids = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/networkInterfaces/fx-compute-network-interface-ids"]
  location              = "westeurope"
  name                  = "compute"
}

resource "azurerm_container_app" "containers" {
  template {
    container {
      name   = "fx-containers-name"
      memory = "fx-containers-memory"
      image  = "fx-containers-image"
      cpu    = 1
    }
  }
  revision_mode                = "Single"
  resource_group_name          = "fx-containers-resource-group-name"
  container_app_environment_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.App/managedEnvironments/fx-containers-container-app-environment-id"
  name                         = "containers"
}

resource "azurerm_linux_function_app" "serverless" {
  storage_account_name = "fx833e969e02cc"
  site_config {
  }
  service_plan_id     = azurerm_service_plan.serverless.id
  resource_group_name = "fx-serverless-resource-group-name"
  location            = "westeurope"
  name                = "serverless"
}

# A literal plan ID makes the provider read the plan while planning; the
# fixture plans offline, so the function app uses a plan it creates.
resource "azurerm_service_plan" "serverless" {
  name                = "serverless-plan"
  resource_group_name = "fx-serverless-resource-group-name"
  location            = "westeurope"
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_nat_gateway" "network" {
  resource_group_name = "fx-network-resource-group-name"
  location            = "westeurope"
  name                = "network"
}

resource "azurerm_cdn_frontdoor_profile" "load_balancing" {
  sku_name            = "Premium_AzureFrontDoor"
  resource_group_name = "fx-load-balancing-resource-group-name"
  name                = "load-balancing"
}

resource "azurerm_dns_zone" "dns" {
  resource_group_name = "fx-dns-resource-group-name"
  name                = "example.invalid"
}

resource "azurerm_storage_container" "storage" {
  storage_account_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Storage/storageAccounts/fx-storage-storage-account-id"
  name               = "storage"
}

resource "azurerm_cosmosdb_account" "database" {
  resource_group_name = "fx-database-resource-group-name"
  offer_type          = "Standard"
  location            = "westeurope"
  geo_location {
    location          = "westeurope"
    failover_priority = 1
  }
  consistency_policy {
    consistency_level = "BoundedStaleness"
  }
  name = "database"
}

resource "azurerm_data_factory" "analytics" {
  resource_group_name = "fx-analytics-resource-group-name"
  location            = "westeurope"
  name                = "analytics"
}

resource "azurerm_servicebus_namespace" "messaging" {
  sku                 = "Basic"
  resource_group_name = "fx-messaging-resource-group-name"
  location            = "westeurope"
  name                = "messaging"
}

resource "azurerm_ai_foundry" "ai" {
  storage_account_id  = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Storage/storageAccounts/fx-ai-storage-account-id"
  resource_group_name = "fx-ai-resource-group-name"
  location            = "westeurope"
  key_vault_id        = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.KeyVault/vaults/fx-ai-key-vault-id"
  identity {
    type = "UserAssigned"
  }
  name = "ai0"
}

resource "azuread_group" "identity" {
  mail_enabled = false
  display_name = "identity"
}

resource "azurerm_key_vault" "security" {
  tenant_id                  = "00000000-0000-0000-0000-000000000001"
  sku_name                   = "standard"
  resource_group_name        = "fx-security-resource-group-name"
  rbac_authorization_enabled = false
  location                   = "westeurope"
  name                       = "security"
}

resource "azurerm_api_management" "api" {
  sku_name            = "Developer_1"
  resource_group_name = "fx-api-resource-group-name"
  publisher_name      = "fx-api-publisher-name"
  publisher_email     = "fixture@example.com"
  location            = "westeurope"
  name                = "api"
}

resource "azurerm_monitor_workspace" "operations" {
  resource_group_name = "fx-operations-resource-group-name"
  location            = "westeurope"
  name                = "operations"
}

resource "azurerm_dev_center" "developer" {
  resource_group_name = "fx-developer-resource-group-name"
  location            = "westeurope"
  name                = "developer"
}

resource "azurerm_arc_machine" "hybrid" {
  resource_group_name = "fx-hybrid-resource-group-name"
  location            = "westeurope"
  kind                = "AVS"
  name                = "hybrid"
}

resource "azurerm_database_migration_service" "migration" {
  subnet_id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-migration-subnet-id"
  sku_name            = "Premium_4vCores"
  resource_group_name = "fx-migration-resource-group-name"
  location            = "westeurope"
  name                = "migration"
}

resource "azurerm_iothub" "iot" {
  sku {
    name     = "B1"
    capacity = 1
  }
  resource_group_name = "fx-iot-resource-group-name"
  location            = "westeurope"
  name                = "iot"
}

resource "azurerm_communication_service" "communication" {
  resource_group_name = "fx-communication-resource-group-name"
  data_location       = "Africa"
  name                = "communication"
}

resource "azurerm_management_group" "governance" {

  display_name = "governance"

}
resource "azapi_resource" "horizondb" {
  type      = "Microsoft.HorizonDb/clusters@2026-01-20-preview"
  name      = "horizondb"
  parent_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/synthetic"
}

resource "azapi_resource" "sre" {
  type      = "Microsoft.App/agents@2026-01-01"
  name      = "sre"
  parent_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/synthetic"
}

resource "azapi_resource" "enclave" {
  type      = "Microsoft.Mission/virtualEnclaves@2026-03-01-preview"
  name      = "enclave"
  parent_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/synthetic"
}
