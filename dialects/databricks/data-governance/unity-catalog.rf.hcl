concept "unity-catalog-metastore" {
  description = "A regional Unity Catalog metastore governing Databricks data and AI assets."
}

concept "unity-catalog-catalog" {
  description = "A Unity Catalog catalog organizing governed data and AI assets."
}

concept "unity-catalog-schema" {
  description = "A Unity Catalog schema organizing tables, volumes, models, and functions within a catalog."
}

concept "external-location" {
  description = "A Unity Catalog external location pairing a cloud storage path with a storage credential."
}

concept "storage-credential" {
  description = "A Unity Catalog credential authorizing access to cloud storage."
}

concept "service-credential" {
  description = "A Unity Catalog credential authorizing access to a cloud service."
}

concept "unity-catalog-volume" {
  description = "A Unity Catalog volume governing file storage for non-tabular data."
}

concept "unity-catalog-data-detail" {
  description = "A governed data object or configuration within Unity Catalog."
}

concept "unity-catalog-access-detail" {
  description = "An assignment, binding, or access configuration supporting Unity Catalog."
}

rule "unity-catalog-metastore" {
  match {
    type = "databricks_metastore"
  }

  as = concept.unity-catalog-metastore

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  relation "stores-in" {
    to       = rf.concept.object-storage-container
    via      = source.storage_root
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "metastore-assignment" {
  match {
    type = "databricks_metastore_assignment"
  }

  as = concept.unity-catalog-access-detail

  contribution {
    to       = concept.unity-catalog-metastore
    via      = source.metastore_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.workspace
    via      = source.workspace_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.workspace_id
      strategy = "exact"
    }
  }
}

rule "metastore-data-access" {
  match {
    type = "databricks_metastore_data_access"
  }

  as = concept.storage-credential

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.unity-catalog-metastore
    via      = source.metastore_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.azure_managed_identity[0].managed_identity_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.gcp_service_account_key[0].email
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

rule "unity-catalog-catalog" {
  match {
    type = "databricks_catalog"
  }

  as = concept.unity-catalog-catalog

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.unity-catalog-metastore
    via      = source.metastore_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "stores-in" {
    to       = rf.concept.object-storage-container
    via      = source.storage_root
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "federates-through" {
    to       = concept.lakehouse-federation-connection
    via      = source.connection_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "imports-from-provider" {
    to       = concept.delta-sharing-provider
    via      = source.provider_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "imports-share" {
    to       = concept.delta-share
    via      = source.share_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "unity-catalog-schema" {
  match {
    type = "databricks_schema"
  }

  as = concept.unity-catalog-schema

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.unity-catalog-catalog
    via      = source.catalog_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "stores-in" {
    to       = rf.concept.object-storage-container
    via      = source.storage_root
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "external-location" {
  match {
    type = "databricks_external_location"
  }

  as = concept.external-location

  context {
    as       = context.ownership
    to       = concept.unity-catalog-metastore
    via      = source.metastore_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "uses-credential" {
    to       = concept.storage-credential
    via      = source.credential_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "stores-in" {
    to       = rf.concept.object-storage-container
    via      = source.url
    on_null  = "absent"
    on_empty = "absent"
  }

}

rule "storage-credential" {
  match {
    type = "databricks_storage_credential"
  }

  as = concept.storage-credential

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.unity-catalog-metastore
    via      = source.metastore_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.azure_managed_identity[0].managed_identity_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.gcp_service_account_key[0].email
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

rule "service-credential" {
  match {
    type = "databricks_credential"
  }

  as = concept.service-credential

  context {
    as       = context.ownership
    to       = concept.unity-catalog-metastore
    via      = source.metastore_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.azure_managed_identity[0].managed_identity_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "unity-catalog-volume" {
  match {
    type = "databricks_volume"
  }

  as = concept.unity-catalog-volume

  context {
    as       = context.ownership
    to       = concept.unity-catalog-schema
    via      = source.schema_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "stores-in" {
    to       = rf.concept.object-storage-container
    via      = source.storage_location
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "catalog-workspace-binding" {
  match {
    type = "databricks_catalog_workspace_binding"
  }

  as = concept.unity-catalog-access-detail
}

rule "system-schema" {
  match {
    type = "databricks_system_schema"
  }

  as = concept.unity-catalog-data-detail
}

rule "unity-catalog-table" {
  match {
    type = "databricks_table"
  }

  as = concept.unity-catalog-data-detail
}

rule "sql-table" {
  match {
    type = "databricks_sql_table"
  }

  as = concept.unity-catalog-data-detail
}

rule "external-metadata" {
  match {
    type = "databricks_external_metadata"
  }

  as = concept.unity-catalog-data-detail
}

rule "data-classification-catalog-config" {
  match {
    type = "databricks_data_classification_catalog_config"
  }

  as = concept.unity-catalog-data-detail
}

rule "tag-policy" {
  match {
    type = "databricks_tag_policy"
  }

  as = concept.unity-catalog-data-detail
}

rule "entity-tag-assignment" {
  match {
    type = "databricks_entity_tag_assignment"
  }

  as = concept.unity-catalog-data-detail
}

rule "workspace-entity-tag-assignment" {
  match {
    type = "databricks_workspace_entity_tag_assignment"
  }

  as = concept.unity-catalog-data-detail
}
