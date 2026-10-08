concept "cloud-integration-configuration" {
  description = "Cloud-service selections supporting a linked New Relic cloud account."
}

rule "cloud-account-lookup" {
  match {
    kind = "data"
    type = "newrelic_cloud_account"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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

rule "cloud-aws-eu-sovereign-integrations" {
  match {
    type = "newrelic_cloud_aws_eu_sovereign_integrations"
  }

  as = concept.cloud-integration-configuration

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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
    via      = source.linked_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "cloud-aws-eu-sovereign-link-account" {
  match {
    type = "newrelic_cloud_aws_eu_sovereign_link_account"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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

rule "cloud-aws-govcloud-integrations" {
  match {
    type = "newrelic_cloud_aws_govcloud_integrations"
  }

  as = concept.cloud-integration-configuration

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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
    via      = source.linked_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "cloud-aws-govcloud-link-account" {
  match {
    type = "newrelic_cloud_aws_govcloud_link_account"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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

rule "cloud-aws-integrations" {
  match {
    type = "newrelic_cloud_aws_integrations"
  }

  as = concept.cloud-integration-configuration

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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
    via      = source.linked_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "cloud-aws-link-account" {
  match {
    type = "newrelic_cloud_aws_link_account"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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

rule "cloud-azure-integrations" {
  match {
    type = "newrelic_cloud_azure_integrations"
  }

  as = concept.cloud-integration-configuration

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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
    via      = source.linked_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "cloud-azure-link-account" {
  match {
    type = "newrelic_cloud_azure_link_account"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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

rule "cloud-gcp-dm-integrations" {
  match {
    type = "newrelic_cloud_gcp_dm_integrations"
  }

  as = concept.cloud-integration-configuration

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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
    via      = source.linked_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "cloud-gcp-integrations" {
  match {
    type = "newrelic_cloud_gcp_integrations"
  }

  as = concept.cloud-integration-configuration

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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
    via      = source.linked_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "cloud-gcp-link-account" {
  match {
    type = "newrelic_cloud_gcp_link_account"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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
    via      = source.service_account_email
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "cloud-oci-link-account" {
  match {
    type = "newrelic_cloud_oci_link_account"
  }

  as = concept.cloud-observability-integration

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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
