# Maintained directly from pinned provider evidence.
concept "managed-grafana" {
  description = "An Azure Managed Grafana workspace."
}

rule "managed-grafana" {
  match {
    type = "azurerm_dashboard_grafana"
  }

  as = concept.managed-grafana

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
