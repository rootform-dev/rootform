# Reproducible Rootform Playground source. This is an architecture example, not a deployment recipe.
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "entra_tenant_id" {
  description = "Microsoft Entra tenant that owns the platform identities."
  type        = string
}

variable "ocr_api_key" {
  description = "API key of the document OCR provider, stored in Key Vault."
  type        = string
  sensitive   = true
}

variable "notifications_smtp_password" {
  description = "Password of the transactional e-mail relay used by the notification function."
  type        = string
  sensitive   = true
}

locals {
  location = "westeurope"
  tags = {
    environment = "production"
    system      = "claims"
    owner       = "claims-platform"
    cost_center = "CC-7720"
  }
}

# Ownership: three resource groups split the platform by lifecycle.

resource "azurerm_resource_group" "prod" {
  name     = "rg-claims-prod"
  location = local.location
  tags     = local.tags
}

resource "azurerm_resource_group" "data" {
  name     = "rg-claims-data"
  location = local.location
  tags     = local.tags
}

resource "azurerm_resource_group" "ops" {
  name     = "rg-claims-ops"
  location = local.location
  tags     = local.tags
}

# Network: one virtual network with integration, Container Apps, and private endpoint subnets behind a NAT gateway.

resource "azurerm_virtual_network" "claims" {
  name                = "vnet-claims-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  address_space       = ["10.30.0.0/16"]
  tags                = local.tags
}

