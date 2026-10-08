concept "spanner-database" {
  description = "A database belonging to a Spanner instance."
}

rule "spanner-instance" {
  match {
    type = "google_spanner_instance"
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

rule "spanner-database" {
  match {
    type = "google_spanner_database"
  }

  as = concept.spanner-database

  contribution {
    to       = rf.concept.managed-database
    via      = source.instance
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.id]
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
