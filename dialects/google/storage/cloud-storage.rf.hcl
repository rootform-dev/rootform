rule "cloud-storage-bucket" {
  match {
    type = "google_storage_bucket"
  }

  as = rf.concept.object-storage-container

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "self_link"]
  }
}

rule "cloud-storage-bucket-iam-member" {
  match {
    type = "google_storage_bucket_iam_member"
  }

  as = concept.access-binding

  contribution {
    to  = rf.concept.object-storage-container
    via = source.bucket

    on_null  = "absent"
    on_empty = "absent"

    # Shared object-storage-container instances can be provisioned by a separate configuration.
    external = "allow"
    match {
      by       = target.name
      strategy = "last-segment"
    }
  }
}
