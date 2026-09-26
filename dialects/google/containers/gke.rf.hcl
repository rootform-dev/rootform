rule "gke-cluster" {
  match {
    type = "google_container_cluster"
  }

  as = rf.concept.kubernetes-cluster

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "self_link", "endpoint"]
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

rule "gke-node-pool" {
  match {
    type = "google_container_node_pool"
  }

  as = concept.kubernetes-node-pool

  contribution {
    to       = rf.concept.kubernetes-cluster
    via      = source.cluster
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.id, target.self_link]
      strategy = "exact"
    }

    # Shared kubernetes-cluster instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "gke-attached-cluster" {
  match {
    type = "google_container_attached_cluster"
  }

  as = rf.concept.kubernetes-cluster

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "gke-aws-cluster" {
  match {
    type = "google_container_aws_cluster"
  }

  as = rf.concept.kubernetes-cluster

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "gke-aws-node-pool" {
  match {
    type = "google_container_aws_node_pool"
  }

  as = concept.kubernetes-node-pool
}

rule "gke-azure-cluster" {
  match {
    type = "google_container_azure_cluster"
  }

  as = rf.concept.kubernetes-cluster

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "gke-azure-node-pool" {
  match {
    type = "google_container_azure_node_pool"
  }

  as = concept.kubernetes-node-pool
}
