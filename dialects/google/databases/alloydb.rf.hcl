concept "alloydb-instance" {
  description = "A database instance contributing compute capacity to an AlloyDB cluster."
}

rule "alloydb-cluster" {
  match {
    type = "google_alloydb_cluster"
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

rule "alloydb-instance" {
  match {
    type = "google_alloydb_instance"
  }

  as = concept.alloydb-instance

  contribution {
    to       = rf.concept.managed-database
    via      = source.cluster
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
