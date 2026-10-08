# Maintained directly from pinned provider evidence.
concept "route-table" {
  description = "An Azure route table controlling subnet traffic paths."
}

rule "route-server" {
  match {
    type = "azurerm_route_server"
  }

  as = concept.route-table

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

rule "route-table" {
  match {
    type = "azurerm_route_table"
  }

  as = concept.route-table

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

rule "subnet-route-table-association" {
  match {
    type = "azurerm_subnet_route_table_association"
  }

  as = concept.network-policy-detail
}
