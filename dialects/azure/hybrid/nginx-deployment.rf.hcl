# Maintained directly from pinned provider evidence.
rule "nginx-deployment" {
  match {
    type = "azurerm_nginx_deployment"
  }

  as = concept.hybrid-platform

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
