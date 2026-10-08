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

provider "azurerm" {
  features {}
}

variable "entra_tenant_id" {
  description = "Microsoft Entra tenant that owns the platform identities."
  type        = string
}

variable "dba_group_object_id" {
  description = "Object ID of the Entra group that administers the data tier."
  type        = string
}

variable "payments_psp_api_key" {
  description = "API key of the external payment service provider, stored in Key Vault."
  type        = string
  sensitive   = true
}

variable "notifications_smtp_password" {
  description = "Password of the transactional e-mail relay used by the notification workers."
  type        = string
  sensitive   = true
}

locals {
  location = "westeurope"
  tags = {
    environment = "production"
    system      = "commerce"
    owner       = "platform-engineering"
    cost_center = "CC-4410"
  }
}

# Ownership: four resource groups split the platform by lifecycle.

resource "azurerm_resource_group" "hub" {
  name     = "rg-commerce-hub"
  location = local.location
  tags     = local.tags
}

resource "azurerm_resource_group" "prod" {
  name     = "rg-commerce-prod"
  location = local.location
  tags     = local.tags
}

resource "azurerm_resource_group" "data" {
  name     = "rg-commerce-data"
  location = local.location
  tags     = local.tags
}

resource "azurerm_resource_group" "ops" {
  name     = "rg-commerce-ops"
  location = local.location
  tags     = local.tags
}

# Hub network: edge and shared services.

resource "azurerm_virtual_network" "hub" {
  name                = "vnet-commerce-hub"
  location            = azurerm_resource_group.hub.location
  resource_group_name = azurerm_resource_group.hub.name
  address_space       = ["10.10.0.0/16"]
  tags                = local.tags
}

resource "azurerm_subnet" "hub_appgw" {
  name                 = "snet-appgw"
  resource_group_name  = azurerm_resource_group.hub.name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = ["10.10.1.0/24"]
}

resource "azurerm_subnet" "hub_shared" {
  name                              = "snet-shared"
  resource_group_name               = azurerm_resource_group.hub.name
  virtual_network_name              = azurerm_virtual_network.hub.name
  address_prefixes                  = ["10.10.2.0/24"]
  private_endpoint_network_policies = "Disabled"
}

resource "azurerm_virtual_network_peering" "hub_to_prod" {
  name                      = "peer-hub-to-prod"
  resource_group_name       = azurerm_resource_group.hub.name
  virtual_network_name      = azurerm_virtual_network.hub.name
  remote_virtual_network_id = azurerm_virtual_network.prod.id
  allow_forwarded_traffic   = true
}

resource "azurerm_virtual_network_peering" "prod_to_hub" {
  name                      = "peer-prod-to-hub"
  resource_group_name       = azurerm_resource_group.prod.name
  virtual_network_name      = azurerm_virtual_network.prod.name
  remote_virtual_network_id = azurerm_virtual_network.hub.id
  allow_forwarded_traffic   = true
}

resource "azurerm_user_assigned_identity" "appgw" {
  name                = "id-agw-commerce-hub"
  location            = azurerm_resource_group.hub.location
  resource_group_name = azurerm_resource_group.hub.name
  tags                = local.tags
}

resource "azurerm_public_ip" "appgw" {
  name                = "pip-agw-commerce-hub"
  location            = azurerm_resource_group.hub.location
  resource_group_name = azurerm_resource_group.hub.name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = ["1", "2", "3"]
  tags                = local.tags
}

resource "azurerm_web_application_firewall_policy" "hub" {
  name                = "wafpol-commerce-hub"
  location            = azurerm_resource_group.hub.location
  resource_group_name = azurerm_resource_group.hub.name
  tags                = local.tags

  policy_settings {
    enabled            = true
    mode               = "Prevention"
    request_body_check = true
  }

  managed_rules {
    managed_rule_set {
      type    = "OWASP"
      version = "3.2"
    }
  }
}

resource "azurerm_application_gateway" "hub" {
  name                = "agw-commerce-hub"
  location            = azurerm_resource_group.hub.location
  resource_group_name = azurerm_resource_group.hub.name
  firewall_policy_id  = azurerm_web_application_firewall_policy.hub.id
  zones               = ["1", "2", "3"]
  tags                = local.tags

  sku {
    name = "WAF_v2"
    tier = "WAF_v2"
  }

  autoscale_configuration {
    min_capacity = 2
    max_capacity = 10
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.appgw.id]
  }

  gateway_ip_configuration {
    name      = "gateway-ip"
    subnet_id = azurerm_subnet.hub_appgw.id
  }

  frontend_port {
    name = "https"
    port = 443
  }

  frontend_ip_configuration {
    name                 = "public"
    public_ip_address_id = azurerm_public_ip.appgw.id
  }

  backend_address_pool {
    name         = "aks-ingress"
    ip_addresses = ["10.20.3.250"]
  }

  backend_http_settings {
    name                  = "https-ingress"
    cookie_based_affinity = "Disabled"
    port                  = 443
    protocol              = "Https"
    host_name             = "shop.brightcart.io"
    request_timeout       = 30
  }

  ssl_certificate {
    name                = "shop-brightcart-io"
    key_vault_secret_id = "${azurerm_key_vault.platform.vault_uri}secrets/shop-brightcart-io"
  }

  http_listener {
    name                           = "shop-https"
    frontend_ip_configuration_name = "public"
    frontend_port_name             = "https"
    protocol                       = "Https"
    host_name                      = "shop.brightcart.io"
    ssl_certificate_name           = "shop-brightcart-io"
  }

  request_routing_rule {
    name                       = "shop-https"
    priority                   = 100
    rule_type                  = "Basic"
    http_listener_name         = "shop-https"
    backend_address_pool_name  = "aks-ingress"
    backend_http_settings_name = "https-ingress"
  }
}

