rule "virtual-network" {
  match {
    type = "azurerm_virtual_network"
  }

  as = rf.concept.virtual-network

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

rule "subnet" {
  match {
    type = "azurerm_subnet"
  }

  as = rf.concept.subnet

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.virtual_network_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
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
