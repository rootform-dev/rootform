concept "backup-export-destination" {
  description = "A MongoDB Atlas cloud backup export destination backed by customer object storage."
}

concept "backup-configuration" {
  description = "A backup compliance or retention configuration supporting an Atlas project."
}

rule "cloud-backup-schedule" {
  match {
    type = "mongodbatlas_cloud_backup_schedule"
  }

  as = concept.backup-plan

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "protects" {
    to       = rf.concept.managed-database
    via      = source.cluster_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "exports-to" {
    to       = concept.backup-export-destination
    via      = source.export[0].export_bucket_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.export_bucket_id
      strategy = "exact"
    }
  }
}

rule "cloud-backup-export-destination" {
  match {
    type = "mongodbatlas_cloud_backup_snapshot_export_bucket"
  }

  as = concept.backup-export-destination

  identity {
    attributes = ["id", "export_bucket_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "export_bucket_id"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "stores-in" {
    to       = rf.concept.object-storage-container
    via      = source.bucket_name
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "uses-cloud-authorization" {
    to       = concept.cloud-provider-authorization
    via      = source.iam_role_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.role_id
      strategy = "exact"
    }

    # Shared cloud-provider-authorization instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-authorization" {
    to       = concept.cloud-provider-authorization
    via      = source.role_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.role_id
      strategy = "exact"
    }

    # Shared cloud-provider-authorization instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "backup-compliance-policy" {
  match {
    type = "mongodbatlas_backup_compliance_policy"
  }

  as = concept.backup-configuration

  contribution {
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
