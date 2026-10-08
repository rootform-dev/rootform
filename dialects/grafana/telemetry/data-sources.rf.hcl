concept "data-source" {
  description = "A Grafana connection to an external or hosted telemetry data source."
}

rule "data-source" {
  match {
    type = "grafana_data_source"
  }

  as = concept.data-source

  identity {
    attributes = ["id", "uid"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "uid"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.org_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "connects-through" {
    to       = concept.private-data-source-connect-network
    via      = source.private_data_source_connect_network_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.pdc_network_id
      strategy = "exact"
    }
  }
}

rule "data-source-lookup" {
  match {
    kind = "data"
    type = "grafana_data_source"
  }

  as = concept.data-source

  identity {
    attributes = ["id", "uid"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "uid"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.org_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "connects-through" {
    to       = concept.private-data-source-connect-network
    via      = source.private_data_source_connect_network_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.pdc_network_id
      strategy = "exact"
    }
  }
}
