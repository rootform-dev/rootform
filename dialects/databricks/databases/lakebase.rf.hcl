concept "lakebase-project" {
  description = "A Lakebase Autoscaling project containing branches, Postgres compute endpoints, and databases."
}

concept "lakebase-branch" {
  description = "An isolated Lakebase database environment sharing project storage through copy-on-write."
}

concept "lakebase-endpoint" {
  description = "A Lakebase Postgres compute endpoint providing read-write or read-only database access."
}

concept "lakebase-data-api" {
  description = "A Lakebase Data API exposing governed database access."
}

concept "lakebase-database" {
  description = "A logical Postgres database contained by a Lakebase branch."
}

concept "database-configuration" {
  description = "A database, role, synchronization, catalog, or change-data configuration supporting Lakebase."
}

rule "lakebase-project" {
  match {
    type = "databricks_postgres_project"
  }

  as = concept.lakebase-project

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "uid"]
  }
}

rule "lakebase-branch" {
  match {
    type = "databricks_postgres_branch"
  }

  as = concept.lakebase-branch

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "uid"]
  }

  context {
    as       = context.ownership
    to       = concept.lakebase-project
    via      = source.parent
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "branched-from" {
    to       = concept.lakebase-branch
    via      = source.spec.source_branch
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "lakebase-endpoint" {
  match {
    type = "databricks_postgres_endpoint"
  }

  as = concept.lakebase-endpoint

  context {
    as       = rf.context.runtime
    to       = concept.lakebase-branch
    via      = source.parent
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "lakebase-database" {
  match {
    type = "databricks_postgres_database"
  }

  as = concept.lakebase-database

  context {
    as       = context.ownership
    to       = concept.lakebase-branch
    via      = source.parent
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "lakebase-data-api" {
  match {
    type = "databricks_postgres_data_api"
  }

  as = concept.lakebase-data-api

  context {
    as       = rf.context.runtime
    to       = concept.lakebase-project
    via      = source.parent
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "lakebase-provisioned-instance" {
  match {
    type = "databricks_database_instance"
  }

  as = rf.concept.managed-database

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "uid"]
  }

  relation "branched-from" {
    to       = rf.concept.managed-database
    via      = source.parent_instance_ref.name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "lakebase-provisioned-catalog" {
  match {
    type = "databricks_database_database_catalog"
  }

  as = concept.database-configuration
}

rule "lakebase-provisioned-synced-table" {
  match {
    type = "databricks_database_synced_database_table"
  }

  as = concept.database-configuration
}

rule "lakebase-postgres-catalog" {
  match {
    type = "databricks_postgres_catalog"
  }

  as = concept.database-configuration
}

rule "lakebase-postgres-role" {
  match {
    type = "databricks_postgres_role"
  }

  as = concept.database-configuration
}

rule "lakebase-postgres-synced-table" {
  match {
    type = "databricks_postgres_synced_table"
  }

  as = concept.database-configuration
}

rule "lakebase-postgres-cdf-config" {
  match {
    type = "databricks_postgres_cdf_config"
  }

  as = concept.database-configuration
}
