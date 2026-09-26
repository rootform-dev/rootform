concept "network-configuration" {
  description = "A route or supporting setting attached to HCP network connectivity."
}

concept "private-link-service" {
  description = "A provider-side private connectivity service exposing an HCP Vault Dedicated cluster to approved consumers."
}

concept "transit-gateway-attachment" {
  description = "An attachment connecting an HVN to an AWS Transit Gateway."
}

rule "aws-network-peering" {
  match {
    type = "hcp_aws_network_peering"
  }

  as = concept.network-peering

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.hvn_id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "peers-with" {
    to       = rf.concept.virtual-network
    via      = source.peer_vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "aws-network-peering-lookup" {
  match {
    kind = "data"
    type = "hcp_aws_network_peering"
  }

  as = concept.network-peering

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.hvn_id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "peers-with" {
    to       = rf.concept.virtual-network
    via      = source.peer_vpc_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "aws-transit-gateway-attachment" {
  match {
    type = "hcp_aws_transit_gateway_attachment"
  }

  as = concept.transit-gateway-attachment

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.hvn_id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "aws-transit-gateway-attachment-lookup" {
  match {
    kind = "data"
    type = "hcp_aws_transit_gateway_attachment"
  }

  as = concept.transit-gateway-attachment

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.hvn_id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "azure-peering-connection" {
  match {
    type = "hcp_azure_peering_connection"
  }

  as = concept.network-peering

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_link
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.self_link
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "peers-with" {
    to       = rf.concept.virtual-network
    via      = source.peer_vnet_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "azure-peering-connection-lookup" {
  match {
    kind = "data"
    type = "hcp_azure_peering_connection"
  }

  as = concept.network-peering

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_link
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.self_link
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "peers-with" {
    to       = rf.concept.virtual-network
    via      = source.peer_vnet_name
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "hvn-peering-connection" {
  match {
    type = "hcp_hvn_peering_connection"
  }

  as = concept.network-peering

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_1
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.self_link
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "peers-with" {
    to       = rf.concept.virtual-network
    via      = source.hvn_2
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.self_link
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "hvn-peering-connection-lookup" {
  match {
    kind = "data"
    type = "hcp_hvn_peering_connection"
  }

  as = concept.network-peering

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_1
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.self_link
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "peers-with" {
    to       = rf.concept.virtual-network
    via      = source.hvn_2
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.self_link
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "hvn-route" {
  match {
    type = "hcp_hvn_route"
  }

  as = concept.network-configuration

  contribution {
    to       = rf.concept.virtual-network
    via      = source.hvn_link
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.self_link
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "hvn-route-lookup" {
  match {
    kind = "data"
    type = "hcp_hvn_route"
  }

  as = concept.network-configuration

  contribution {
    to       = rf.concept.virtual-network
    via      = source.hvn_link
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.self_link
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "private-link" {
  match {
    type = "hcp_private_link"
  }

  as = concept.private-link-service

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.hvn_id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "exposes-vault-cluster" {
    to       = concept.vault-dedicated-cluster
    via      = source.vault_cluster_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.cluster_id
      strategy = "exact"
    }
  }
}

rule "private-link-lookup" {
  match {
    kind = "data"
    type = "hcp_private_link"
  }

  as = concept.private-link-service

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.hvn_id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "exposes-vault-cluster" {
    to       = concept.vault-dedicated-cluster
    via      = source.vault_cluster_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.cluster_id
      strategy = "exact"
    }
  }
}
