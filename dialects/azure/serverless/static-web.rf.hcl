# Maintained directly from pinned provider evidence.
concept "static-web-app" {
  description = "An Azure Static Web Apps site with managed hosting and APIs."
}

rule "static-web-app" {
  match {
    type = "azurerm_static_web_app"
  }

  as = concept.static-web-app

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
