concept "stage" {
  description = "A named Snowflake stage for loading, unloading, or serving files."
}

rule "stage" {
  match {
    type = "snowflake_stage"
  }

  as = concept.stage

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-storage-integration" {
    to       = concept.storage-integration
    via      = source.storage_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "accesses-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.url
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "external-azure-stage" {
  match {
    type = "snowflake_stage_external_azure"
  }

  as = concept.stage

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-storage-integration" {
    to       = concept.storage-integration
    via      = source.storage_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "accesses-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.url
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "uses-notification-integration" {
    to       = concept.notification-integration
    via      = source.directory[0].notification_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "external-gcs-stage" {
  match {
    type = "snowflake_stage_external_gcs"
  }

  as = concept.stage

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-storage-integration" {
    to       = concept.storage-integration
    via      = source.storage_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "accesses-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.url
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "uses-notification-integration" {
    to       = concept.notification-integration
    via      = source.directory[0].notification_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

}

rule "external-s3-stage" {
  match {
    type = "snowflake_stage_external_s3"
  }

  as = concept.stage

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-storage-integration" {
    to       = concept.storage-integration
    via      = source.storage_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "accesses-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.url
    on_null  = "absent"
    on_empty = "absent"
  }

}

rule "external-s3-compatible-stage" {
  match {
    type = "snowflake_stage_external_s3_compatible"
  }

  as = concept.stage

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "accesses-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.url
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "internal-stage" {
  match {
    type = "snowflake_stage_internal"
  }

  as = concept.stage

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}
