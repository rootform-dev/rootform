policy "cluster-network-context" {
  target {
    concept = rf.concept.kubernetes-cluster
  }

  assert = (
    exists(contexts(rf.context.network, rf.concept.virtual-network)) ||
    exists(contexts(rf.context.network, rf.concept.subnet))
  )

  message = "Kubernetes clusters must belong to a network context."
}
