# Maintained directly from pinned provider evidence.
rule "point-to-site-vpn-gateway" {
  match {
    type = "azurerm_point_to_site_vpn_gateway"
  }

  as = concept.vpn-gateway

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

rule "virtual-network-gateway" {
  match {
    type = "azurerm_virtual_network_gateway"
  }

  as = concept.vpn-gateway

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

rule "virtual-network-gateway-connection" {
  match {
    type = "azurerm_virtual_network_gateway_connection"
  }

  as = concept.vpn-connection

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

rule "vpn-gateway" {
  match {
    type = "azurerm_vpn_gateway"
  }

  as = concept.vpn-gateway

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

rule "vpn-gateway-connection" {
  match {
    type = "azurerm_vpn_gateway_connection"
  }

  as = concept.vpn-connection
}

rule "vpn-site" {
  match {
    type = "azurerm_vpn_site"
  }

  as = concept.local-network-gateway

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
