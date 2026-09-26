terraform {
  required_providers {
    datadog = {
      source  = "datadog/datadog"
      version = "4.19.0"
    }
  }
}

resource "datadog_child_organization" "platform" {

  name = "platform"

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
  aws_account_id = "123456789012"
  aws_partition  = "aws"
}

resource "datadog_observability_pipeline" "logs" {
  config {
  }
  name = "production-logs"
}

resource "datadog_logs_archive" "primary" {
  name  = "primary"
  query = "service:api"
}
