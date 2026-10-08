# Maintained directly from pinned provider evidence.
concept "kubernetes-fleet" {
  description = "An Azure Kubernetes Fleet Manager fleet coordinating Kubernetes clusters."
}

rule "kubernetes-fleet" {
  match {
    type = "azurerm_kubernetes_fleet_manager"
  }

  as = concept.kubernetes-fleet

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
