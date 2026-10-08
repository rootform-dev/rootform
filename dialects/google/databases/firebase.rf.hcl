
rule "firebase-realtime-database" {
  match {
    type = "google_firebase_database_instance"
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
