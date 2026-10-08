terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.3.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 5.24.0"
    }
    confluent = {
      source  = "confluentinc/confluent"
      version = "= 2.83.0"
    }
    datadog = {
      source  = "datadog/datadog"
      version = "4.19.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "= 2.38.0"
    }
  }
}

# Reads of this provider need its API, so the plan defers them until apply.
resource "terraform_data" "defer_reads" {
}
resource "aws_organizations_account" "production" {
  name  = "production"
  email = "production@rootform.invalid"
}

resource "azurerm_resource_group" "production" {
  name     = "production"
  location = "West Europe"
}

resource "google_project" "production" {
  name       = "production"
  project_id = "rootform-production"
  org_id     = "1234567890"
}

resource "kubernetes_namespace" "observability" {
  metadata {
    name = "observability"
  }
}

resource "cloudflare_account" "edge" {

  name = "edge"

}
resource "confluent_environment" "streaming" {

  display_name = "streaming"

}
resource "datadog_child_organization" "platform" {

  name = "platform"

}
resource "datadog_org_connection" "shared" {
  sink_org_id      = datadog_child_organization.platform.public_id
  connection_types = ["metrics", "logs"]
}

resource "datadog_integration_aws_account" "production" {
  resources_config {
  }
  traces_config {
    xray_services {
    }
  }
  metrics_config {
    namespace_filters {
    }
  }
  logs_config {
    lambda_forwarder {
    }
  }
  auth_config {
    aws_auth_config_role {
      role_name = "DatadogIntegrationRole"
    }
  }
  aws_regions {
  }
  aws_account_id = aws_organizations_account.production.id
  aws_partition  = "aws"
}

resource "datadog_integration_azure" "production" {
  tenant_name             = "00000000-0000-0000-0000-000000000001"
  client_id               = "00000000-0000-0000-0000-000000000002"
  secretless_auth_enabled = true
  depends_on              = [azurerm_resource_group.production]
}

resource "datadog_integration_gcp" "legacy" {
  project_id     = google_project.production.project_id
  private_key_id = "legacy-key"
  private_key    = "ROOTFORM_DATADOG_GCP_PRIVATE_KEY_SENTINEL"
  client_email   = "datadog@rootform-production.iam.gserviceaccount.com"
  client_id      = "1234567890"
}

resource "datadog_integration_gcp_sts" "production" {
  client_email = "datadog@rootform-production.iam.gserviceaccount.com"
  depends_on   = [google_project.production]
}

resource "datadog_integration_cloudflare_account" "edge" {
  name       = "edge"
  api_key    = "ROOTFORM_DATADOG_CLOUDFLARE_KEY_SENTINEL"
  resources  = ["web", "dns", "lb", "worker"]
  depends_on = [cloudflare_account.edge]
}

resource "datadog_integration_confluent_account" "streaming" {
  api_key    = "public-key"
  api_secret = "ROOTFORM_DATADOG_CONFLUENT_SECRET_SENTINEL"
  depends_on = [confluent_environment.streaming]
}

resource "datadog_integration_confluent_resource" "kafka" {
  account_id    = datadog_integration_confluent_account.streaming.id
  resource_id   = "lkc-rootform"
  resource_type = "kafka"
}

resource "datadog_integration_fastly_account" "edge" {
  name    = "edge"
  api_key = "ROOTFORM_DATADOG_FASTLY_KEY_SENTINEL"
}

resource "datadog_integration_fastly_service" "edge" {
  account_id = datadog_integration_fastly_account.edge.id
  service_id = "fastly-service"
}

resource "datadog_action_connection" "automation" {
  aws {
    assume_role {
      account_id = "123456789012"
      role       = "DatadogActionRole"
    }
  }
  name = "automation"
}

data "datadog_action_connection" "automation" {
  depends_on = [terraform_data.defer_reads]
  id         = datadog_action_connection.automation.id
}

resource "datadog_observability_pipeline" "telemetry" {
  name = "telemetry"

  config {
    source {
      id = "otel"
      opentelemetry {}
    }
    destination {
      id     = "datadog"
      inputs = ["otel"]
      datadog_logs {}
    }
  }
}

resource "datadog_logs_archive" "primary" {
  name  = "primary"
  query = "service:api"
}

resource "datadog_logs_custom_destination" "security" {
  http_destination {
    endpoint = "https://fx-security-endpoint.example.com"
    custom_header_auth {
      header_name  = "X-Fixture"
      header_value = "fx-security-header-value"
    }
  }
  name  = "security"
  query = "source:security"
}

resource "datadog_logs_archive_order" "primary" {

  archive_ids = [datadog_logs_archive.primary.id]

}
resource "datadog_logs_custom_pipeline" "application" {
  filter {
    query = "fx-application-query"
  }
  name = "application"
}

