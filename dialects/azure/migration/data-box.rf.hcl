# Maintained directly from pinned provider evidence.
rule "data-box-edge-device" {
  match {
    type = "azurerm_databox_edge_device"
  }

  as = concept.migration-service

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
