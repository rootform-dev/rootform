rule "hvn" {
  match {
    type = "hcp_hvn"
  }

  as = rf.concept.virtual-network

  identity {
    attributes = ["id", "hvn_id", "self_link"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "hvn_id", "self_link"]
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

rule "hvn-lookup" {
  match {
    kind = "data"
    type = "hcp_hvn"
  }

  as = rf.concept.virtual-network

  identity {
    attributes = ["id", "hvn_id", "self_link"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "hvn_id", "self_link"]
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
