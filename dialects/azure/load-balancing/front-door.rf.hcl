# Maintained directly from pinned provider evidence.
concept "front-door-profile" {
  description = "An Azure Front Door global application delivery profile."
}

rule "classic-front-door" {
  match {
    type = "azurerm_frontdoor"
  }

  as = concept.front-door-profile

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

rule "front-door-endpoint" {
  match {
    type = "azurerm_cdn_frontdoor_endpoint"
  }

  as = concept.load-balancer-component
}

rule "front-door-origin" {
  match {
    type = "azurerm_cdn_frontdoor_origin"
  }

  as = concept.load-balancer-component
}

rule "front-door-origin-group" {
  match {
    type = "azurerm_cdn_frontdoor_origin_group"
  }

  as = concept.load-balancer-component
}

rule "front-door-profile" {
  match {
    type = "azurerm_cdn_frontdoor_profile"
  }

  as = concept.front-door-profile

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

rule "front-door-route" {
  match {
    type = "azurerm_cdn_frontdoor_route"
  }

  as = concept.load-balancer-component
}
