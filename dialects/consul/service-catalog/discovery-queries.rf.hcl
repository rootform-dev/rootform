rule "prepared-query" {
  match {
    type = "consul_prepared_query"
  }

  as = concept.discovery-chain-configuration

  contribution {
    to       = concept.consul-service
    via      = source.service
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "service-health-lookup" {
  match {
    kind = "data"
    type = "consul_service_health"
  }

  as = concept.operations-configuration

  contribution {
    to       = concept.consul-service
    via      = source.name
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
