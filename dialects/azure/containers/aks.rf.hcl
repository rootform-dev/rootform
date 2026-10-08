rule "aks-cluster" {
  match {
    type = "azurerm_kubernetes_cluster"
  }

  as = rf.concept.kubernetes-cluster

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  # A Kubernetes provider block names its cluster through the kubeconfig
  # host. Only the verified reference pairs; the sensitive value is never read.
  endpoint {
    attributes = ["id", "kube_config[0].host", "kube_admin_config[0].host"]
  }

  context {
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.default_node_pool[0].vnet_subnet_id
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

  relation "observed-by" {
    to       = concept.log-analytics-workspace
    via      = source.oms_agent[0].log_analytics_workspace_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared log-analytics-workspace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "aks-node-pool" {
  match {
    type = "azurerm_kubernetes_cluster_node_pool"
  }

  as = concept.kubernetes-node-pool

  context {
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.vnet_subnet_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = rf.concept.kubernetes-cluster
    via      = source.kubernetes_cluster_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared kubernetes-cluster instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
