concept "access-role" {
  description = "A Kestra role defining an access permission set."
}

concept "access-binding" {
  description = "A Kestra role binding for an external principal."
}

rule "group" {
  match {
    type = "kestra_group"
  }

  as = concept.identity-group

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

rule "role" {
  match {
    type = "kestra_role"
  }

  as = concept.access-role

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

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

rule "existing-role" {
  match {
    kind = "data"
    type = "kestra_role"
  }

  as = concept.access-role

  identity {
    attributes = ["role_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "role_id"]
  }
}

rule "binding" {
  match {
    type = "kestra_binding"
  }

  as = concept.access-binding

  contribution {
    to  = concept.access-role
    via = source.role_id

    on_null  = "absent"
    on_empty = "absent"
    match {
      by       = target.id
      strategy = "exact"
    }

    # Kestra generates role IDs and one provider configuration addresses one tenant, so a separate configuration can provision the role.
    external = "allow"
  }
}
