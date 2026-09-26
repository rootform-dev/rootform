# Maintained directly from pinned provider evidence.
concept "storage-sync-service" {
  description = "An Azure File Sync service synchronizing file servers and Azure Files."
}

rule "azure-files-share" {
  match {
    type = "azurerm_storage_share"
  }

  as = concept.managed-file-storage

  context {
    as       = context.ownership
    to       = concept.storage-account
    via      = source.storage_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared storage-account instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "blob-container" {
  match {
    type = "azurerm_storage_container"
  }

  as = rf.concept.object-storage-container

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.storage-account
    via      = source.storage_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared storage-account instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "storage-blob" {
  match {
    type = "azurerm_storage_blob"
  }

  as = concept.storage-object-detail

  contribution {
    to       = rf.concept.object-storage-container
    via      = source.storage_container_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared object-storage-container instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "storage-encryption-scope" {
  match {
    type = "azurerm_storage_encryption_scope"
  }

  as = concept.storage-object-detail

  contribution {
    to       = concept.storage-account
    via      = source.storage_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared storage-account instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "storage-management-policy" {
  match {
    type = "azurerm_storage_management_policy"
  }

  as = concept.storage-object-detail

  contribution {
    to       = concept.storage-account
    via      = source.storage_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared storage-account instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "storage-share-directory" {
  match {
    type = "azurerm_storage_share_directory"
  }

  as = concept.storage-object-detail
}

rule "storage-share-file" {
  match {
    type = "azurerm_storage_share_file"
  }

  as = concept.storage-object-detail
}

rule "storage-sync-service" {
  match {
    type = "azurerm_storage_sync"
  }

  as = concept.storage-sync-service

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "storage-table-entity" {
  match {
    type = "azurerm_storage_table_entity"
  }

  as = concept.storage-object-detail

  contribution {
    to       = concept.table-storage-table
    via      = source.storage_table_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
