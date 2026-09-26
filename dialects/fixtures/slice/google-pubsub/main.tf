terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
  }
}

resource "terraform_data" "unknown_endpoint" {}
resource "terraform_data" "unknown_topic" {}
resource "terraform_data" "unknown_project" {}

resource "google_project" "platform" {
  name       = "platform"
  project_id = "demo-project"
}

resource "google_cloud_run_v2_service" "receiver" {
  name     = "receiver"
  location = "us-central1"
  project  = google_project.platform.project_id

  template {
    containers { image = "example.invalid/receiver" }
  }
}

resource "google_pubsub_topic" "events" {
  name    = "events"
  project = google_project.platform.project_id
}

resource "google_pubsub_topic" "dead_letter" {
  name    = "dead-letter"
  project = google_project.platform.project_id
}

resource "google_pubsub_subscription" "worker" {
  name    = "worker"
  topic   = google_pubsub_topic.events.id
  project = google_project.platform.project_id

  push_config {
    push_endpoint = google_cloud_run_v2_service.receiver.uri
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_subscription" "literal" {
  name    = "literal"
  topic   = google_pubsub_topic.events.id
  project = "demo-project"

  push_config { push_endpoint = "https://receiver.example.invalid" }
  dead_letter_policy {
    dead_letter_topic     = "projects/demo-project/topics/dead-letter"
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_subscription" "unknown" {
  name    = "unknown"
  topic   = google_pubsub_topic.events.id
  project = terraform_data.unknown_project.id

  push_config { push_endpoint = terraform_data.unknown_endpoint.id }
  dead_letter_policy {
    dead_letter_topic     = terraform_data.unknown_topic.id
    max_delivery_attempts = 5
  }
}
