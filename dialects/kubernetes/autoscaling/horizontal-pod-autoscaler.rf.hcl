concept "horizontal-pod-autoscaler" {
  description = "A controller that scales a workload by observed demand."
}

rule "kubernetes-horizontal-pod-autoscaler" {
  match {
    type = "kubernetes_horizontal_pod_autoscaler_v1"
  }

  as = concept.horizontal-pod-autoscaler

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
