# Maintained directly from pinned provider evidence.
rule "mysql-database" {
  match {
    type = "azurerm_mysql_flexible_database"
  }

  as = concept.logical-database

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

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

rule "mysql-flexible-server" {
  match {
    type = "azurerm_mysql_flexible_server"
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

rule "postgresql-backup" {
  match {
    type = "azurerm_postgresql_flexible_server_backup"
  }

  as = concept.database-component
}

rule "postgresql-database" {
  match {
    type = "azurerm_postgresql_flexible_server_database"
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
