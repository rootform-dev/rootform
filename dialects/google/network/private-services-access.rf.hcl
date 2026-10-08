rule "service-networking-connection" {
  match {
    type = "google_service_networking_connection"
  }

  as = concept.service-networking-detail

  contribution {
    to       = rf.concept.virtual-network
    via      = source.network
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.id, target.self_link, target.name]
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "private-services-access-range" {
  match {
    type  = "google_compute_global_address"
    where = source.purpose == "VPC_PEERING" && source.address_type == "INTERNAL"
  }

  as = concept.allocated-network-range

  contribution {
    to       = rf.concept.virtual-network
    via      = source.network
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.id, target.self_link, target.name]
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