resource "azurerm_subnet" "functions" {
  name                 = "snet-functions"
  resource_group_name  = azurerm_resource_group.prod.name
  virtual_network_name = azurerm_virtual_network.claims.name
  address_prefixes     = ["10.30.1.0/24"]

  delegation {
    name = "app-service"

    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "cae" {
  name                 = "snet-cae"
  resource_group_name  = azurerm_resource_group.prod.name
  virtual_network_name = azurerm_virtual_network.claims.name
  address_prefixes     = ["10.30.4.0/23"]

  delegation {
    name = "container-apps"

    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "private" {
  name                 = "snet-private"
  resource_group_name  = azurerm_resource_group.prod.name
  virtual_network_name = azurerm_virtual_network.claims.name
  address_prefixes     = ["10.30.8.0/24"]
}

resource "azurerm_public_ip" "natgw" {
  name                = "pip-natgw-claims-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = ["1", "2", "3"]
  tags                = local.tags
}

resource "azurerm_nat_gateway" "prod" {
  name                    = "natgw-claims-prod"
  location                = azurerm_resource_group.prod.location
  resource_group_name     = azurerm_resource_group.prod.name
  sku_name                = "Standard"
  idle_timeout_in_minutes = 10
  tags                    = local.tags
}

resource "azurerm_nat_gateway_public_ip_association" "prod" {
  nat_gateway_id       = azurerm_nat_gateway.prod.id
  public_ip_address_id = azurerm_public_ip.natgw.id
}

resource "azurerm_subnet_nat_gateway_association" "functions" {
  subnet_id      = azurerm_subnet.functions.id
  nat_gateway_id = azurerm_nat_gateway.prod.id
}

resource "azurerm_subnet_nat_gateway_association" "cae" {
  subnet_id      = azurerm_subnet.cae.id
  nat_gateway_id = azurerm_nat_gateway.prod.id
}

# Private DNS zones for private link, linked to the virtual network.

resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "queue" {
  name                = "privatelink.queue.core.windows.net"
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "cosmos" {
  name                = "privatelink.documents.azure.com"
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "key_vault" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "service_bus" {
  name                = "privatelink.servicebus.windows.net"
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "blob" {
  name                = "link-blob-claims"
  private_dns_zone_id = azurerm_private_dns_zone.blob.id
  virtual_network_id  = azurerm_virtual_network.claims.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "queue" {
  name                = "link-queue-claims"
  private_dns_zone_id = azurerm_private_dns_zone.queue.id
  virtual_network_id  = azurerm_virtual_network.claims.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "cosmos" {
  name                = "link-cosmos-claims"
  private_dns_zone_id = azurerm_private_dns_zone.cosmos.id
  virtual_network_id  = azurerm_virtual_network.claims.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "key_vault" {
  name                = "link-kv-claims"
  private_dns_zone_id = azurerm_private_dns_zone.key_vault.id
  virtual_network_id  = azurerm_virtual_network.claims.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "service_bus" {
  name                = "link-sb-claims"
  private_dns_zone_id = azurerm_private_dns_zone.service_bus.id
  virtual_network_id  = azurerm_virtual_network.claims.id
}

# Observability: one workspace receives Application Insights telemetry and Container Apps logs.

resource "azurerm_log_analytics_workspace" "prod" {
  name                = "log-claims-prod"
  location            = azurerm_resource_group.ops.location
  resource_group_name = azurerm_resource_group.ops.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_application_insights" "prod" {
  name                = "appi-claims-prod"
  location            = azurerm_resource_group.ops.location
  resource_group_name = azurerm_resource_group.ops.name
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.prod.id
  tags                = local.tags
}

# Identity: one user-assigned identity per runtime family.

resource "azurerm_user_assigned_identity" "functions" {
  name                = "id-claims-functions"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "apps" {
  name                = "id-claims-apps"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

# Data: Cosmos DB, the documents storage account, and Key Vault, each behind a private endpoint.

resource "azurerm_cosmosdb_account" "claims" {
  name                          = "cosmos-claims-prod"
  location                      = azurerm_resource_group.data.location
  resource_group_name           = azurerm_resource_group.data.name
  offer_type                    = "Standard"
  kind                          = "GlobalDocumentDB"
  automatic_failover_enabled    = true
  minimal_tls_version           = "Tls12"
  public_network_access_enabled = false
  tags                          = local.tags

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = "westeurope"
    failover_priority = 0
    zone_redundant    = true
  }

  geo_location {
    location          = "northeurope"
    failover_priority = 1
  }
}

resource "azurerm_cosmosdb_sql_database" "claims" {
  name                = "claims"
  resource_group_name = azurerm_resource_group.data.name
  account_name        = azurerm_cosmosdb_account.claims.name
}

resource "azurerm_cosmosdb_sql_container" "claims" {
  name                  = "claims"
  resource_group_name   = azurerm_resource_group.data.name
  account_name          = azurerm_cosmosdb_account.claims.name
  database_name         = azurerm_cosmosdb_sql_database.claims.name
  partition_key_paths   = ["/policyNumber"]
  partition_key_version = 2

  autoscale_settings {
    max_throughput = 4000
  }
}

resource "azurerm_cosmosdb_sql_container" "fraud_scores" {
  name                  = "fraud-scores"
  resource_group_name   = azurerm_resource_group.data.name
  account_name          = azurerm_cosmosdb_account.claims.name
  database_name         = azurerm_cosmosdb_sql_database.claims.name
  partition_key_paths   = ["/claimId"]
  partition_key_version = 2
  default_ttl           = 7776000

  autoscale_settings {
    max_throughput = 1000
  }
}

resource "azurerm_private_endpoint" "cosmos" {
  name                = "pe-cosmos-claims-prod"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.private.id
  tags                = local.tags

  private_service_connection {
    name                           = "sql"
    private_connection_resource_id = azurerm_cosmosdb_account.claims.id
    subresource_names              = ["Sql"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.cosmos.id]
  }
}

resource "azurerm_storage_account" "docs" {
  name                            = "stclaimsdocs"
  location                        = azurerm_resource_group.data.location
  resource_group_name             = azurerm_resource_group.data.name
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  shared_access_key_enabled       = false
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = local.tags
}

resource "azurerm_storage_container" "docs_incoming" {
  name                  = "incoming"
  storage_account_id    = azurerm_storage_account.docs.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "docs_processed" {
  name                  = "processed"
  storage_account_id    = azurerm_storage_account.docs.id
  container_access_type = "private"
}

resource "azurerm_storage_queue" "document_scans" {
  name               = "document-scans"
  storage_account_id = azurerm_storage_account.docs.id
}

resource "azurerm_private_endpoint" "docs_blob" {
  name                = "pe-st-claims-docs-blob"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.private.id
  tags                = local.tags

  private_service_connection {
    name                           = "blob"
    private_connection_resource_id = azurerm_storage_account.docs.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }
}

resource "azurerm_private_endpoint" "docs_queue" {
  name                = "pe-st-claims-docs-queue"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.private.id
  tags                = local.tags

  private_service_connection {
    name                           = "queue"
    private_connection_resource_id = azurerm_storage_account.docs.id
    subresource_names              = ["queue"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.queue.id]
  }
}

resource "azurerm_storage_account" "archive" {
  name                            = "stclaimsarchive"
  location                        = azurerm_resource_group.data.location
  resource_group_name             = azurerm_resource_group.data.name
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = "GRS"
  access_tier                     = "Cool"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = true
  tags                            = local.tags
}

resource "azurerm_storage_container" "archive_closed_claims" {
  name                  = "closed-claims"
  storage_account_id    = azurerm_storage_account.archive.id
  container_access_type = "private"
}

resource "azurerm_key_vault" "claims" {
  name                          = "kv-claims-prod"
  location                      = azurerm_resource_group.data.location
  resource_group_name           = azurerm_resource_group.data.name
  tenant_id                     = var.entra_tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  public_network_access_enabled = false
  tags                          = local.tags
}

resource "azurerm_key_vault_secret" "ocr_api_key" {
  name         = "ocr-api-key"
  value        = var.ocr_api_key
  content_type = "text/plain"
  key_vault_id = azurerm_key_vault.claims.id
  tags         = local.tags
}

resource "azurerm_key_vault_secret" "notifications_smtp_password" {
  name         = "notifications-smtp-password"
  value        = var.notifications_smtp_password
  content_type = "text/plain"
  key_vault_id = azurerm_key_vault.claims.id
  tags         = local.tags
}

resource "azurerm_private_endpoint" "key_vault" {
  name                = "pe-kv-claims-prod"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.private.id
  tags                = local.tags

  private_service_connection {
    name                           = "vault"
    private_connection_resource_id = azurerm_key_vault.claims.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.key_vault.id]
  }
}

# Messaging: one Premium Service Bus namespace and one Event Hubs namespace.

resource "azurerm_servicebus_namespace" "prod" {
  name                          = "sb-claims-prod"
  location                      = azurerm_resource_group.prod.location
  resource_group_name           = azurerm_resource_group.prod.name
  sku                           = "Premium"
  capacity                      = 1
  premium_messaging_partitions  = 1
  minimum_tls_version           = "1.2"
  local_auth_enabled            = false
  public_network_access_enabled = false
  tags                          = local.tags
}

resource "azurerm_private_endpoint" "service_bus" {
  name                = "pe-sb-claims-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  subnet_id           = azurerm_subnet.private.id
  tags                = local.tags

  private_service_connection {
    name                           = "namespace"
    private_connection_resource_id = azurerm_servicebus_namespace.prod.id
    subresource_names              = ["namespace"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.service_bus.id]
  }
}

resource "azurerm_servicebus_queue" "claims_review" {
  name                                    = "claims-review"
  namespace_id                            = azurerm_servicebus_namespace.prod.id
  max_delivery_count                      = 10
  lock_duration                           = "PT5M"
  dead_lettering_on_message_expiration    = true
  requires_duplicate_detection            = true
  duplicate_detection_history_time_window = "PT10M"
}

resource "azurerm_servicebus_queue" "notifications" {
  name                                 = "notifications"
  namespace_id                         = azurerm_servicebus_namespace.prod.id
  max_delivery_count                   = 10
  dead_lettering_on_message_expiration = true
}

resource "azurerm_servicebus_queue" "claims_intake_poll" {
  name                                 = "claims-intake-poll"
  namespace_id                         = azurerm_servicebus_namespace.prod.id
  max_delivery_count                   = 5
  dead_lettering_on_message_expiration = true
}

resource "azurerm_servicebus_topic" "claims_events" {
  name             = "claims-events"
  namespace_id     = azurerm_servicebus_namespace.prod.id
  support_ordering = true
}

resource "azurerm_servicebus_subscription" "claims_events_fraud_audit" {
  name               = "fraud-audit"
  topic_id           = azurerm_servicebus_topic.claims_events.id
  max_delivery_count = 10
}

resource "azurerm_servicebus_subscription" "claims_events_notifications" {
  name               = "notifications-dispatch"
  topic_id           = azurerm_servicebus_topic.claims_events.id
  max_delivery_count = 10
  forward_to         = azurerm_servicebus_queue.notifications.name
}

resource "azurerm_eventhub_namespace" "prod" {
  name                          = "evhns-claims-prod"
  location                      = azurerm_resource_group.prod.location
  resource_group_name           = azurerm_resource_group.prod.name
  sku                           = "Standard"
  capacity                      = 2
  auto_inflate_enabled          = true
  maximum_throughput_units      = 8
  minimum_tls_version           = "1.2"
  local_authentication_enabled  = false
  public_network_access_enabled = true
  tags                          = local.tags
}

resource "azurerm_eventhub" "claims_telemetry" {
  name            = "evh-claims-telemetry"
  namespace_id    = azurerm_eventhub_namespace.prod.id
  partition_count = 8

  retention_description {
    cleanup_policy          = "Delete"
    retention_time_in_hours = 168
  }
}

resource "azurerm_eventhub_consumer_group" "fraud_scoring" {
  name                = "fraud-scoring"
  namespace_name      = azurerm_eventhub_namespace.prod.name
  eventhub_name       = azurerm_eventhub.claims_telemetry.name
  resource_group_name = azurerm_resource_group.prod.name
}

# Serverless: Function Apps on one Elastic Premium plan, integrated with the network and reporting to Application Insights.

resource "azurerm_storage_account" "functions" {
  name                            = "stclaimsfunc"
  location                        = azurerm_resource_group.prod.location
  resource_group_name             = azurerm_resource_group.prod.name
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  tags                            = local.tags
}

resource "azurerm_service_plan" "ep1" {
  name                         = "asp-claims-ep1"
  location                     = azurerm_resource_group.prod.location
  resource_group_name          = azurerm_resource_group.prod.name
  os_type                      = "Linux"
  sku_name                     = "EP1"
  maximum_elastic_worker_count = 20
  zone_balancing_enabled       = true
  tags                         = local.tags
}

resource "azurerm_linux_function_app" "claims_intake" {
  name                          = "func-claims-intake"
  location                      = azurerm_resource_group.prod.location
  resource_group_name           = azurerm_resource_group.prod.name
  service_plan_id               = azurerm_service_plan.ep1.id
  storage_account_name          = azurerm_storage_account.functions.name
  storage_uses_managed_identity = true
  virtual_network_subnet_id     = azurerm_subnet.functions.id
  https_only                    = true
  functions_extension_version   = "~4"
  tags                          = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.functions.id]
  }

  site_config {
    application_insights_connection_string = azurerm_application_insights.prod.connection_string
    vnet_route_all_enabled                 = true

    application_stack {
      node_version = "20"
    }
  }

  app_settings = {
    COSMOS_ACCOUNT_ENDPOINT   = azurerm_cosmosdb_account.claims.endpoint
    DOCS_STORAGE_ACCOUNT      = azurerm_storage_account.docs.name
    EVENTGRID_DOMAIN_ENDPOINT = azurerm_eventgrid_domain.claims.endpoint
    KEY_VAULT_URI             = azurerm_key_vault.claims.vault_uri
  }
}

resource "azurerm_linux_function_app" "fraud_scoring" {
  name                          = "func-fraud-scoring"
  location                      = azurerm_resource_group.prod.location
  resource_group_name           = azurerm_resource_group.prod.name
  service_plan_id               = azurerm_service_plan.ep1.id
  storage_account_name          = azurerm_storage_account.functions.name
  storage_uses_managed_identity = true
  virtual_network_subnet_id     = azurerm_subnet.functions.id
  https_only                    = true
  functions_extension_version   = "~4"
  tags                          = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.functions.id]
  }

  site_config {
    application_insights_connection_string = azurerm_application_insights.prod.connection_string
    vnet_route_all_enabled                 = true

    application_stack {
      node_version = "20"
    }
  }

  app_settings = {
    COSMOS_ACCOUNT_ENDPOINT   = azurerm_cosmosdb_account.claims.endpoint
    EVENTGRID_DOMAIN_ENDPOINT = azurerm_eventgrid_domain.claims.endpoint
    EVENTHUB_NAMESPACE        = azurerm_eventhub_namespace.prod.name
  }
}

resource "azurerm_linux_function_app" "notifications" {
  name                          = "func-notifications"
  location                      = azurerm_resource_group.prod.location
  resource_group_name           = azurerm_resource_group.prod.name
  service_plan_id               = azurerm_service_plan.ep1.id
  storage_account_name          = azurerm_storage_account.functions.name
  storage_uses_managed_identity = true
  virtual_network_subnet_id     = azurerm_subnet.functions.id
  https_only                    = true
  functions_extension_version   = "~4"
  tags                          = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.functions.id]
  }

  site_config {
    application_insights_connection_string = azurerm_application_insights.prod.connection_string
    vnet_route_all_enabled                 = true

    application_stack {
      node_version = "20"
    }
  }

  app_settings = {
    SERVICEBUS_NAMESPACE = azurerm_servicebus_namespace.prod.name
    NOTIFICATIONS_QUEUE  = azurerm_servicebus_queue.notifications.name
    KEY_VAULT_URI        = azurerm_key_vault.claims.vault_uri
  }
}

resource "azurerm_linux_function_app" "claims_poller" {
  name                          = "func-claims-poller"
  location                      = azurerm_resource_group.prod.location
  resource_group_name           = azurerm_resource_group.prod.name
  service_plan_id               = azurerm_service_plan.ep1.id
  storage_account_name          = azurerm_storage_account.functions.name
  storage_uses_managed_identity = true
  virtual_network_subnet_id     = azurerm_subnet.functions.id
  https_only                    = true
  functions_extension_version   = "~4"
  tags                          = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.functions.id]
  }

  site_config {
    application_insights_connection_string = azurerm_application_insights.prod.connection_string
    vnet_route_all_enabled                 = true

    application_stack {
      node_version = "18"
    }
  }

  app_settings = {
    SERVICEBUS_NAMESPACE = azurerm_servicebus_namespace.prod.name
    INTAKE_POLL_QUEUE    = azurerm_servicebus_queue.claims_intake_poll.name
    POLL_SCHEDULE        = "0 */5 * * * *"
  }
}

# Container Apps: the environment sits in its subnet and sends logs to the workspace; apps run inside it.

resource "azurerm_container_app_environment" "prod" {
  name                           = "cae-claims-prod"
  location                       = azurerm_resource_group.prod.location
  resource_group_name            = azurerm_resource_group.prod.name
  infrastructure_subnet_id       = azurerm_subnet.cae.id
  log_analytics_workspace_id     = azurerm_log_analytics_workspace.prod.id
  internal_load_balancer_enabled = true
  zone_redundancy_enabled        = true
  tags                           = local.tags

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

resource "azurerm_container_app" "claims_api" {
  name                         = "ca-claims-api"
  resource_group_name          = azurerm_resource_group.prod.name
  container_app_environment_id = azurerm_container_app_environment.prod.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.apps.id]
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = 2
    max_replicas = 20

    container {
      name   = "claims-api"
      image  = "ghcr.io/example-insurance/claims-api:2026.09.1"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "COSMOS_ACCOUNT_ENDPOINT"
        value = azurerm_cosmosdb_account.claims.endpoint
      }

      env {
        name  = "EVENTGRID_DOMAIN_ENDPOINT"
        value = azurerm_eventgrid_domain.claims.endpoint
      }

      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = azurerm_application_insights.prod.connection_string
      }
    }

    http_scale_rule {
      name                = "http-concurrency"
      concurrent_requests = 50
    }
  }
}

# Edge: API Management fronts the claims API.

resource "azurerm_api_management" "claims" {
  name                = "apim-claims-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  publisher_name      = "Example Insurance"
  publisher_email     = "api-platform@example-insurance.invalid"
  sku_name            = "StandardV2_1"
  tags                = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.apps.id]
  }
}

