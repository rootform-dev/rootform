# Maintained directly from pinned provider evidence.
rule "mongo-cluster" {
  match {
    type = "azurerm_mongo_cluster"
  }

  as = rf.concept.managed-database

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
