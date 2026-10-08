concept "boundary-cluster" {
  description = "A HashiCorp-managed Boundary control plane on HCP."
}

rule "boundary-cluster" {
  match {
    type = "hcp_boundary_cluster"
  }

  as = concept.boundary-cluster

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

rule "boundary-cluster-lookup" {
  match {
    kind = "data"
    type = "hcp_boundary_cluster"
  }

  as = concept.boundary-cluster

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
