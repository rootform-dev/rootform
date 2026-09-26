
concept "consul-node" {
  description = "A node registered in the Consul service catalog."
}

concept "consul-service" {
  description = "A service registered or selected in the Consul catalog."
}

rule "agent-service" {
  match {
    type = "consul_agent_service"
  }

  as = concept.consul-service

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}


rule "catalog-service-lookup" {
  match {
    kind = "data"
    type = "consul_catalog_service"
  }

  as = concept.consul-service

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "node" {
  match {
    type = "consul_node"
  }

  as = concept.consul-node

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "service" {
  match {
    type = "consul_service"
  }

  as = concept.consul-service

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = rf.context.runtime
    to       = concept.consul-node
    via      = source.node
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
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

rule "service-lookup" {
  match {
    kind = "data"
    type = "consul_service"
  }

  as = concept.consul-service

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}
