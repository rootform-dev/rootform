# Maintained directly from pinned provider evidence.
concept "table-storage-table" {
  description = "An Azure Table Storage table."
}

rule "table-storage-table" {
  match {
    type = "azurerm_storage_table"
  }

  as = concept.table-storage-table

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
