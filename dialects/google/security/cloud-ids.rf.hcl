concept "cloud-ids-endpoint" {
  description = "A Cloud IDS endpoint inspecting traffic in a VPC network."
}

rule "cloud-ids-endpoint" {
  match {
    type = "google_cloud_ids_endpoint"
  }

  as = concept.cloud-ids-endpoint

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
