
rule "vpc-network-peering" {
  match {
    type = "google_compute_network_peering"
  }

  as = concept.network-peering

  context {
    as       = rf.context.network
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

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.peer_network
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

rule "cloud-nat" {
  match {
    type = "google_compute_router_nat"
  }

  as = concept.managed-nat

  context {
    as       = context.ownership
    to       = concept.cloud-router
    via      = source.router
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.id, target.self_link]
      strategy = "exact"
    }
  }
}

rule "ha-vpn-gateway" {
  match {
    type = "google_compute_ha_vpn_gateway"
  }

  as = concept.vpn-gateway

  context {
    as       = rf.context.network
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

rule "classic-vpn-gateway" {
  match {
    type = "google_compute_vpn_gateway"
  }

  as = concept.vpn-gateway

  context {
    as       = rf.context.network
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


rule "private-service-connect-endpoint" {
  match {
    type  = "google_compute_forwarding_rule"
    where = source.load_balancing_scheme == ""
  }

  as = concept.private-endpoint

  context {
    as       = rf.context.network
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

  context {
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.subnetwork
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.id, target.self_link, target.name]
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
