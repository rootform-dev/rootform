# Maintained directly from pinned provider evidence.
concept "data-share-account" {
  description = "An Azure Data Share account."
}

rule "data-share-account" {
  match {
    type = "azurerm_data_share_account"
  }

  as = concept.data-share-account

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
