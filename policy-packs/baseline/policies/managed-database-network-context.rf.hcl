policy "managed-database-network-context" {
  target {
    concept = rf.concept.managed-database
  }

  assert = exists(contexts(rf.context.network, rf.concept.virtual-network))

  message = "Managed databases must declare a virtual-network context."
}
