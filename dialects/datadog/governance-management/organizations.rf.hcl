concept "organization-connection" {
  description = "A Datadog cross-organization metrics or logs visibility connection."
}

rule "child-organization" {
  match {
    type = "datadog_child_organization"
  }

  as = concept.observability-tenant

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  # The provider sets the resource id to the organization public_id, and
  # org connections name their sink organization by that value.
  endpoint {
    attributes = ["id", "public_id"]
  }
}

rule "org-connection" {
  match {
    type = "datadog_org_connection"
  }

  as = concept.organization-connection

  relation "shares-telemetry-with" {
    to       = concept.observability-tenant
    via      = source.sink_org_id
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
