rule "instance" {
  match {
    type = "aws_instance"
  }

  as = concept.compute-instance

  context {
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.subnet_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
