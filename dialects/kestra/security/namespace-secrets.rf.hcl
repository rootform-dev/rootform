concept "namespace-secret" {
  description = "A secret declaration attached to a Kestra namespace."
}

rule "namespace-secret" {
  match {
    type = "kestra_namespace_secret"
  }

  as = concept.namespace-secret

  contribution {
    to  = concept.namespace
    via = source.namespace

    on_null  = "absent"
    on_empty = "absent"

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
    match {
      by       = target.namespace_id
      strategy = "dot-ancestor"
    }
  }
}
