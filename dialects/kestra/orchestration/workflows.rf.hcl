concept "namespace" {
  description = "A Kestra namespace that organizes orchestration resources."
}

concept "flow" {
  description = "A declaratively managed Kestra orchestration flow."
}

rule "namespace" {
  match {
    type = "kestra_namespace"
  }

  as = concept.namespace

  identity {
    attributes = ["namespace_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "namespace_id"]
  }
}

rule "flow" {
  match {
    type = "kestra_flow"
  }

  as = concept.flow

  context {
    as  = context.ownership
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
