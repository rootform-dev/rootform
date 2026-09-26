terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
  }
}

provider "google" {
  access_token = "SECRET_PROVIDER_CREDENTIALS_30a"
  project      = "SECRET_PROJECT_ID_30b"
  region       = "us-central1"
}

resource "google_compute_network" "vpc" {

  name = "decoy-network"

}
resource "google_container_cluster" "cluster" {
  name     = "decoy-cluster"
  location = "us-central1"
  network  = google_compute_network.vpc.id
}
