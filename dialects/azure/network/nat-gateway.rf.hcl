# Maintained directly from pinned provider evidence.
rule "nat-gateway" {
  match {
    type = "azurerm_nat_gateway"
  }

  as = concept.managed-nat

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

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

rule "nat-gateway-public-ip-association" {
  match {
    type = "azurerm_nat_gateway_public_ip_association"
  }

  as = concept.network-policy-detail

  contribution {
    to       = concept.managed-nat
    via      = source.nat_gateway_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.public-address
    via      = source.public_ip_address_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "nat-gateway-public-ip-prefix-association" {
  match {
    type = "azurerm_nat_gateway_public_ip_prefix_association"
  }

  as = concept.network-policy-detail

  contribution {
    to       = concept.managed-nat
    via      = source.nat_gateway_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.public-address
    via      = source.public_ip_prefix_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
