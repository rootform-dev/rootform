rule "firestore-database" {
  match {
    type = "google_firestore_database"
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
