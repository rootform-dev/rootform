concept "database" {
  description = "A Snowflake database containing schemas and governed data objects."
}

concept "schema" {
  description = "A Snowflake schema containing named data-platform objects."
}

rule "database" {
  match {
    type = "snowflake_database"
  }

  as = concept.database

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "uses-external-volume" {
    to       = concept.external-volume
    via      = source.external_volume
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "secondary-database" {
  match {
    type = "snowflake_secondary_database"
  }

  as = concept.database

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "replicates-database" {
    to       = concept.database
    via      = source.as_replica_of
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "uses-external-volume" {
    to       = concept.external-volume
    via      = source.external_volume
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "shared-database" {
  match {
    type = "snowflake_shared_database"
  }

  as = concept.database

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "imports-share" {
    to       = concept.data-share
    via      = source.from_share
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "uses-external-volume" {
    to       = concept.external-volume
    via      = source.external_volume
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "schema" {
  match {
    type = "snowflake_schema"
  }

  as = concept.schema

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  context {
    as       = context.ownership
    to       = concept.database
    via      = source.database
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-external-volume" {
    to       = concept.external-volume
    via      = source.external_volume
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "postgres-instance" {
  match {
    type = "snowflake_postgres_instance"
  }

  as = rf.concept.managed-database

  relation "uses-storage-integration" {
    to       = concept.storage-integration
    via      = source.storage_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-network-policy" {
    to       = concept.network-policy
    via      = source.network_policy
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}