resource "datadog_logs_integration_pipeline" "aws" {

  is_enabled = true

}
resource "datadog_logs_index" "production" {
  filter {
    query = "fx-production-query"
  }
  name           = "production"
  retention_days = 15
}

resource "datadog_rum_application" "web" {
  name = "web"
  type = "browser"
}

data "datadog_rum_application" "web" {
  depends_on = [terraform_data.defer_reads]
  id         = datadog_rum_application.web.id
}

resource "datadog_rum_retention_filter" "web" {
  application_id = datadog_rum_application.web.id
  name           = "web"
  event_type     = "session"
  sample_rate    = 100
}

resource "datadog_synthetics_private_location" "internal" {
  name        = "internal"
  description = "private execution location"
  depends_on  = [kubernetes_namespace.observability]
}

resource "datadog_synthetics_test" "api" {
  name      = "api"
  type      = "api"
  subtype   = "http"
  status    = "live"
  # The provider rejects a locations set that is unknown during plan, so a
  # plan-only fixture cannot use the private location created above.
  locations = ["aws:us-east-1"]
}

data "datadog_synthetics_test" "api" {
  depends_on = [terraform_data.defer_reads]
  test_id    = datadog_synthetics_test.api.id
}

resource "datadog_synthetics_suite" "application" {

  name = "application"

}
resource "datadog_datastore" "operations" {
  name                = "operations"
  primary_column_name = "id"
}

data "datadog_datastore" "operations" {
  depends_on   = [terraform_data.defer_reads]
  datastore_id = datadog_datastore.operations.id
}

resource "datadog_datastore_item" "status" {
  datastore_id = datadog_datastore.operations.id
  item_key     = "status"
  value        = { payload = "ROOTFORM_DATADOG_DATASTORE_VALUE_SENTINEL" }
}

data "datadog_datastore_item" "status" {
  depends_on   = [terraform_data.defer_reads]
  datastore_id = datadog_datastore.operations.id
  item_key     = datadog_datastore_item.status.item_key
}

resource "datadog_app_builder_app" "operations" {
  name     = "operations"
  app_json = "ROOTFORM_DATADOG_APP_JSON_SENTINEL"
}

data "datadog_app_builder_app" "operations" {
  depends_on = [terraform_data.defer_reads]
  id         = datadog_app_builder_app.operations.id
}

resource "datadog_workflow_automation" "remediation" {
  name        = "remediation"
  description = "remediation workflow"
  published   = true
  tags        = ["team:platform"]
  spec_json   = jsonencode({ description = "ROOTFORM_DATADOG_WORKFLOW_SPEC_SENTINEL" })
}

data "datadog_workflow_automation" "remediation" {
  depends_on = [terraform_data.defer_reads]
  id         = datadog_workflow_automation.remediation.id
}

resource "datadog_service_definition_yaml" "api" {
  service_definition = yamlencode({
    "schema-version" = "v2.2"
    "dd-service"     = "api"
    description      = "ROOTFORM_DATADOG_SERVICE_DEFINITION_SENTINEL"
  })
}
resource "datadog_software_catalog" "api" {
  entity = yamlencode({
    apiVersion = "v3"
    kind       = "service"
    metadata = {
      name        = "api"
      description = "ROOTFORM_DATADOG_SOFTWARE_CATALOG_SENTINEL"
    }
  })
}
data "datadog_software_catalog" "api" {
  depends_on  = [terraform_data.defer_reads]
  filter_name = "api"
}

resource "datadog_service_level_objective" "api" {
  thresholds {
    target    = 99.9
    timeframe = "7d"
  }
  query {
    numerator   = "sum:api.requests.ok{*}.as_count()"
    denominator = "sum:api.requests.total{*}.as_count()"
  }
  name      = "api availability"
  type      = "metric"
  timeframe = "7d"
}

data "datadog_service_level_objective" "api" {
  depends_on = [terraform_data.defer_reads]
  id         = datadog_service_level_objective.api.id
}

resource "datadog_compliance_custom_framework" "platform" {
  requirements {
    name = "access"
    controls {
      name     = "restricted-access"
      rules_id = ["def-000-be9"]
    }
  }
  name    = "platform"
  handle  = "platform"
  version = "1.0"
}

resource "datadog_csm_threats_policy" "production" {

  name = "production"

}
resource "datadog_security_monitoring_rule" "authentication" {
  name    = "authentication"
  message = "investigate authentication failures"
}

resource "datadog_sensitive_data_scanner_group" "logs" {
  filter {
    query = "fx-logs-query"
  }
  name         = "logs"
  is_enabled   = true
  product_list = ["logs"]
}

resource "datadog_monitor" "must_not_create_topology" {
  name    = "api latency"
  type    = "metric alert"
  query    = "ROOTFORM_DATADOG_MONITOR_QUERY_SENTINEL"
  message  = "ROOTFORM_DATADOG_MONITOR_MESSAGE_SENTINEL"
  validate = false
}
