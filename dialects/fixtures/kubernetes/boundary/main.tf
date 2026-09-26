terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "= 2.38.0"
    }
  }
}

resource "google_container_cluster" "runtime" {
  name = "runtime"
}

provider "kubernetes" {
  host = google_container_cluster.runtime.endpoint
}

resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = "app"
  }
}

resource "kubernetes_namespace_v1" "duplicate_a" {
  metadata {
    name = "duplicate"
  }
}

resource "kubernetes_namespace_v1" "duplicate_b" {
  metadata {
    name = "duplicate"
  }
}

resource "kubernetes_deployment_v1" "literal" {
  spec {
    template {
      spec {
      }
      metadata {
      }
    }
  }
  metadata {
    name      = "literal"
    namespace = "app"
  }
}

resource "kubernetes_service_v1" "absent" {
  spec {
  }
  metadata {
    name = "absent"
  }
}

resource "kubernetes_ingress_v1" "ambiguous" {
  spec {
  }
  metadata {
    name      = "ambiguous"
    namespace = "duplicate"
  }
}

resource "kubernetes_service_account_v1" "mismatch" {
  metadata {
    name      = "mismatch"
    namespace = google_container_cluster.runtime.name
  }
}
