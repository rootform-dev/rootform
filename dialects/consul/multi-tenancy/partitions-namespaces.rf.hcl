concept "admin-partition" {
  description = "A Consul Enterprise administrative and communication boundary."
}

concept "namespace" {
  description = "A Consul Enterprise tenant boundary within an admin partition."
}

rule "admin-partition" {
  match {
    type = "consul_admin_partition"
  }

  as = concept.admin-partition

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "namespace" {
  match {
    type = "consul_namespace"
  }

  as = concept.namespace

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.admin-partition
    via      = source.partition
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "namespace-policy-attachment" {
  match {
    type = "consul_namespace_policy_attachment"
  }

  as = concept.access-control-configuration

  contribution {
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

rule "namespace-role-attachment" {
  match {
    type = "consul_namespace_role_attachment"
  }

  as = concept.access-control-configuration

  contribution {
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
