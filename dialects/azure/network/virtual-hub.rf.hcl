# Maintained directly from pinned provider evidence.

concept "virtual-hub" {
  description = "An Azure Virtual WAN regional transit hub."
}

rule "virtual-hub" {
  match {
    type = "azurerm_virtual_hub"
  }

  as = concept.virtual-hub

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