# Public DNS: the apex alias record points at the Application Gateway public IP.

resource "azurerm_dns_zone" "public" {
  name                = "brightcart.io"
  resource_group_name = azurerm_resource_group.hub.name
  tags                = local.tags
}

resource "azurerm_dns_a_record" "apex" {
  name                = "@"
  zone_name           = azurerm_dns_zone.public.name
  resource_group_name = azurerm_resource_group.hub.name
  ttl                 = 300
  target_resource_id  = azurerm_public_ip.appgw.id
}

resource "azurerm_dns_cname_record" "www" {
  name                = "www"
  zone_name           = azurerm_dns_zone.public.name
  resource_group_name = azurerm_resource_group.hub.name
  ttl                 = 3600
  record              = "brightcart.io"
}

# Private DNS zones for private link, linked to both virtual networks.

resource "azurerm_private_dns_zone" "acr" {
  name                = "privatelink.azurecr.io"
  resource_group_name = azurerm_resource_group.hub.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "key_vault" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = azurerm_resource_group.hub.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "sql" {
  name                = "privatelink.database.windows.net"
  resource_group_name = azurerm_resource_group.hub.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.hub.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "service_bus" {
  name                = "privatelink.servicebus.windows.net"
  resource_group_name = azurerm_resource_group.hub.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone" "postgres" {
  name                = "commerce.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.hub.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "acr_hub" {
  name                = "link-acr-hub"
  private_dns_zone_id = azurerm_private_dns_zone.acr.id
  virtual_network_id  = azurerm_virtual_network.hub.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "acr_prod" {
  name                = "link-acr-prod"
  private_dns_zone_id = azurerm_private_dns_zone.acr.id
  virtual_network_id  = azurerm_virtual_network.prod.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "key_vault_hub" {
  name                = "link-key-vault-hub"
  private_dns_zone_id = azurerm_private_dns_zone.key_vault.id
  virtual_network_id  = azurerm_virtual_network.hub.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "key_vault_prod" {
  name                = "link-key-vault-prod"
  private_dns_zone_id = azurerm_private_dns_zone.key_vault.id
  virtual_network_id  = azurerm_virtual_network.prod.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "sql_hub" {
  name                = "link-sql-hub"
  private_dns_zone_id = azurerm_private_dns_zone.sql.id
  virtual_network_id  = azurerm_virtual_network.hub.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "sql_prod" {
  name                = "link-sql-prod"
  private_dns_zone_id = azurerm_private_dns_zone.sql.id
  virtual_network_id  = azurerm_virtual_network.prod.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "blob_hub" {
  name                = "link-blob-hub"
  private_dns_zone_id = azurerm_private_dns_zone.blob.id
  virtual_network_id  = azurerm_virtual_network.hub.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "blob_prod" {
  name                = "link-blob-prod"
  private_dns_zone_id = azurerm_private_dns_zone.blob.id
  virtual_network_id  = azurerm_virtual_network.prod.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "service_bus_hub" {
  name                = "link-service-bus-hub"
  private_dns_zone_id = azurerm_private_dns_zone.service_bus.id
  virtual_network_id  = azurerm_virtual_network.hub.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "service_bus_prod" {
  name                = "link-service-bus-prod"
  private_dns_zone_id = azurerm_private_dns_zone.service_bus.id
  virtual_network_id  = azurerm_virtual_network.prod.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres_hub" {
  name                = "link-postgres-hub"
  private_dns_zone_id = azurerm_private_dns_zone.postgres.id
  virtual_network_id  = azurerm_virtual_network.hub.id
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres_prod" {
  name                = "link-postgres-prod"
  private_dns_zone_id = azurerm_private_dns_zone.postgres.id
  virtual_network_id  = azurerm_virtual_network.prod.id
}

# Shared services reachable only through private endpoints in the hub.

resource "azurerm_container_registry" "platform" {
  name                          = "acrcommerceplatform"
  location                      = azurerm_resource_group.hub.location
  resource_group_name           = azurerm_resource_group.hub.name
  sku                           = "Premium"
  admin_enabled                 = false
  public_network_access_enabled = false
  zone_redundancy_enabled       = true
  tags                          = local.tags
}

resource "azurerm_private_endpoint" "acr" {
  name                = "pe-acr-commerce-platform"
  location            = azurerm_resource_group.hub.location
  resource_group_name = azurerm_resource_group.hub.name
  subnet_id           = azurerm_subnet.hub_shared.id
  tags                = local.tags

  private_service_connection {
    name                           = "acr"
    private_connection_resource_id = azurerm_container_registry.platform.id
    subresource_names              = ["registry"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.acr.id]
  }
}

resource "azurerm_key_vault" "platform" {
  name                          = "kv-commerce-prod"
  location                      = azurerm_resource_group.hub.location
  resource_group_name           = azurerm_resource_group.hub.name
  tenant_id                     = var.entra_tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  public_network_access_enabled = false
  tags                          = local.tags
}

resource "azurerm_key_vault_secret" "payments_psp_api_key" {
  name         = "payments-psp-api-key"
  value        = var.payments_psp_api_key
  content_type = "text/plain"
  key_vault_id = azurerm_key_vault.platform.id
  tags         = local.tags
}

resource "azurerm_key_vault_secret" "notifications_smtp_password" {
  name         = "notifications-smtp-password"
  value        = var.notifications_smtp_password
  content_type = "text/plain"
  key_vault_id = azurerm_key_vault.platform.id
  tags         = local.tags
}

resource "azurerm_key_vault_key" "token_signing" {
  name         = "key-commerce-token-signing"
  key_vault_id = azurerm_key_vault.platform.id
  key_type     = "RSA"
  key_size     = 3072
  key_opts     = ["sign", "verify"]
  tags         = local.tags

  rotation_policy {
    expire_after         = "P365D"
    notify_before_expiry = "P30D"

    automatic {
      time_before_expiry = "P60D"
    }
  }
}

resource "azurerm_private_endpoint" "key_vault" {
  name                = "pe-kv-commerce-prod"
  location            = azurerm_resource_group.hub.location
  resource_group_name = azurerm_resource_group.hub.name
  subnet_id           = azurerm_subnet.hub_shared.id
  tags                = local.tags

  private_service_connection {
    name                           = "key-vault"
    private_connection_resource_id = azurerm_key_vault.platform.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.key_vault.id]
  }
}

# Production network: AKS, data, and integration subnets.

resource "azurerm_virtual_network" "prod" {
  name                = "vnet-commerce-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  address_space       = ["10.20.0.0/16"]
  tags                = local.tags
}

resource "azurerm_subnet" "prod_aks_system" {
  name                 = "snet-aks-system"
  resource_group_name  = azurerm_resource_group.prod.name
  virtual_network_name = azurerm_virtual_network.prod.name
  address_prefixes     = ["10.20.0.0/23"]
}

resource "azurerm_subnet" "prod_aks_user" {
  name                 = "snet-aks-user"
  resource_group_name  = azurerm_resource_group.prod.name
  virtual_network_name = azurerm_virtual_network.prod.name
  address_prefixes     = ["10.20.2.0/23"]
}

resource "azurerm_subnet" "prod_data" {
  name                              = "snet-data"
  resource_group_name               = azurerm_resource_group.prod.name
  virtual_network_name              = azurerm_virtual_network.prod.name
  address_prefixes                  = ["10.20.4.0/24"]
  private_endpoint_network_policies = "Disabled"
}

resource "azurerm_subnet" "prod_integration" {
  name                 = "snet-integration"
  resource_group_name  = azurerm_resource_group.prod.name
  virtual_network_name = azurerm_virtual_network.prod.name
  address_prefixes     = ["10.20.5.0/24"]

  delegation {
    name = "app-service"

    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "prod_postgres" {
  name                 = "snet-postgres"
  resource_group_name  = azurerm_resource_group.prod.name
  virtual_network_name = azurerm_virtual_network.prod.name
  address_prefixes     = ["10.20.6.0/24"]

  delegation {
    name = "postgres-flexible-server"

    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "prod_legacy" {
  name                 = "snet-legacy"
  resource_group_name  = azurerm_resource_group.prod.name
  virtual_network_name = azurerm_virtual_network.prod.name
  address_prefixes     = ["10.20.9.0/24"]

  delegation {
    name = "app-service"

    service_delegation {
      name    = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_public_ip" "natgw" {
  name                = "pip-natgw-commerce-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = ["1"]
  tags                = local.tags
}

resource "azurerm_nat_gateway" "prod" {
  name                    = "natgw-commerce-prod"
  location                = azurerm_resource_group.prod.location
  resource_group_name     = azurerm_resource_group.prod.name
  sku_name                = "Standard"
  idle_timeout_in_minutes = 10
  zones                   = ["1"]
  tags                    = local.tags
}

resource "azurerm_nat_gateway_public_ip_association" "prod" {
  nat_gateway_id       = azurerm_nat_gateway.prod.id
  public_ip_address_id = azurerm_public_ip.natgw.id
}

resource "azurerm_subnet_nat_gateway_association" "aks_system" {
  subnet_id      = azurerm_subnet.prod_aks_system.id
  nat_gateway_id = azurerm_nat_gateway.prod.id
}

resource "azurerm_subnet_nat_gateway_association" "aks_user" {
  subnet_id      = azurerm_subnet.prod_aks_user.id
  nat_gateway_id = azurerm_nat_gateway.prod.id
}

resource "azurerm_subnet_nat_gateway_association" "integration" {
  subnet_id      = azurerm_subnet.prod_integration.id
  nat_gateway_id = azurerm_nat_gateway.prod.id
}

# Identity.

resource "azurerm_user_assigned_identity" "aks" {
  name                = "id-aks-commerce-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "checkout" {
  name                = "id-checkout-commerce-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "orders" {
  name                = "id-orders-commerce-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "functions" {
  name                = "id-func-commerce-prod"
  location            = azurerm_resource_group.prod.location
  resource_group_name = azurerm_resource_group.prod.name
  tags                = local.tags
}

# Observability.

resource "azurerm_log_analytics_workspace" "prod" {
  name                = "log-commerce-prod"
  location            = azurerm_resource_group.ops.location
  resource_group_name = azurerm_resource_group.ops.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_application_insights" "prod" {
  name                = "appi-commerce-prod"
  location            = azurerm_resource_group.ops.location
  resource_group_name = azurerm_resource_group.ops.name
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.prod.id
  tags                = local.tags
}

resource "azurerm_log_analytics_solution" "container_insights" {
  solution_name         = "ContainerInsights"
  location              = azurerm_resource_group.ops.location
  resource_group_name   = azurerm_resource_group.ops.name
  workspace_resource_id = azurerm_log_analytics_workspace.prod.id
  workspace_name        = azurerm_log_analytics_workspace.prod.name
  tags                  = local.tags

  plan {
    publisher = "Microsoft"
    product   = "OMSGallery/ContainerInsights"
  }
}

# Compute: one AKS cluster with a system pool and a user pool.

resource "azurerm_kubernetes_cluster" "prod" {
  name                      = "aks-commerce-prod"
  location                  = azurerm_resource_group.prod.location
  resource_group_name       = azurerm_resource_group.prod.name
  dns_prefix                = "aks-commerce-prod"
  sku_tier                  = "Standard"
  oidc_issuer_enabled       = true
  workload_identity_enabled = true
  azure_policy_enabled      = true
  automatic_upgrade_channel = "patch"
  tags                      = local.tags

  default_node_pool {
    name                         = "system"
    vm_size                      = "Standard_D4ds_v5"
    node_count                   = 3
    zones                        = ["1", "2", "3"]
    vnet_subnet_id               = azurerm_subnet.prod_aks_system.id
    only_critical_addons_enabled = true

    upgrade_settings {
      max_surge = "33%"
    }
  }

  node_provisioning_profile {
    mode = "Manual"
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks.id]
  }

  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    network_data_plane  = "cilium"
    network_policy      = "cilium"
    outbound_type       = "userAssignedNATGateway"
    load_balancer_sku   = "standard"
    service_cidr        = "172.20.0.0/16"
    dns_service_ip      = "172.20.0.10"
  }

  oms_agent {
    log_analytics_workspace_id      = azurerm_log_analytics_workspace.prod.id
    msi_auth_for_monitoring_enabled = true
  }
}

resource "azurerm_kubernetes_cluster_node_pool" "apps" {
  name                  = "apps"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.prod.id
  vm_size               = "Standard_D8ds_v5"
  mode                  = "User"
  auto_scaling_enabled  = true
  min_count             = 3
  max_count             = 12
  zones                 = ["1", "2", "3"]
  vnet_subnet_id        = azurerm_subnet.prod_aks_user.id
  tags                  = local.tags

  node_labels = {
    "brightcart.io/workload" = "apps"
  }
}


# Data tier: every store sits in rg-commerce-data behind private connectivity.

resource "azurerm_mssql_server" "prod" {
  name                          = "sql-commerce-prod"
  location                      = azurerm_resource_group.data.location
  resource_group_name           = azurerm_resource_group.data.name
  version                       = "12.0"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false
  tags                          = local.tags

  azuread_administrator {
    login_username              = "sg-commerce-dba"
    object_id                   = var.dba_group_object_id
    tenant_id                   = var.entra_tenant_id
    azuread_authentication_only = true
  }
}

resource "azurerm_mssql_database" "orders" {
  name           = "sqldb-commerce-orders"
  server_id      = azurerm_mssql_server.prod.id
  sku_name       = "GP_Gen5_4"
  max_size_gb    = 256
  zone_redundant = true
  tags           = local.tags
}

resource "azurerm_private_endpoint" "sql" {
  name                = "pe-sql-commerce-prod"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.prod_data.id
  tags                = local.tags

  private_service_connection {
    name                           = "sql"
    private_connection_resource_id = azurerm_mssql_server.prod.id
    subresource_names              = ["sqlServer"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.sql.id]
  }
}

resource "azurerm_postgresql_flexible_server" "prod" {
  name                          = "psql-commerce-prod"
  location                      = azurerm_resource_group.data.location
  resource_group_name           = azurerm_resource_group.data.name
  version                       = "16"
  sku_name                      = "GP_Standard_D4ds_v5"
  storage_mb                    = 262144
  zone                          = "1"
  delegated_subnet_id           = azurerm_subnet.prod_postgres.id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  public_network_access_enabled = false
  tags                          = local.tags

  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = false
    tenant_id                     = var.entra_tenant_id
  }

  high_availability {
    mode                      = "ZoneRedundant"
    standby_availability_zone = "2"
  }
}

resource "azurerm_redis_cache" "prod" {
  name                          = "redis-commerce-prod"
  location                      = azurerm_resource_group.data.location
  resource_group_name           = azurerm_resource_group.data.name
  capacity                      = 1
  family                        = "P"
  sku_name                      = "Premium"
  redis_version                 = "6"
  minimum_tls_version           = "1.2"
  non_ssl_port_enabled          = false
  public_network_access_enabled = true
  tags                          = local.tags
}

resource "azurerm_cosmosdb_account" "catalog" {
  name                          = "cosmos-commerce-catalog"
  location                      = azurerm_resource_group.data.location
  resource_group_name           = azurerm_resource_group.data.name
  offer_type                    = "Standard"
  kind                          = "GlobalDocumentDB"
  automatic_failover_enabled    = true
  minimal_tls_version           = "Tls12"
  public_network_access_enabled = true
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

resource "azurerm_cosmosdb_sql_database" "catalog" {
  name                = "catalog"
  resource_group_name = azurerm_resource_group.data.name
  account_name        = azurerm_cosmosdb_account.catalog.name
}

resource "azurerm_cosmosdb_sql_container" "products" {
  name                  = "products"
  resource_group_name   = azurerm_resource_group.data.name
  account_name          = azurerm_cosmosdb_account.catalog.name
  database_name         = azurerm_cosmosdb_sql_database.catalog.name
  partition_key_paths   = ["/categoryId"]
  partition_key_version = 2

  autoscale_settings {
    max_throughput = 4000
  }
}

resource "azurerm_storage_account" "media" {
  name                            = "stcommercemedia"
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

resource "azurerm_storage_account" "backups" {
  name                            = "stcommercebackups"
  location                        = azurerm_resource_group.data.location
  resource_group_name             = azurerm_resource_group.data.name
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = "GRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  shared_access_key_enabled       = false
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags                            = local.tags
}

resource "azurerm_storage_account" "public" {
  name                            = "stcommercepublic"
  location                        = azurerm_resource_group.data.location
  resource_group_name             = azurerm_resource_group.data.name
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = true
  public_network_access_enabled   = true
  tags                            = local.tags
}

resource "azurerm_storage_container" "media_uploads" {
  name                  = "uploads"
  storage_account_id    = azurerm_storage_account.media.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "media_renditions" {
  name                  = "renditions"
  storage_account_id    = azurerm_storage_account.media.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "backups_exports" {
  name                  = "database-exports"
  storage_account_id    = azurerm_storage_account.backups.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "public_assets" {
  name                  = "assets"
  storage_account_id    = azurerm_storage_account.public.id
  container_access_type = "blob"
}

resource "azurerm_private_endpoint" "media" {
  name                = "pe-st-commerce-media"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.prod_data.id
  tags                = local.tags

  private_service_connection {
    name                           = "blob"
    private_connection_resource_id = azurerm_storage_account.media.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }
}

resource "azurerm_private_endpoint" "backups" {
  name                = "pe-st-commerce-backups"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.prod_data.id
  tags                = local.tags

  private_service_connection {
    name                           = "blob"
    private_connection_resource_id = azurerm_storage_account.backups.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob.id]
  }
}

# Messaging: one Premium Service Bus namespace owns topics, subscriptions and queues.

resource "azurerm_servicebus_namespace" "prod" {
  name                          = "sb-commerce-prod"
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
  name                = "pe-sb-commerce-prod"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  subnet_id           = azurerm_subnet.prod_data.id
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

resource "azurerm_servicebus_topic" "orders" {
  name             = "orders"
  namespace_id     = azurerm_servicebus_namespace.prod.id
  support_ordering = true
}

resource "azurerm_servicebus_topic" "payments" {
  name             = "payments"
  namespace_id     = azurerm_servicebus_namespace.prod.id
  support_ordering = true
}

resource "azurerm_servicebus_queue" "notifications" {
  name                                 = "notifications"
  namespace_id                         = azurerm_servicebus_namespace.prod.id
  max_delivery_count                   = 10
  dead_lettering_on_message_expiration = true
}

resource "azurerm_servicebus_subscription" "orders_fulfillment" {
  name               = "fulfillment"
  topic_id           = azurerm_servicebus_topic.orders.id
  max_delivery_count = 10
}

resource "azurerm_servicebus_subscription" "orders_analytics" {
  name               = "analytics"
  topic_id           = azurerm_servicebus_topic.orders.id
  max_delivery_count = 10
}

resource "azurerm_servicebus_subscription" "payments_ledger" {
  name               = "ledger"
  topic_id           = azurerm_servicebus_topic.payments.id
  max_delivery_count = 10
}

resource "azurerm_servicebus_subscription" "payments_notifications" {
  name               = "notifications"
  topic_id           = azurerm_servicebus_topic.payments.id
  max_delivery_count = 10
  forward_to         = azurerm_servicebus_queue.notifications.name
}

# Serverless: Function Apps integrate with the production network and report to Application Insights.

resource "azurerm_storage_account" "functions" {
  name                            = "stcommercefunc"
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

resource "azurerm_service_plan" "functions" {
  name                   = "asp-commerce-functions"
  location               = azurerm_resource_group.prod.location
  resource_group_name    = azurerm_resource_group.prod.name
  os_type                = "Linux"
  sku_name               = "P1v3"
  zone_balancing_enabled = true
  tags                   = local.tags
}

resource "azurerm_linux_function_app" "media_processor" {
  name                          = "func-commerce-media-processor"
  location                      = azurerm_resource_group.prod.location
  resource_group_name           = azurerm_resource_group.prod.name
  service_plan_id               = azurerm_service_plan.functions.id
  storage_account_name          = azurerm_storage_account.functions.name
  storage_uses_managed_identity = true
  virtual_network_subnet_id     = azurerm_subnet.prod_integration.id
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
    MEDIA_STORAGE_ACCOUNT = azurerm_storage_account.media.name
    SERVICEBUS_NAMESPACE  = azurerm_servicebus_namespace.prod.name
  }
}

resource "azurerm_linux_function_app" "legacy_webhooks" {
  name                          = "func-commerce-legacy-webhooks"
  location                      = azurerm_resource_group.prod.location
  resource_group_name           = azurerm_resource_group.prod.name
  service_plan_id               = azurerm_service_plan.functions.id
  storage_account_name          = azurerm_storage_account.functions.name
  storage_uses_managed_identity = true
  virtual_network_subnet_id     = azurerm_subnet.prod_legacy.id
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
    PUBLIC_STORAGE_ACCOUNT = azurerm_storage_account.public.name
  }
}

# Eventing: system topics on the storage accounts fan blob events out to the processor and to the notifications queue.

resource "azurerm_eventgrid_system_topic" "media" {
  name                = "evgst-stcommercemedia"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  source_resource_id  = azurerm_storage_account.media.id
  topic_type          = "Microsoft.Storage.StorageAccounts"
  tags                = local.tags
}

resource "azurerm_eventgrid_system_topic_event_subscription" "media_processor" {
  name                 = "evgs-media-processor"
  system_topic         = azurerm_eventgrid_system_topic.media.name
  resource_group_name  = azurerm_resource_group.data.name
  included_event_types = ["Microsoft.Storage.BlobCreated"]

  azure_function_endpoint {
    function_id = azurerm_linux_function_app.media_processor.id
  }

  retry_policy {
    max_delivery_attempts = 30
    event_time_to_live    = 1440
  }
}

resource "azurerm_eventgrid_system_topic_event_subscription" "media_notifications" {
  name                 = "evgs-media-notifications"
  system_topic         = azurerm_eventgrid_system_topic.media.name
  resource_group_name  = azurerm_resource_group.data.name
  included_event_types = ["Microsoft.Storage.BlobCreated", "Microsoft.Storage.BlobDeleted"]
  service_bus_queue_id = azurerm_servicebus_queue.notifications.id
}

resource "azurerm_eventgrid_system_topic" "public" {
  name                = "evgst-stcommercepublic"
  location            = azurerm_resource_group.data.location
  resource_group_name = azurerm_resource_group.data.name
  source_resource_id  = azurerm_storage_account.public.id
  topic_type          = "Microsoft.Storage.StorageAccounts"
  tags                = local.tags
}

resource "azurerm_eventgrid_system_topic_event_subscription" "legacy_webhooks" {
  name                 = "evgs-legacy-webhooks"
  system_topic         = azurerm_eventgrid_system_topic.public.name
  resource_group_name  = azurerm_resource_group.data.name
  included_event_types = ["Microsoft.Storage.BlobCreated"]

  azure_function_endpoint {
    function_id = azurerm_linux_function_app.legacy_webhooks.id
  }
}


# Kubernetes: the provider talks to the production cluster, so every namespace and workload runs there.

provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.prod.kube_config[0].host
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.prod.kube_config[0].cluster_ca_certificate)
  client_certificate     = base64decode(azurerm_kubernetes_cluster.prod.kube_config[0].client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.prod.kube_config[0].client_key)
}

resource "kubernetes_namespace_v1" "platform_ingress" {
  metadata {
    name = "platform-ingress"

    labels = {
      "app.kubernetes.io/part-of"          = "commerce"
      "brightcart.io/team"                 = "platform-engineering"
      "pod-security.kubernetes.io/enforce" = "baseline"
    }
  }
}

resource "kubernetes_namespace_v1" "checkout" {
  metadata {
    name = "checkout"

    labels = {
      "app.kubernetes.io/part-of"          = "commerce"
      "brightcart.io/team"                 = "checkout"
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

resource "kubernetes_namespace_v1" "catalog" {
  metadata {
    name = "catalog"

    labels = {
      "app.kubernetes.io/part-of"          = "commerce"
      "brightcart.io/team"                 = "catalog"
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

resource "kubernetes_namespace_v1" "orders" {
  metadata {
    name = "orders"

    labels = {
      "app.kubernetes.io/part-of"          = "commerce"
      "brightcart.io/team"                 = "orders"
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

resource "kubernetes_namespace_v1" "observability" {
  metadata {
    name = "observability"

    labels = {
      "app.kubernetes.io/part-of"          = "commerce"
      "brightcart.io/team"                 = "platform-engineering"
      "pod-security.kubernetes.io/enforce" = "baseline"
    }
  }
}

# Service accounts: one identity per workload.

resource "kubernetes_service_account_v1" "ingress_nginx" {
  metadata {
    name      = "ingress-nginx"
    namespace = kubernetes_namespace_v1.platform_ingress.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "checkout_api" {
  metadata {
    name      = "checkout-api"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name

    labels = {
      "azure.workload.identity/use" = "true"
    }

    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.checkout.client_id
    }
  }
}

resource "kubernetes_service_account_v1" "cart_worker" {
  metadata {
    name      = "cart-worker"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name

    labels = {
      "azure.workload.identity/use" = "true"
    }

    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.checkout.client_id
    }
  }
}

resource "kubernetes_service_account_v1" "payments_api" {
  metadata {
    name      = "payments-api"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name

    labels = {
      "azure.workload.identity/use" = "true"
    }

    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.checkout.client_id
    }
  }
}

resource "kubernetes_service_account_v1" "payments_worker" {
  metadata {
    name      = "payments-worker"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name

    labels = {
      "azure.workload.identity/use" = "true"
    }

    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.checkout.client_id
    }
  }
}

resource "kubernetes_service_account_v1" "catalog_api" {
  metadata {
    name      = "catalog-api"
    namespace = kubernetes_namespace_v1.catalog.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "catalog_search" {
  metadata {
    name      = "catalog-search"
    namespace = kubernetes_namespace_v1.catalog.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "orders_api" {
  metadata {
    name      = "orders-api"
    namespace = kubernetes_namespace_v1.orders.metadata[0].name

    labels = {
      "azure.workload.identity/use" = "true"
    }

    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.orders.client_id
    }
  }
}

resource "kubernetes_service_account_v1" "orders_worker" {
  metadata {
    name      = "orders-worker"
    namespace = kubernetes_namespace_v1.orders.metadata[0].name

    labels = {
      "azure.workload.identity/use" = "true"
    }

    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.orders.client_id
    }
  }
}

resource "kubernetes_service_account_v1" "otel_collector" {
  metadata {
    name      = "otel-collector"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }
}

# Workloads.

resource "kubernetes_deployment_v1" "ingress_nginx_controller" {
  metadata {
    name      = "ingress-nginx-controller"
    namespace = kubernetes_namespace_v1.platform_ingress.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "ingress-nginx"
      "app.kubernetes.io/component" = "controller"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "ingress-nginx"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "ingress-nginx"
          "app.kubernetes.io/component" = "controller"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.ingress_nginx.metadata[0].name

        container {
          name  = "ingress-nginx"
          image = "registry.k8s.io/ingress-nginx/controller:v1.12.1"

          port {
            name           = "http"
            container_port = 443
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "checkout_api" {
  metadata {
    name      = "checkout-api"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "checkout-api"
      "app.kubernetes.io/component" = "api"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "checkout-api"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "checkout-api"
          "app.kubernetes.io/component" = "api"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.checkout_api.metadata[0].name

        container {
          name  = "checkout-api"
          image = "${azurerm_container_registry.platform.login_server}/checkout/api:2025.09.1"

          port {
            name           = "http"
            container_port = 8080
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "cart_worker" {
  metadata {
    name      = "cart-worker"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "cart-worker"
      "app.kubernetes.io/component" = "worker"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "cart-worker"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "cart-worker"
          "app.kubernetes.io/component" = "worker"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.cart_worker.metadata[0].name

        container {
          name  = "cart-worker"
          image = "${azurerm_container_registry.platform.login_server}/checkout/cart-worker:2025.09.1"

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "payments_api" {
  metadata {
    name      = "payments-api"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "payments-api"
      "app.kubernetes.io/component" = "api"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "payments-api"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "payments-api"
          "app.kubernetes.io/component" = "api"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.payments_api.metadata[0].name

        container {
          name  = "payments-api"
          image = "${azurerm_container_registry.platform.login_server}/payments/api:2025.09.1"

          port {
            name           = "http"
            container_port = 8080
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "payments_worker" {
  metadata {
    name      = "payments-worker"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "payments-worker"
      "app.kubernetes.io/component" = "worker"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "payments-worker"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "payments-worker"
          "app.kubernetes.io/component" = "worker"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.payments_worker.metadata[0].name

        container {
          name  = "payments-worker"
          image = "${azurerm_container_registry.platform.login_server}/payments/settlement-worker:2025.09.1"

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "catalog_api" {
  metadata {
    name      = "catalog-api"
    namespace = kubernetes_namespace_v1.catalog.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "catalog-api"
      "app.kubernetes.io/component" = "api"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "catalog-api"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "catalog-api"
          "app.kubernetes.io/component" = "api"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.catalog_api.metadata[0].name

        container {
          name  = "catalog-api"
          image = "${azurerm_container_registry.platform.login_server}/catalog/api:2025.09.1"

          port {
            name           = "http"
            container_port = 8080
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "orders_api" {
  metadata {
    name      = "orders-api"
    namespace = kubernetes_namespace_v1.orders.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "orders-api"
      "app.kubernetes.io/component" = "api"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "orders-api"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "orders-api"
          "app.kubernetes.io/component" = "api"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.orders_api.metadata[0].name

        container {
          name  = "orders-api"
          image = "${azurerm_container_registry.platform.login_server}/orders/api:2025.09.1"

          port {
            name           = "http"
            container_port = 8080
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "orders_worker" {
  metadata {
    name      = "orders-worker"
    namespace = kubernetes_namespace_v1.orders.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "orders-worker"
      "app.kubernetes.io/component" = "worker"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "orders-worker"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "orders-worker"
          "app.kubernetes.io/component" = "worker"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.orders_worker.metadata[0].name

        container {
          name  = "orders-worker"
          image = "${azurerm_container_registry.platform.login_server}/orders/fulfillment-worker:2025.09.1"

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_stateful_set_v1" "catalog_search" {
  metadata {
    name      = "catalog-search"
    namespace = kubernetes_namespace_v1.catalog.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "catalog-search"
      "app.kubernetes.io/component" = "search"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    service_name = "catalog-search"
    replicas     = 3

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "catalog-search"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "catalog-search"
          "app.kubernetes.io/component" = "search"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.catalog_search.metadata[0].name

        container {
          name  = "opensearch"
          image = "opensearchproject/opensearch:2.19.0"

          port {
            name           = "http"
            container_port = 9200
          }

          resources {
            requests = {
              cpu    = "1"
              memory = "4Gi"
            }
            limits = {
              cpu    = "2"
              memory = "4Gi"
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/usr/share/opensearch/data"
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "data"
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = "managed-csi-premium"

        resources {
          requests = {
            storage = "256Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim_v1" "prometheus_data" {
  metadata {
    name      = "prometheus-data"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = "managed-csi-premium"

    resources {
      requests = {
        storage = "512Gi"
      }
    }
  }
}

resource "kubernetes_stateful_set_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "prometheus"
      "app.kubernetes.io/component" = "metrics"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    service_name = "prometheus"
    replicas     = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "prometheus"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "prometheus"
          "app.kubernetes.io/component" = "metrics"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.prometheus.metadata[0].name

        container {
          name  = "prometheus"
          image = "quay.io/prometheus/prometheus:v3.2.1"

          port {
            name           = "http"
            container_port = 9090
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "2Gi"
            }
            limits = {
              cpu    = "2"
              memory = "4Gi"
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/prometheus"
          }
        }

        volume {
          name = "data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.prometheus_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_daemon_set_v1" "otel_collector" {
  metadata {
    name      = "otel-collector"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "otel-collector"
      "app.kubernetes.io/component" = "telemetry"
      "app.kubernetes.io/part-of"   = "commerce"
    }
  }

  spec {
    selector {
      match_labels = {
        "app.kubernetes.io/name" = "otel-collector"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "otel-collector"
          "app.kubernetes.io/component" = "telemetry"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.otel_collector.metadata[0].name

        container {
          name  = "otel-collector"
          image = "otel/opentelemetry-collector-contrib:0.121.0"

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

# Services and ingress.

resource "kubernetes_service_v1" "ingress_nginx" {
  metadata {
    name      = "ingress-nginx"
    namespace = kubernetes_namespace_v1.platform_ingress.metadata[0].name

    annotations = {
      "service.beta.kubernetes.io/azure-load-balancer-internal" = "true"
      "service.beta.kubernetes.io/azure-load-balancer-ipv4"     = "10.20.3.250"
    }
  }

  spec {
    type = "LoadBalancer"

    selector = {
      "app.kubernetes.io/name" = "ingress-nginx"
    }

    port {
      name        = "https"
      port        = 443
      target_port = 443
    }

    port {
      name        = "http"
      port        = 80
      target_port = 80
    }
  }
}

resource "kubernetes_service_v1" "checkout_api" {
  metadata {
    name      = "checkout-api"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name" = "checkout-api"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = 8080
    }
  }
}

resource "kubernetes_service_v1" "payments_api" {
  metadata {
    name      = "payments-api"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name" = "payments-api"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = 8080
    }
  }
}

resource "kubernetes_service_v1" "catalog_api" {
  metadata {
    name      = "catalog-api"
    namespace = kubernetes_namespace_v1.catalog.metadata[0].name
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name" = "catalog-api"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = 8080
    }
  }
}

resource "kubernetes_service_v1" "catalog_search" {
  metadata {
    name      = "catalog-search"
    namespace = kubernetes_namespace_v1.catalog.metadata[0].name
  }

  spec {
    cluster_ip = "None"

    selector = {
      "app.kubernetes.io/name" = "catalog-search"
    }

    port {
      name        = "http"
      port        = 9200
      target_port = 9200
    }
  }
}

resource "kubernetes_service_v1" "orders_api" {
  metadata {
    name      = "orders-api"
    namespace = kubernetes_namespace_v1.orders.metadata[0].name
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name" = "orders-api"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = 8080
    }
  }
}

resource "kubernetes_service_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name" = "prometheus"
    }

    port {
      name        = "http"
      port        = 9090
      target_port = 9090
    }
  }
}

resource "kubernetes_ingress_v1" "checkout" {
  metadata {
    name      = "checkout"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name

    annotations = {
      "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
    }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts       = ["shop.brightcart.io"]
      secret_name = "shop-brightcart-io-tls"
    }

    rule {
      host = "shop.brightcart.io"

      http {
        path {
          path      = "/checkout"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.checkout_api.metadata[0].name

              port {
                number = 8080
              }
            }
          }
        }

        path {
          path      = "/cart"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.checkout_api.metadata[0].name

              port {
                number = 8080
              }
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_ingress_v1" "catalog" {
  metadata {
    name      = "catalog"
    namespace = kubernetes_namespace_v1.catalog.metadata[0].name

    annotations = {
      "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
    }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts       = ["shop.brightcart.io"]
      secret_name = "shop-brightcart-io-tls"
    }

    rule {
      host = "shop.brightcart.io"

      http {
        path {
          path      = "/catalog"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.catalog_api.metadata[0].name

              port {
                number = 8080
              }
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_ingress_v1" "orders" {
  metadata {
    name      = "orders"
    namespace = kubernetes_namespace_v1.orders.metadata[0].name

    annotations = {
      "nginx.ingress.kubernetes.io/ssl-redirect" = "true"
    }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts       = ["api.brightcart.io"]
      secret_name = "api-brightcart-io-tls"
    }

    rule {
      host = "api.brightcart.io"

      http {
        path {
          path      = "/orders"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.orders_api.metadata[0].name

              port {
                number = 8080
              }
            }
          }
        }
      }
    }
  }
}

# Network policies: deny ingress by default, admit the ingress controller into application namespaces.

resource "kubernetes_network_policy_v1" "platform_ingress" {
  metadata {
    name      = "default-deny-ingress"
    namespace = kubernetes_namespace_v1.platform_ingress.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]
  }
}

resource "kubernetes_network_policy_v1" "checkout" {
  metadata {
    name      = "allow-platform-ingress"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = kubernetes_namespace_v1.platform_ingress.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_network_policy_v1" "catalog" {
  metadata {
    name      = "allow-platform-ingress"
    namespace = kubernetes_namespace_v1.catalog.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = kubernetes_namespace_v1.platform_ingress.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_network_policy_v1" "orders" {
  metadata {
    name      = "allow-platform-ingress"
    namespace = kubernetes_namespace_v1.orders.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = kubernetes_namespace_v1.platform_ingress.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_network_policy_v1" "observability" {
  metadata {
    name      = "default-deny-ingress"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]
  }
}

# Autoscaling.

resource "kubernetes_horizontal_pod_autoscaler_v1" "checkout_api" {
  metadata {
    name      = "checkout-api"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name
  }

  spec {
    min_replicas                      = 3
    max_replicas                      = 12
    target_cpu_utilization_percentage = 70

    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment_v1.checkout_api.metadata[0].name
    }
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v1" "catalog_api" {
  metadata {
    name      = "catalog-api"
    namespace = kubernetes_namespace_v1.catalog.metadata[0].name
  }

  spec {
    min_replicas                      = 3
    max_replicas                      = 9
    target_cpu_utilization_percentage = 70

    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment_v1.catalog_api.metadata[0].name
    }
  }
}

resource "kubernetes_horizontal_pod_autoscaler_v1" "orders_api" {
  metadata {
    name      = "orders-api"
    namespace = kubernetes_namespace_v1.orders.metadata[0].name
  }

  spec {
    min_replicas                      = 3
    max_replicas                      = 9
    target_cpu_utilization_percentage = 70

    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment_v1.orders_api.metadata[0].name
    }
  }
}
