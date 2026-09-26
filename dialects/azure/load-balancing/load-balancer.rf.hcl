# Maintained directly from pinned provider evidence.
rule "application-load-balancer" {
  match {
    type = "azurerm_application_load_balancer"
  }

  as = concept.load-balancer

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

rule "application-load-balancer-frontend" {
  match {
    type = "azurerm_application_load_balancer_frontend"
  }

  as = concept.load-balancer-component
}

rule "load-balancer-nat-rule" {
  match {
    type = "azurerm_lb_nat_rule"
  }

  as = concept.load-balancer-component
}

rule "load-balancer-outbound-rule" {
  match {
    type = "azurerm_lb_outbound_rule"
  }

  as = concept.load-balancer-component
}

rule "load-balancer-probe" {
  match {
    type = "azurerm_lb_probe"
  }

  as = concept.load-balancer-component
}
