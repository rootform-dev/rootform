concept "namespace" {
  description = "A namespace partitioning one cluster's workloads, services, and storage."
}

rule "kubernetes-namespace" {
  match {
    type = "kubernetes_namespace_v1"
  }

  as = concept.namespace

  identity {
    attributes = ["id", "metadata[0].name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "metadata[0].name"]
  }

  context {
    as       = rf.context.runtime
    to       = rf.concept.kubernetes-cluster
    via      = provider.host
    on_null  = "indeterminate"
    on_empty = "indeterminate"
  }
}
