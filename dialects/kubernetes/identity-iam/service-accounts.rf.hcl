concept "service-account" {
  description = "An identity a pod runs under inside the cluster."
}

rule "kubernetes-service-account" {
  match {
    type = "kubernetes_service_account_v1"
  }

  as = concept.service-account

  identity {
    attributes = ["id"]
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

  context {
    as  = context.ownership
    to  = concept.namespace
    via = source.metadata[0].namespace

    on_null  = "absent"
    on_empty = "absent"

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
    match {
      by       = target.metadata[0].name
      strategy = "exact"
    }
  }
}
