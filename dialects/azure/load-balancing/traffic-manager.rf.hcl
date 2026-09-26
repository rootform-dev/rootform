# Maintained directly from pinned provider evidence.
concept "traffic-manager-profile" {
  description = "An Azure Traffic Manager DNS traffic-routing profile."
}

rule "traffic-manager-azure-endpoint" {
  match {
    type = "azurerm_traffic_manager_azure_endpoint"
  }

  as = concept.load-balancer-component
}

rule "traffic-manager-profile" {
  match {
    type = "azurerm_traffic_manager_profile"
  }

  as = concept.traffic-manager-profile

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
