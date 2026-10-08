terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.62.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "5.3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "8.0.0"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "2.16.0"
    }
  }
}

resource "aws_vpc" "atlas" {

  cidr_block = "10.10.0.0/16"

}
resource "aws_subnet" "private" {
  vpc_id     = aws_vpc.atlas.id
  cidr_block = "10.10.1.0/24"
}

resource "aws_vpc_endpoint" "atlas" {
  vpc_id       = aws_vpc.atlas.id
  service_name = "com.amazonaws.vpce.us-east-1.mongodb"
}

resource "aws_s3_bucket" "backups" {

  bucket = "rootform-atlas-backups"

}
resource "aws_s3_bucket" "federation" {
  bucket = "rootform-atlas-federation"
}
resource "aws_iam_role" "atlas" {
  name               = "rootform-atlas"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "ec2.amazonaws.com" }, Condition = { StringEquals = { "aws:PrincipalTag/marker" = "ROOTFORM_ATLAS_AWS_TRUST_SENTINEL" } } }] })
}

resource "aws_kms_key" "atlas" {

  description = "Atlas database key"

}
resource "azurerm_resource_group" "atlas" {
  name     = "rg-atlas"
  location = "West Europe"
}

resource "azurerm_virtual_network" "atlas" {
  name                = "vnet-atlas"
  location            = azurerm_resource_group.atlas.location
  resource_group_name = azurerm_resource_group.atlas.name
  address_space       = ["10.20.0.0/16"]
}

resource "azurerm_subnet" "private" {
  name                 = "private"
  resource_group_name  = azurerm_resource_group.atlas.name
  virtual_network_name = azurerm_virtual_network.atlas.name
  address_prefixes     = ["10.20.1.0/24"]
}

resource "azurerm_private_endpoint" "atlas" {
  private_service_connection {
    private_connection_resource_alias = "fx-atlas-alias.00000000-0000-0000-0000-000000000000.westeurope.azure.privatelinkservice"
    is_manual_connection              = false
    name                              = "fx-atlas-name"
  }
  name                = "pe-atlas"
  location            = azurerm_resource_group.atlas.location
  resource_group_name = azurerm_resource_group.atlas.name
  subnet_id           = azurerm_subnet.private.id
}

