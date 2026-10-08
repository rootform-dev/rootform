policy "managed-database-network-context" {
  target {
    concept = rf.concept.managed-database
  }

  assert = (
    exists(contexts(rf.context.network, rf.concept.virtual-network)) ||
    exists(contexts(rf.context.network, rf.concept.subnet))
  )

  message = "Managed databases must belong to a network context."
}
