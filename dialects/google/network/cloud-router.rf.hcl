concept "cloud-router" {
  description = "A Cloud Router exchanging dynamic routes for a VPC network."
}

rule "cloud-router" {
  match {
    type = "google_compute_router"
  }

  as = concept.cloud-router

  identity {
    attributes = ["id", "self_link", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "self_link", "name"]
  }

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
    as       = context.ownership
    to       = concept.google-cloud-project
    via      = source.project
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.project_id
      strategy = "exact"
    }

    # Shared google-cloud-project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
