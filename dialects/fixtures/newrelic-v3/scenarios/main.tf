terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
    newrelic = {
      source  = "newrelic/newrelic"
      version = "3.96.4"
    }
  }
}

# Reads of this provider need its API, so the plan defers them until apply.
resource "terraform_data" "defer_reads" {
}
provider "newrelic" {
  account_id = 1
  api_key    = "ROOTFORM_NEWRELIC_PROVIDER_KEY_SENTINEL"
}

resource "newrelic_account_management" "platform" {

  name = "platform"

}
data "newrelic_account" "platform" {
  depends_on = [terraform_data.defer_reads]
  account_id = newrelic_account_management.platform.id
}

resource "newrelic_browser_application" "frontend" {
  account_id = newrelic_account_management.platform.id
  name       = "frontend"
}

data "newrelic_application" "backend" {
  depends_on = [terraform_data.defer_reads]
  name       = "backend"
}

resource "newrelic_application_settings" "backend" {
  guid = "backend-guid"
  name = "backend"
}

resource "newrelic_key_transaction" "checkout" {
  metric_name          = "fx-checkout-metric-name"
  browser_apdex_target = 1
  apdex_index          = 1
  application_guid     = "backend-guid"
  name                 = "checkout"
}

data "newrelic_key_transaction" "checkout" {
  depends_on = [terraform_data.defer_reads]
  name       = "checkout"
}

resource "aws_iam_role" "newrelic" {
  name = "newrelic-observability"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = []
  })
}

resource "google_service_account" "newrelic" {

  account_id = "newrelic-observability"

}
resource "newrelic_aws_connection" "ingest" {
  account_id = newrelic_account_management.platform.id
  name       = "federated-logs"
  credential {
    assume_role {
      role_arn = aws_iam_role.newrelic.arn
    }
  }
}

resource "newrelic_cloud_aws_link_account" "production" {
  account_id = newrelic_account_management.platform.id
  name       = "production"
  arn        = aws_iam_role.newrelic.arn
}

resource "newrelic_cloud_aws_govcloud_link_account" "government" {
  account_id = newrelic_account_management.platform.id
  name       = "government"
  arn        = aws_iam_role.newrelic.arn
}

resource "newrelic_cloud_aws_eu_sovereign_link_account" "sovereign" {
  account_id = newrelic_account_management.platform.id
  name       = "sovereign"
  arn        = aws_iam_role.newrelic.arn
}

resource "newrelic_cloud_azure_link_account" "production" {
  account_id      = newrelic_account_management.platform.id
  name            = "production"
  application_id  = "application"
  subscription_id = "subscription"
  tenant_id       = "tenant"
  client_secret   = "ROOTFORM_NEWRELIC_AZURE_SECRET_SENTINEL"
}

resource "newrelic_cloud_gcp_link_account" "production" {
  account_id                       = newrelic_account_management.platform.id
  name                             = "production"
  project_id                       = "rootform-project"
  use_workload_identity_federation = true
  audience                         = "//iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/newrelic/providers/newrelic"
  service_account_email            = google_service_account.newrelic.email
}

resource "newrelic_cloud_oci_link_account" "production" {
  oci_home_region   = "fx-production-oci-home-region"
  account_id        = newrelic_account_management.platform.id
  name              = "production"
  tenant_id         = "ocid1.tenancy.oc1..rootform"
  compartment_ocid  = "ocid1.compartment.oc1..rootform"
  oci_client_id     = "rootform-client"
  oci_client_secret = "ROOTFORM_NEWRELIC_OCI_SECRET_SENTINEL"
  oci_domain_url    = "https://identity.rootform.invalid"
}

data "newrelic_cloud_account" "production" {
  depends_on     = [terraform_data.defer_reads]
  account_id     = newrelic_account_management.platform.id
  cloud_provider = "aws"
  name           = "production"
}

resource "newrelic_cloud_aws_integrations" "production" {
  account_id        = newrelic_account_management.platform.id
  linked_account_id = newrelic_cloud_aws_link_account.production.id
}

resource "newrelic_cloud_aws_govcloud_integrations" "government" {
  account_id        = newrelic_account_management.platform.id
  linked_account_id = newrelic_cloud_aws_govcloud_link_account.government.id
}

resource "newrelic_cloud_aws_eu_sovereign_integrations" "sovereign" {
  account_id        = newrelic_account_management.platform.id
  linked_account_id = newrelic_cloud_aws_eu_sovereign_link_account.sovereign.id
}

