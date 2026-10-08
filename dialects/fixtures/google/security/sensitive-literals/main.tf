terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
  }
}

variable "private_key" {
  sensitive = true
}

resource "google_compute_ssl_certificate" "cert" {
  name        = "sensitive-cert"
  certificate = "SECRET_SSL_CERTIFICATE_31a"
  private_key = var.private_key
}

resource "google_project_iam_policy" "policy" {
  project     = "SECRET_PROJECT_ID_31c"
  policy_data = jsonencode({ bindings = [{ role = "roles/viewer", members = ["user:SECRET_POLICY_DATA_31d@example.com"] }] })
}

resource "google_project_iam_member" "member" {
  project = "SECRET_PROJECT_ID_31e"
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:SECRET_MEMBER_LITERAL_31f@example.com"
}

resource "google_sql_database_instance" "db" {
  name             = "sensitive-db"
  database_version = "MYSQL_8_0"
  region           = "us-central1"

  settings {
    tier = "db-f1-micro"
    ip_configuration {
      ssl_mode = "ENCRYPTED_ONLY"
    }
  }
}
