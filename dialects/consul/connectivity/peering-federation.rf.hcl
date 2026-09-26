concept "cluster-peering" {
  description = "A Consul cluster peering connection for exported service discovery and mesh traffic."
}


concept "sameness-group" {
  description = "A Consul group of partitions or peers with equivalent service instances."
}

concept "service-export" {
  description = "A service export detail for peers, partitions, or sameness groups."
}

rule "config-entry-exported-services-json" {
  match {
    type  = "consul_config_entry"
    where = source.kind == "exported-services"
  }

  as = concept.service-export
}

rule "config-entry-exported-services-json-lookup" {
  match {
    kind  = "data"
    type  = "consul_config_entry"
    where = source.kind == "exported-services"
  }

  as = concept.service-export
}

rule "config-entry-sameness-group-json" {
  match {
    type  = "consul_config_entry"
    where = source.kind == "sameness-group"
  }

  as = concept.sameness-group

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "config-entry-sameness-group-json-lookup" {
  match {
    kind  = "data"
    type  = "consul_config_entry"
    where = source.kind == "sameness-group"
  }

  as = concept.sameness-group

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "config-entry-v2-exported-services" {
  match {
    type = "consul_config_entry_v2_exported_services"
  }

  as = concept.service-export

  contribution {
    to       = concept.consul-service
    via      = source.services
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.cluster-peering
    via      = source.peer_consumers
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.peer_name
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.sameness-group
    via      = source.sameness_group_consumers
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "config-entry-v2-exported-services-lookup" {
  match {
    kind = "data"
    type = "consul_config_entry_v2_exported_services"
  }

  as = concept.service-export

  contribution {
    to       = concept.consul-service
    via      = source.services
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.cluster-peering
    via      = source.peer_consumers
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.peer_name
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.sameness-group
    via      = source.sameness_group_consumers
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}


rule "peering" {
  match {
    type = "consul_peering"
  }

  as = concept.cluster-peering

  identity {
    attributes = ["id", "peer_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "peer_name"]
  }
}

rule "peering-lookup" {
  match {
    kind = "data"
    type = "consul_peering"
  }

  as = concept.cluster-peering

  identity {
    attributes = ["id", "peer_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "peer_name"]
  }
}
