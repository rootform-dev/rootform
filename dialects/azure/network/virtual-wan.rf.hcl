# Maintained directly from pinned provider evidence.
concept "virtual-wan" {
  description = "An Azure Virtual WAN global transit network."
}

rule "virtual-wan" {
  match {
    type = "azurerm_virtual_wan"
  }

  as = concept.virtual-wan

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
