policy "network-context" {
  target {
    rules = [aws.rule.subnet, aws.rule.instance]
  }

  assert  = exists(contexts(rf.context.network))
  message = "Network resources must have an established network context."
}
