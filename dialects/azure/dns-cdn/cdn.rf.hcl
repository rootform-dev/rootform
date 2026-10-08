# Maintained directly from pinned provider evidence.
concept "content-delivery-profile" {
  description = "An Azure content delivery profile serving cached content globally."
}

rule "cdn-endpoint" {
  match {
    type = "azurerm_cdn_endpoint"
  }

  as = concept.content-delivery-profile

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

rule "cdn-profile" {
  match {
    type = "azurerm_cdn_profile"
  }

  as = concept.content-delivery-profile

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
