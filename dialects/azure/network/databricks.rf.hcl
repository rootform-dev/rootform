# Maintained directly from pinned provider evidence.
rule "databricks-virtual-network-peering" {
  match {
    type = "azurerm_databricks_virtual_network_peering"
  }

  as = concept.network-peering

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
