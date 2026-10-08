rule "load-balancer" {
  match {
    type = "azurerm_lb"
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

rule "application-gateway" {
  match {
    type = "azurerm_application_gateway"
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
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.gateway_ip_configuration[0].subnet_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
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

  relation "uses-waf-policy" {
    to       = concept.web-application-firewall-policy
    via      = source.firewall_policy_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "load-balancer-backend-pool" {
  match {
    type = "azurerm_lb_backend_address_pool"
  }

  as = concept.load-balancer-component

  contribution {
    to       = concept.load-balancer
    via      = source.loadbalancer_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "load-balancer-rule" {
  match {
    type = "azurerm_lb_rule"
  }

  as = concept.load-balancer-component

  contribution {
    to       = concept.load-balancer
    via      = source.loadbalancer_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
