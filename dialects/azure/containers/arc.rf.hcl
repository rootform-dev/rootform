# Maintained directly from pinned provider evidence.
rule "arc-kubernetes-cluster" {
  match {
    type = "azurerm_arc_kubernetes_cluster"
  }

  as = rf.concept.kubernetes-cluster

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

rule "arc-provisioned-kubernetes-cluster" {
  match {
    type = "azurerm_arc_kubernetes_provisioned_cluster"
  }

  as = rf.concept.kubernetes-cluster

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