resource "newrelic_cloud_azure_integrations" "production" {
  account_id        = newrelic_account_management.platform.id
  linked_account_id = newrelic_cloud_azure_link_account.production.id
}

resource "newrelic_cloud_gcp_integrations" "production" {
  account_id        = newrelic_account_management.platform.id
  linked_account_id = newrelic_cloud_gcp_link_account.production.id
}

resource "newrelic_cloud_gcp_dm_integrations" "production" {
  account_id        = newrelic_account_management.platform.id
  linked_account_id = newrelic_cloud_gcp_link_account.production.id
}

resource "newrelic_federated_logs_setup" "logs" {
  default_partition {
    storage {
      table             = "fx-logs-table"
      data_location_uri = "https://fx-logs-data-location-uri.example.com"
    }
  }
  account_id = newrelic_account_management.platform.id
  name       = "logs"
  storage {
    cloud_provider_configuration {
      region   = "us-central1"
      provider = "fx-logs-provider"
    }
    data_ingest_connection_id = newrelic_aws_connection.ingest.id
    query_connection_id       = newrelic_aws_connection.ingest.id
    data_location_bucket      = "rootform-logs"
    database                  = "rootform_logs"
  }
}

resource "newrelic_federated_logs_partition" "application" {
  storage {
    table             = "fx-application-table"
    data_location_uri = "https://fx-application-data-location-uri.example.com"
  }
  account_id = newrelic_account_management.platform.id
  setup_id   = newrelic_federated_logs_setup.logs.id
  name       = "application"
}

resource "newrelic_fleet" "production" {
  name                = "production"
  managed_entity_type = "KUBERNETESCLUSTER"
}

resource "newrelic_fleet_configuration" "otel" {
  name                  = "otel"
  agent_type            = "NRDOT"
  managed_entity_type   = "KUBERNETESCLUSTER"
  configuration_content = "ROOTFORM_NEWRELIC_FLEET_CONFIG_SENTINEL"
}

data "newrelic_fleet_configuration" "otel" {
  depends_on = [terraform_data.defer_reads]
  name       = "otel"
}

resource "newrelic_fleet_deployment" "otel" {
  fleet_id = newrelic_fleet.production.id
  name     = "otel"
}

resource "newrelic_fleet_members" "production" {
  ring {
    name       = "fx-production-name"
    entity_ids = ["fx-production-entity-ids"]
  }

  fleet_id = newrelic_fleet.production.id

}
data "newrelic_fleet_members" "production" {
  depends_on = [terraform_data.defer_reads]
  fleet_id   = newrelic_fleet.production.id
}

resource "newrelic_synthetics_private_location" "private" {
  account_id  = newrelic_account_management.platform.id
  name        = "private"
  description = "private execution"
}

data "newrelic_synthetics_private_location" "private" {
  depends_on = [terraform_data.defer_reads]
  account_id = newrelic_account_management.platform.id
  name       = "private"
}

resource "newrelic_synthetics_broken_links_monitor" "links" {
  period               = "EVERY_MINUTE"
  status               = "DISABLED"
  account_id           = newrelic_account_management.platform.id
  name                 = "links"
  uri                  = "https://rootform.invalid"
  locations_private    = [newrelic_synthetics_private_location.private.guid]
  runtime_type         = "NODE_API"
  runtime_type_version = "16.10"
}

resource "newrelic_synthetics_cert_check_monitor" "certificate" {
  status                 = "DISABLED"
  period                 = "EVERY_MINUTE"
  certificate_expiration = 1
  account_id             = newrelic_account_management.platform.id
  name                   = "certificate"
  domain                 = "rootform.invalid"
  locations_private      = [newrelic_synthetics_private_location.private.guid]
  runtime_type           = "NODE_API"
  runtime_type_version   = "16.10"
}

resource "newrelic_synthetics_monitor" "api" {
  status            = "DISABLED"
  type              = "SIMPLE"
  account_id        = newrelic_account_management.platform.id
  name              = "api"
  uri               = "https://rootform.invalid/health"
  locations_private = [newrelic_synthetics_private_location.private.guid]
}