# Eventing: the Event Grid domain carries claim events; the system topic carries document events.

resource "azurerm_eventgrid_domain" "claims" {
  name                          = "evgd-claims-prod"
  location                      = azurerm_resource_group.prod.location
  resource_group_name           = azurerm_resource_group.prod.name
  input_schema                  = "CloudEventSchemaV1_0"
  local_auth_enabled            = false
  public_network_access_enabled = true
  tags                          = local.tags

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_eventgrid_domain_topic" "claims_submitted" {
  name                = "claims-submitted"
  domain_name         = azurerm_eventgrid_domain.claims.name
  resource_group_name = azurerm_resource_group.prod.name
}

resource "azurerm_eventgrid_domain_topic" "claims_scored" {
  name                = "claims-scored"
  domain_name         = azurerm_eventgrid_domain.claims.name
  resource_group_name = azurerm_resource_group.prod.name
}

resource "azurerm_eventgrid_domain_topic" "documents_processed" {
  name                = "documents-processed"
  domain_name         = azurerm_eventgrid_domain.claims.name
  resource_group_name = azurerm_resource_group.prod.name
}

resource "azurerm_eventgrid_event_subscription" "claims_scored_review" {
  name                  = "evgs-claims-scored-review"
  scope                 = azurerm_eventgrid_domain_topic.claims_scored.id
  event_delivery_schema = "CloudEventSchemaV1_0"
  service_bus_queue_id  = azurerm_servicebus_queue.claims_review.id

  delivery_identity {
    type = "SystemAssigned"
  }

  retry_policy {
    max_delivery_attempts = 30
    event_time_to_live    = 1440
  }
}

resource "azurerm_eventgrid_system_topic" "docs" {
  name                = "evgst-stclaimsdocs"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  source_resource_id  = azurerm_storage_account.docs.id
  topic_type          = "Microsoft.Storage.StorageAccounts"
  tags                = local.tags
}

resource "azurerm_eventgrid_system_topic_event_subscription" "docs_intake" {
  name                 = "evgs-docs-intake"
  system_topic         = azurerm_eventgrid_system_topic.docs.name
  resource_group_name  = azurerm_resource_group.data.name
  included_event_types = ["Microsoft.Storage.BlobCreated"]

  subject_filter {
    subject_begins_with = "/blobServices/default/containers/incoming/"
  }

  azure_function_endpoint {
    function_id = azurerm_linux_function_app.claims_intake.id
  }

  retry_policy {
    max_delivery_attempts = 30
    event_time_to_live    = 1440
  }
}
