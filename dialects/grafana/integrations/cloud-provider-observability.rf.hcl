concept "cloud-integration-configuration" {
  description = "A scrape job, integration package, or plugin supporting a Grafana Cloud integration."
}

rule "cloud-integration" {
  match {
    type = "grafana_cloud_integration"
  }

  as = concept.cloud-integration-configuration
}

rule "cloud-provider-aws-account" {
  match {
    type = "grafana_cloud_provider_aws_account"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id", "resource_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "resource_id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }

}

rule "cloud-provider-aws-account-lookup" {
  match {
    kind = "data"
    type = "grafana_cloud_provider_aws_account"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id", "resource_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "resource_id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }

}

rule "cloud-provider-aws-cloudwatch-scrape-job" {
  match {
    type = "grafana_cloud_provider_aws_cloudwatch_scrape_job"
  }

  as = concept.cloud-integration-configuration

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.cloud-observability-integration
    via      = source.aws_account_resource_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }
  }
}

rule "cloud-provider-aws-cloudwatch-scrape-job-lookup" {
  match {
    kind = "data"
    type = "grafana_cloud_provider_aws_cloudwatch_scrape_job"
  }

  as = concept.cloud-integration-configuration

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.cloud-observability-integration
    via      = source.aws_account_resource_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }
  }
}

rule "cloud-provider-aws-resource-metadata-scrape-job" {
  match {
    type = "grafana_cloud_provider_aws_resource_metadata_scrape_job"
  }

  as = concept.cloud-integration-configuration

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.cloud-observability-integration
    via      = source.aws_account_resource_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }
  }
}

rule "cloud-provider-azure-credential" {
  match {
    type = "grafana_cloud_provider_azure_credential"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id", "resource_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "resource_id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "authorized-by" {
    to       = rf.concept.service-identity
    via      = source.client_id
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "cloud-provider-azure-credential-lookup" {
  match {
    kind = "data"
    type = "grafana_cloud_provider_azure_credential"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id", "resource_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "resource_id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "authorized-by" {
    to       = rf.concept.service-identity
    via      = source.client_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"
  }
}