resource "newrelic_synthetics_script_monitor" "browser" {
  period               = "EVERY_MINUTE"
  status               = "DISABLED"
  type                 = "SCRIPT_API"
  account_id           = newrelic_account_management.platform.id
  name                 = "browser"
  script               = "ROOTFORM_NEWRELIC_SCRIPT_SENTINEL"
  script_language      = "JAVASCRIPT"
  runtime_type         = "NODE_API"
  runtime_type_version = "16.10"
  location_private {
    guid = newrelic_synthetics_private_location.private.guid
  }
}

resource "newrelic_synthetics_step_monitor" "checkout" {
  steps {
    ordinal = 1
    type    = "NAVIGATE"
    values  = ["https://rootform.invalid/checkout"]
  }
  status               = "DISABLED"
  period               = "EVERY_MINUTE"
  account_id           = newrelic_account_management.platform.id
  name                 = "checkout"
  runtime_type         = "CHROME_BROWSER"
  runtime_type_version = "100"
  location_private {
    guid = newrelic_synthetics_private_location.private.guid
  }
}

resource "newrelic_cardinality_management" "metrics" {
  mode = "DEFAULT"

  cardinality_limit = 100000

}
resource "newrelic_data_partition_rule" "logs" {
  enabled               = false
  retention_policy      = "SECONDARY"
  account_id            = newrelic_account_management.platform.id
  target_data_partition = "logs"
  nrql                  = "ROOTFORM_NEWRELIC_NRQL_SENTINEL"
}

resource "newrelic_events_to_metrics_rule" "latency" {
  account_id = newrelic_account_management.platform.id
  name       = "latency"
  nrql       = "ROOTFORM_NEWRELIC_NRQL_SENTINEL"
}

resource "newrelic_log_parsing_rule" "application" {
  nrql       = "fx-application-nrql"
  lucene     = "fx-application-lucene"
  enabled    = false
  account_id = newrelic_account_management.platform.id
  name       = "application"
  grok       = "ROOTFORM_NEWRELIC_NRQL_SENTINEL"
}

resource "newrelic_metric_pruning_rule" "metrics" {
  account_id = newrelic_account_management.platform.id
  nrql       = "ROOTFORM_NEWRELIC_NRQL_SENTINEL"
}

resource "newrelic_nrql_drop_rule" "logs" {
  action     = "drop_data"
  account_id = newrelic_account_management.platform.id
  nrql       = "ROOTFORM_NEWRELIC_NRQL_SENTINEL"
}

resource "newrelic_obfuscation_expression" "credentials" {
  account_id = newrelic_account_management.platform.id
  name       = "credentials"
  regex      = "ROOTFORM_NEWRELIC_NRQL_SENTINEL"
}

data "newrelic_obfuscation_expression" "credentials" {
  depends_on = [terraform_data.defer_reads]
  account_id = newrelic_account_management.platform.id
  name       = "credentials"
}

resource "newrelic_obfuscation_rule" "credentials" {
  action {
    method        = "HASH_SHA256"
    expression_id = "fx-credentials-expression-id"
    attribute     = ["fx-credentials-attribute"]
  }
  filter     = "fx-credentials-filter"
  enabled    = false
  account_id = newrelic_account_management.platform.id
  name       = "credentials"
}

resource "newrelic_pipeline_cloud_rule" "logs" {
  account_id = newrelic_account_management.platform.id
  name       = "logs"
  nrql       = "ROOTFORM_NEWRELIC_NRQL_SENTINEL"
}

resource "newrelic_service_level" "availability" {
  objective {
    time_window {
      rolling {
        unit  = "DAY"
        count = 1
      }
    }
    target = 1
  }
  events {
    valid_events {
      from = "fx-availability-from"
    }
    account_id = 1
  }
  guid = "backend-guid"
  name = "availability"
}

resource "newrelic_workload" "checkout" {
  dynamic_flows {
    entity_guid      = "fx-checkout-entity-guid"
    transaction_name = "fx-checkout-transaction-name"
  }
  account_id = newrelic_account_management.platform.id
  name       = "checkout"
}

resource "newrelic_workflow_automation" "remediation" {
  name       = "remediation"
  scope_id   = newrelic_account_management.platform.id
  scope_type = "ACCOUNT"
  definition = "ROOTFORM_NEWRELIC_WORKFLOW_DEFINITION_SENTINEL"
}

resource "newrelic_one_dashboard" "must_not_create_topology" {
  page {
    name = "fx-must-not-create-topology-name"
  }

  name = "ROOTFORM_NEWRELIC_DASHBOARD_SENTINEL"

}
