concept "netapp-storage-pool" {
  description = "A NetApp Volumes storage pool providing capacity to volumes."
}

rule "filestore-instance" {
  match {
    type = "google_filestore_instance"
  }

  as = concept.managed-file-storage
}

rule "netapp-storage-pool" {
  match {
    type = "google_netapp_storage_pool"
  }

  as = concept.netapp-storage-pool

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "netapp-volume" {
  match {
    type = "google_netapp_volume"
  }

  as = concept.managed-file-storage

  context {
    as       = context.ownership
    to       = concept.netapp-storage-pool
    via      = source.storage_pool
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.id]
      strategy = "exact"
    }
  }
}

rule "parallelstore-instance" {
  match {
    type = "google_parallelstore_instance"
  }

  as = concept.managed-file-storage

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

rule "managed-lustre-instance" {
  match {
    type = "google_lustre_instance"
  }

  as = concept.managed-file-storage
}
