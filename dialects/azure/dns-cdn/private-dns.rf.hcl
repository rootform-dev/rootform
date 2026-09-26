rule "private-dns-zone" {
  match {
    type = "azurerm_private_dns_zone"
  }

  as = concept.dns-zone

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as  = context.ownership
    to  = concept.resource-group
    via = source.resource_group_name

    on_null  = "absent"
    on_empty = "absent"

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "private-dns-zone-vnet-link" {
  match {
    type = "azurerm_private_dns_zone_virtual_network_link"
  }

  as = concept.private-network-link

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.private_dns_zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.private_dns_zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = rf.concept.virtual-network
    via      = source.virtual_network_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
