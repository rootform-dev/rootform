concept "google-cloud-project" {
  description = "A Google Cloud project serving as a resource and billing boundary."
}


rule "google-cloud-project" {
  match {
    type = "google_project"
  }

  as = concept.google-cloud-project

  identity {
    attributes = ["project_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "project_id"]
  }
}
