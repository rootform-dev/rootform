concept "cloud-run-service" {
  description = "A Cloud Run service that handles requests or events on managed container instances."
}

concept "cloud-run-job" {
  description = "A Cloud Run job that runs tasks to completion."
}

rule "cloud-run-service" {
  match {
    type = "google_cloud_run_v2_service"
  }

  as = concept.cloud-run-service

  identity {
    attributes = ["id", "uri"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "uri"]
  }

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.template[0].vpc_access[0].network_interfaces[0].network
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
    via      = source.template[0].vpc_access[0].network_interfaces[0].subnetwork
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.id, target.self_link, target.name]
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

  relation "routes-to" {
    to       = concept.serverless-vpc-access-connector
    via      = source.template[0].vpc_access[0].connector
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "runs-as" {
    to       = rf.concept.service-identity
    via      = source.template[0].service_account
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.email
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "cloud-run-job" {
  match {
    type = "google_cloud_run_v2_job"
  }

  as = concept.cloud-run-job

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

rule "cloud-run-service-v1" {
  match {
    type = "google_cloud_run_service"
  }

  as = concept.cloud-run-service

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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

rule "cloud-run-worker-pool" {
  match {
    type = "google_cloud_run_v2_worker_pool"
  }

  as = concept.cloud-run-service

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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
