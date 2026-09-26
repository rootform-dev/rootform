# Maintained directly from pinned provider evidence.
concept "sql-server" {
  description = "An Azure SQL logical server owning managed databases."
}

rule "sql-elastic-pool" {
  match {
    type = "azurerm_mssql_elasticpool"
  }

  as = concept.database-component
}

rule "sql-failover-group" {
  match {
    type = "azurerm_mssql_failover_group"
  }

  as = concept.database-component
}

rule "sql-managed-database" {
  match {
    type = "azurerm_mssql_managed_database"
  }

  as = concept.logical-database

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "sql-managed-instance" {
  match {
    type = "azurerm_mssql_managed_instance"
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
