concept "private-data-source-connect-network" {
  description = "A Grafana Cloud PDC network connecting a stack to data sources hosted on a private network."
}

rule "cloud-private-data-source-connect-network" {
  match {
    type = "grafana_cloud_private_data_source_connect_network"
  }

  as = concept.private-data-source-connect-network

  identity {
    attributes = ["id", "pdc_network_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "pdc_network_id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_identifier
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.slug, target.id]
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
