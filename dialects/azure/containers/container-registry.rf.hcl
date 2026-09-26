# Maintained directly from pinned provider evidence.
concept "container-registry" {
  description = "An Azure Container Registry storing and distributing OCI artifacts."
}

rule "connected-container-registry" {
  match {
    type = "azurerm_container_connected_registry"
  }

  as = concept.container-registry
}

rule "container-registry" {
  match {
    type = "azurerm_container_registry"
  }

  as = concept.container-registry

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
