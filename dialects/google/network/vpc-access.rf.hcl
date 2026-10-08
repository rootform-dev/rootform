concept "serverless-vpc-access-connector" {
  description = "A Serverless VPC Access connector bridging serverless workloads to a VPC network."
}

rule "serverless-vpc-access-connector" {
  match {
    type = "google_vpc_access_connector"
  }

  as = concept.serverless-vpc-access-connector

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "self_link"]
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
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.subnet[0].name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.id, target.self_link]
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
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
