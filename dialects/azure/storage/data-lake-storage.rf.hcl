# Maintained directly from pinned provider evidence.
rule "data-lake-filesystem" {
  match {
    type = "azurerm_storage_data_lake_gen2_filesystem"
  }

  as = rf.concept.object-storage-container

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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

rule "data-lake-path" {
  match {
    type = "azurerm_storage_data_lake_gen2_path"
  }

  as = concept.storage-object-detail
}
