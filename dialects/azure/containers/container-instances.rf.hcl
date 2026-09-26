# Maintained directly from pinned provider evidence.
concept "container-instance-group" {
  description = "An Azure Container Instances container group scheduled as one unit."
}

rule "container-instance-group" {
  match {
    type = "azurerm_container_group"
  }

  as = concept.container-instance-group

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
