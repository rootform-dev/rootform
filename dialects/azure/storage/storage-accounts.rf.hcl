rule "storage-account" {
  match {
    type = "azurerm_storage_account"
  }

  as = concept.storage-account

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as  = context.ownership
    to  = concept.resource-group
    via = source.resource_group_name

    on_null  = "absent"
    on_empty = "absent"

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
