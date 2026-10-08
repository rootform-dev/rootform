# Maintained directly from pinned provider evidence.
rule "subnet-nat-gateway-association" {
  match {
    type = "azurerm_subnet_nat_gateway_association"
  }

  as = concept.network-policy-detail

  contribution {
    to       = rf.concept.subnet
    via      = source.subnet_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
    external = "allow"
  }

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
}

rule "subnet-network-security-group-association" {
  match {
    type = "azurerm_subnet_network_security_group_association"
  }

  as = concept.network-policy-detail
}
