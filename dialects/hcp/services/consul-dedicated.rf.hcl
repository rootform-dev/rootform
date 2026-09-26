concept "consul-configuration" {
  description = "A legacy snapshot or supporting setting for an HCP Consul Dedicated cluster."
}

concept "consul-dedicated-cluster" {
  description = "A legacy HCP Consul Dedicated cluster retained for provider-state architecture after end of life."
}

rule "consul-cluster" {
  match {
    type = "hcp_consul_cluster"
  }

  as = concept.consul-dedicated-cluster

  identity {
    attributes = ["id", "cluster_id", "self_link"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "cluster_id", "self_link"]
  }

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

  relation "replicates-from" {
    to       = concept.consul-dedicated-cluster
    via      = source.primary_link
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.self_link
      strategy = "exact"
    }
  }
}

rule "consul-cluster-lookup" {
  match {
    kind = "data"
    type = "hcp_consul_cluster"
  }

  as = concept.consul-dedicated-cluster

  identity {
    attributes = ["id", "cluster_id", "self_link"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "cluster_id", "self_link"]
  }

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

  relation "replicates-from" {
    to       = concept.consul-dedicated-cluster
    via      = source.primary_link
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.self_link
      strategy = "exact"
    }
  }
}

rule "consul-snapshot" {
  match {
    type = "hcp_consul_snapshot"
  }

  as = concept.consul-configuration

  contribution {
    to       = concept.consul-dedicated-cluster
    via      = source.cluster_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.cluster_id
      strategy = "exact"
    }
  }
}
