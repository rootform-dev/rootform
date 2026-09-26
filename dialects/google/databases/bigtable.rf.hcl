concept "bigtable-table" {
  description = "A table belonging to a Bigtable instance."
}

rule "bigtable-instance" {
  match {
    type = "google_bigtable_instance"
  }

  as = rf.concept.managed-database

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "bigtable-table" {
  match {
    type = "google_bigtable_table"
  }

  as = concept.bigtable-table

  contribution {
    to       = rf.concept.managed-database
    via      = source.instance_name
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
