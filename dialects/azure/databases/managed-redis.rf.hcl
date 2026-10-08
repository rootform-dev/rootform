# Maintained directly from pinned provider evidence.
rule "azure-cache-for-redis" {
  match {
    type = "azurerm_redis_cache"
  }

  as = concept.managed-cache

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

rule "azure-managed-redis" {
  match {
    type = "azurerm_managed_redis"
  }

  as = concept.managed-cache

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

rule "managed-redis-geo-replication" {
  match {
    type = "azurerm_managed_redis_geo_replication"
  }

  as = concept.database-component
}