resource "azurerm_storage_account" "atlas" {
  name                     = "rootformatlas"
  resource_group_name      = azurerm_resource_group.atlas.name
  location                 = azurerm_resource_group.atlas.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "federation" {
  name                  = "federation"
  storage_account_id    = azurerm_storage_account.atlas.id
  container_access_type = "private"
}

resource "azurerm_user_assigned_identity" "atlas" {
  name                = "id-atlas"
  resource_group_name = azurerm_resource_group.atlas.name
  location            = azurerm_resource_group.atlas.location
}

resource "azurerm_key_vault" "atlas" {
  rbac_authorization_enabled = false
  name                       = "kv-rootform-atlas"
  location                   = azurerm_resource_group.atlas.location
  resource_group_name        = azurerm_resource_group.atlas.name
  tenant_id                  = "00000000-0000-0000-0000-000000000000"
  sku_name                   = "standard"
}

resource "azurerm_key_vault_key" "atlas" {
  name         = "atlas"
  key_vault_id = azurerm_key_vault.atlas.id
  key_type     = "RSA"
  key_size     = 2048
  key_opts     = ["decrypt", "encrypt"]
}

resource "google_compute_network" "atlas" {
  name                    = "atlas-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "private" {
  name          = "atlas-private"
  network       = google_compute_network.atlas.id
  ip_cidr_range = "10.30.0.0/20"
  region        = "us-central1"
}

resource "google_compute_forwarding_rule" "atlas" {
  name                  = "atlas-psc"
  network               = google_compute_network.atlas.id
  subnetwork            = google_compute_subnetwork.private.id
  load_balancing_scheme = ""
}

resource "google_storage_bucket" "federation" {
  name     = "rootform-atlas-federation"
  location = "US"
}

resource "google_service_account" "atlas" {
  account_id   = "rootform-atlas"
  display_name = "MongoDB Atlas"
}

resource "google_kms_key_ring" "atlas" {
  name     = "atlas"
  location = "us-central1"
}

resource "google_kms_crypto_key" "atlas" {
  name     = "database"
  key_ring = google_kms_key_ring.atlas.id
}

resource "mongodbatlas_organization" "platform" {

  name = "Rootform"

}
resource "mongodbatlas_project" "application" {
  name   = "application"
  org_id = mongodbatlas_organization.platform.id
}

resource "mongodbatlas_advanced_cluster" "primary" {
  cluster_type = "REPLICASET"
  replication_specs = [{
    region_configs = [{
      provider_name   = "AWS"
      region_name     = "US_EAST_1"
      priority        = 7
      electable_specs = { instance_size = "M10", node_count = 3 }
    }]
  }]
  project_id = mongodbatlas_project.application.id
  name       = "primary"
}

resource "mongodbatlas_cluster" "legacy" {
  provider_instance_size_name = "fx-legacy-provider-instance-size-name"
  provider_name               = "FX_LEGACY_PROVIDER_NAME"
  project_id                  = mongodbatlas_project.application.id
  name                        = "legacy"
}

resource "mongodbatlas_flex_cluster" "development" {
  provider_settings = { backing_provider_name = "fx-development-backing-provider-name", region_name = "fx-development-region-name" }
  project_id        = mongodbatlas_project.application.id
  name              = "development"
}

resource "mongodbatlas_serverless_instance" "events" {
  provider_settings_backing_provider_name = "fx-events-provider-settings-backing-provider-nam"
  provider_settings_provider_name         = "fx-events-provider-settings-provider-name"
  provider_settings_region_name           = "fx-events-provider-settings-region-name"
  project_id                              = mongodbatlas_project.application.id
  name                                    = "events"
}

resource "mongodbatlas_global_cluster_config" "primary" {
  project_id   = mongodbatlas_project.application.id
  cluster_name = mongodbatlas_advanced_cluster.primary.name
}

resource "mongodbatlas_maintenance_window" "application" {
  day_of_week = 1
  hour_of_day = 1
  project_id  = mongodbatlas_project.application.id
}

resource "mongodbatlas_network_container" "atlas" {
  project_id       = mongodbatlas_project.application.id
  atlas_cidr_block = "10.40.0.0/16"
}

resource "mongodbatlas_network_peering" "aws" {
  provider_name = "AWS"
  project_id    = mongodbatlas_project.application.id
  container_id  = mongodbatlas_network_container.atlas.id
  vpc_id        = aws_vpc.atlas.id
}

resource "mongodbatlas_network_peering" "azure" {
  provider_name = "AWS"
  project_id    = mongodbatlas_project.application.id
  container_id  = mongodbatlas_network_container.atlas.id
  vnet_name     = azurerm_virtual_network.atlas.name
}

resource "mongodbatlas_network_peering" "google" {
  provider_name = "AWS"
  project_id    = mongodbatlas_project.application.id
  container_id  = mongodbatlas_network_container.atlas.id
  network_name  = google_compute_network.atlas.name
}

resource "mongodbatlas_privatelink_endpoint" "aws" {
  project_id    = mongodbatlas_project.application.id
  provider_name = "AWS"
  region        = "US_EAST_1"
}

resource "mongodbatlas_privatelink_endpoint" "azure" {
  project_id    = mongodbatlas_project.application.id
  provider_name = "AZURE"
  region        = "EUROPE_WEST"
}

resource "mongodbatlas_privatelink_endpoint" "google" {
  project_id    = mongodbatlas_project.application.id
  provider_name = "GCP"
  region        = "CENTRAL_US"
}

resource "mongodbatlas_privatelink_endpoint_service" "aws" {
  provider_name       = "AWS"
  project_id          = mongodbatlas_project.application.id
  private_link_id     = mongodbatlas_privatelink_endpoint.aws.id
  endpoint_service_id = aws_vpc_endpoint.atlas.id
}

resource "mongodbatlas_privatelink_endpoint_service" "azure" {
  provider_name       = "AWS"
  project_id          = mongodbatlas_project.application.id
  private_link_id     = mongodbatlas_privatelink_endpoint.azure.id
  endpoint_service_id = azurerm_private_endpoint.atlas.id
}

resource "mongodbatlas_privatelink_endpoint_service" "google" {
  provider_name       = "AWS"
  project_id          = mongodbatlas_project.application.id
  private_link_id     = mongodbatlas_privatelink_endpoint.google.id
  endpoint_service_id = google_compute_forwarding_rule.atlas.id
}

resource "mongodbatlas_privatelink_endpoint_service_data_federation_online_archive" "google" {
  provider_name = "fx-google-provider-name"
  project_id    = mongodbatlas_project.application.id
  endpoint_id   = google_compute_forwarding_rule.atlas.id
}

resource "mongodbatlas_private_endpoint_regional_mode" "application" {

  project_id = mongodbatlas_project.application.id

}
resource "mongodbatlas_project_ip_access_list" "office" {
  project_id = mongodbatlas_project.application.id
  cidr_block = "192.0.2.0/24"
}

resource "mongodbatlas_custom_dns_configuration_cluster_aws" "application" {
  enabled    = false
  project_id = mongodbatlas_project.application.id
}

resource "mongodbatlas_cloud_provider_access_setup" "aws" {
  provider_name = "fx-aws-provider-name"
  project_id    = mongodbatlas_project.application.id
}

resource "mongodbatlas_cloud_provider_access_setup" "azure" {
  provider_name = "fx-azure-provider-name"
  project_id    = mongodbatlas_project.application.id

  azure_config {
    atlas_azure_app_id   = "fx-azure-atlas-azure-app-id"
    tenant_id            = "00000000-0000-0000-0000-000000000001"
    service_principal_id = azurerm_user_assigned_identity.atlas.principal_id
  }
}

resource "mongodbatlas_cloud_provider_access_setup" "google" {
  provider_name = "fx-google-provider-name"
  project_id    = mongodbatlas_project.application.id
}

resource "mongodbatlas_cloud_provider_access_authorization" "aws" {
  project_id = mongodbatlas_project.application.id
  role_id    = mongodbatlas_cloud_provider_access_setup.aws.id

  aws {
    iam_assumed_role_arn = aws_iam_role.atlas.arn
  }
}

resource "mongodbatlas_cloud_provider_access_authorization" "azure" {
  project_id = mongodbatlas_project.application.id
  role_id    = mongodbatlas_cloud_provider_access_setup.azure.id

  azure {
    atlas_azure_app_id   = "fx-azure-atlas-azure-app-id"
    tenant_id            = "00000000-0000-0000-0000-000000000002"
    service_principal_id = azurerm_user_assigned_identity.atlas.principal_id
  }
}

resource "mongodbatlas_cloud_provider_access_authorization" "google" {
  project_id = mongodbatlas_project.application.id
  role_id    = mongodbatlas_cloud_provider_access_setup.google.id
}

resource "mongodbatlas_encryption_at_rest" "application" {
  project_id = mongodbatlas_project.application.id

  aws_kms_config {
    customer_master_key_id = aws_kms_key.atlas.id
    role_id                = mongodbatlas_cloud_provider_access_authorization.aws.role_id
  }

  azure_key_vault_config {
    key_identifier = azurerm_key_vault_key.atlas.id
    role_id        = mongodbatlas_cloud_provider_access_authorization.azure.role_id
  }

  google_cloud_kms_config {
    key_version_resource_id = google_kms_crypto_key.atlas.id
    role_id                 = mongodbatlas_cloud_provider_access_authorization.google.role_id
  }
}

resource "mongodbatlas_encryption_at_rest_private_endpoint" "application" {
  region_name    = "fx-application-region-name"
  cloud_provider = "fx-application-cloud-provider"
  project_id     = mongodbatlas_project.application.id
}

resource "mongodbatlas_auditing" "application" {

  project_id = mongodbatlas_project.application.id

}
resource "mongodbatlas_cloud_backup_snapshot_export_bucket" "aws" {
  cloud_provider = "fx-aws-cloud-provider"
  project_id     = mongodbatlas_project.application.id
  bucket_name    = aws_s3_bucket.backups.id
  iam_role_id    = mongodbatlas_cloud_provider_access_authorization.aws.role_id
}

resource "mongodbatlas_cloud_backup_schedule" "primary" {
  project_id   = mongodbatlas_project.application.id
  cluster_name = mongodbatlas_advanced_cluster.primary.name

  export {
    export_bucket_id = mongodbatlas_cloud_backup_snapshot_export_bucket.aws.id
  }
}

resource "mongodbatlas_backup_compliance_policy" "application" {
  authorized_user_last_name  = "fx-application-authorized-user-last-name"
  authorized_email           = "fx-application-authorized-email@example.com"
  authorized_user_first_name = "fx-application-authorized-user-first-name"
  project_id                 = mongodbatlas_project.application.id
}

resource "mongodbatlas_federated_database_instance" "aws" {
  project_id = mongodbatlas_project.application.id
  name       = "aws-federation"

  storage_stores {
    bucket       = aws_s3_bucket.federation.id
    cluster_name = mongodbatlas_advanced_cluster.primary.name
  }

  cloud_provider_config {
    aws {
      test_s3_bucket = "fx-aws-test-s3-bucket"
      role_id        = mongodbatlas_cloud_provider_access_authorization.aws.role_id
    }
  }
}

resource "mongodbatlas_federated_database_instance" "azure" {
  project_id = mongodbatlas_project.application.id
  name       = "azure-federation"

  storage_stores {
    bucket = azurerm_storage_container.federation.name
  }

  cloud_provider_config {
    azure {
      role_id = mongodbatlas_cloud_provider_access_authorization.azure.role_id
    }
  }
}

resource "mongodbatlas_federated_database_instance" "google" {
  project_id = mongodbatlas_project.application.id
  name       = "google-federation"

  storage_stores {
    bucket = google_storage_bucket.federation.name
  }
}

resource "mongodbatlas_online_archive" "orders" {
  criteria {
    type = "DATE"
  }
  db_name      = "fx-orders-db-name"
  coll_name    = "fx-orders-coll-name"
  project_id   = mongodbatlas_project.application.id
  cluster_name = mongodbatlas_advanced_cluster.primary.name
}

resource "mongodbatlas_federated_query_limit" "application" {
  limit_name     = "fx-application-limit-name"
  tenant_name    = "fx-application-tenant-name"
  overrun_policy = "BLOCK"
  value          = 1
  project_id     = mongodbatlas_project.application.id
}

resource "mongodbatlas_search_deployment" "primary" {
  specs        = [{ instance_size = "fx-primary-instance-size", node_count = 1 }]
  project_id   = mongodbatlas_project.application.id
  cluster_name = mongodbatlas_advanced_cluster.primary.name
}

resource "mongodbatlas_search_index" "documents" {
  collection_name = "fx-documents-collection-name"
  database        = "fx-documents-database"
  project_id      = mongodbatlas_project.application.id
  cluster_name    = mongodbatlas_advanced_cluster.primary.name
  name            = "documents"
}

resource "mongodbatlas_ai_model_rate_limit" "application" {
  model_group_name          = "fx-application-model-group-name"
  geography                 = "fx-application-geography"
  cloud                     = "fx-application-cloud"
  tokens_per_minute_limit   = 1
  requests_per_minute_limit = 1
  project_id                = mongodbatlas_project.application.id
}

resource "mongodbatlas_stream_workspace" "analytics" {
  data_process_region = { cloud_provider = "fx-analytics-cloud-provider", region = "us-central1" }
  workspace_name      = "fx-analytics-workspace-name"
  project_id          = mongodbatlas_project.application.id
}

resource "mongodbatlas_stream_instance" "legacy" {
  data_process_region = { cloud_provider = "fx-legacy-cloud-provider", region = "us-central1" }
  project_id          = mongodbatlas_project.application.id
  instance_name       = "legacy-streams"
}

resource "mongodbatlas_stream_privatelink_endpoint" "aws" {
  vendor              = "fx-aws-vendor"
  provider_name       = "fx-aws-provider-name"
  project_id          = mongodbatlas_project.application.id
  service_endpoint_id = aws_vpc.atlas.id
}

resource "mongodbatlas_stream_connection" "events" {
  project_id      = mongodbatlas_project.application.id
  workspace_name  = mongodbatlas_stream_workspace.analytics.workspace_name
  connection_name = "events"
  type            = "Cluster"
  cluster_name    = mongodbatlas_advanced_cluster.primary.name
  aws = {
    role_arn = aws_iam_role.atlas.arn
  }
  azure = {
    service_principal_id = azurerm_user_assigned_identity.atlas.principal_id
    storage_account_name = "rootformatlas"
  }
  gcp = {
    service_account_id = google_service_account.atlas.id
  }
  networking = {
    access = {
      type          = "PRIVATE_LINK"
      connection_id = mongodbatlas_stream_privatelink_endpoint.aws.id
    }
  }
}

resource "mongodbatlas_stream_connection_failover" "events" {
  type            = "fx-events-type"
  region          = "us-central1"
  workspace_name  = "fx-events-workspace-name"
  project_id      = mongodbatlas_project.application.id
  connection_name = mongodbatlas_stream_connection.events.connection_name
}

resource "mongodbatlas_stream_processor" "orders" {
  project_id     = mongodbatlas_project.application.id
  workspace_name = mongodbatlas_stream_workspace.analytics.workspace_name
  processor_name = "orders"
  pipeline       = jsonencode([{ "$source" = { connectionName = "ROOTFORM_ATLAS_PIPELINE_SECRET" } }])
}

resource "mongodbatlas_project_service_account" "automation" {
  description                = "fx-automation-description"
  secret_expires_after_hours = 8
  roles       = ["fx-automation-roles"]
  project_id  = mongodbatlas_project.application.id
  name        = "automation"
}

resource "mongodbatlas_service_account" "platform" {
  secret_expires_after_hours = 8
  roles       = ["fx-platform-roles"]
  description = "fx-platform-description"
  org_id      = mongodbatlas_organization.platform.id
  name        = "platform"
}

resource "mongodbatlas_team" "platform" {
  org_id    = mongodbatlas_organization.platform.id
  name      = "platform"
  usernames = ["platform@example.com"]
}

resource "mongodbatlas_team_project_assignment" "platform" {
  project_id = mongodbatlas_project.application.id
  team_id    = mongodbatlas_team.platform.id
  role_names = ["GROUP_OWNER"]
}

resource "mongodbatlas_service_account_project_assignment" "platform" {
  project_id = mongodbatlas_project.application.id
  client_id  = mongodbatlas_service_account.platform.client_id
  roles      = ["GROUP_READ_ONLY"]
}

resource "mongodbatlas_federated_settings_identity_provider" "workforce" {
  issuer_uri             = "https://fx-workforce-issuer-uri.example.com"
  federation_settings_id = "fx-workforce-federation-settings-id"
  name                   = "workforce"
}

resource "mongodbatlas_log_integration" "archive" {
  log_types              = ["fx-archive-log-types"]
  type                   = "fx-archive-type"
  project_id             = mongodbatlas_project.application.id
  bucket_name            = aws_s3_bucket.backups.id
  storage_container_name = azurerm_storage_container.federation.name
  kms_key                = aws_kms_key.atlas.id
  iam_role_id            = mongodbatlas_cloud_provider_access_authorization.aws.role_id
}

resource "mongodbatlas_push_based_log_export" "archive" {
  project_id  = mongodbatlas_project.application.id
  bucket_name = aws_s3_bucket.backups.id
  iam_role_id = mongodbatlas_cloud_provider_access_authorization.aws.role_id
}

resource "mongodbatlas_metric_integration" "monitoring" {
  endpoint                = "https://fx-monitoring-endpoint.example.com"
  provider_type           = "fx-monitoring-provider-type"
  metric_selection        = ["fx-monitoring-metric-selection"]
  integration_type        = "fx-monitoring-integration-type"
  aggregation_temporality = "fx-monitoring-aggregation-temporality"
  auth_type               = "fx-monitoring-auth-type"
  for_each                = toset(["eu", "us"])
  project_id              = mongodbatlas_project.application.id
}

resource "mongodbatlas_alert_configuration" "database" {
  notification {
    type_name = "EMAIL"
  }
  event_type = "fx-database-event-type"
  project_id = mongodbatlas_project.application.id
}

resource "mongodbatlas_third_party_integration" "incident" {
  type       = "PAGER_DUTY"
  project_id = mongodbatlas_project.application.id
  api_key    = "ROOTFORM_ATLAS_OBSERVABILITY_SECRET"
}

resource "mongodbatlas_event_trigger" "orders" {
  app_id     = "fx-orders-app-id"
  type       = "DATABASE"
  project_id = mongodbatlas_project.application.id
  name       = "orders"
}
