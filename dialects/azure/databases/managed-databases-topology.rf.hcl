rule "postgresql-flexible-server" {
  match {
    type = "azurerm_postgresql_flexible_server"
  }

  as = rf.concept.managed-database

  context {
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.delegated_subnet_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "private-name-resolution" {
    to       = concept.dns-zone
    via      = source.private_dns_zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
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

rule "mssql-server" {
  match {
    type = "azurerm_mssql_server"
  }

  as = concept.sql-server

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

rule "mssql-database" {
  match {
    type = "azurerm_mssql_database"
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
    to       = concept.sql-server
    via      = source.server_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
