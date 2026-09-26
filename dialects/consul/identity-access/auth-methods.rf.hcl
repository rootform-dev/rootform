concept "access-control-configuration" {
  description = "A binding or attachment supporting a Consul identity boundary."
}

concept "acl-auth-method" {
  description = "A Consul authentication boundary that verifies an external workload identity."
}

rule "acl-auth-method" {
  match {
    type = "consul_acl_auth_method"
  }

  as = concept.acl-auth-method

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "acl-auth-method-lookup" {
  match {
    kind = "data"
    type = "consul_acl_auth_method"
  }

  as = concept.acl-auth-method

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "acl-binding-rule" {
  match {
    type = "consul_acl_binding_rule"
  }

  as = concept.access-control-configuration

  contribution {
    to       = concept.acl-auth-method
    via      = source.auth_method
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
