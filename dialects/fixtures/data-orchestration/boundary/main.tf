terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
    kestra = {
      source  = "kestra-io/kestra"
      version = "= 0.24.3"
    }
  }
}

resource "google_bigquery_dataset" "analytics" {

  dataset_id = "analytics"

}
resource "google_bigquery_dataset" "duplicate_a" {

  dataset_id = "duplicate"

}
resource "google_bigquery_dataset" "duplicate_b" {

  dataset_id = "duplicate"

}
resource "google_bigquery_dataset" "templated" {
  dataset_id = "analytics_${terraform.workspace}"
}

resource "google_storage_bucket" "archive" {
  location = "westeurope"
  name     = "rootform-synthetic-archive"
}

resource "google_bigquery_table" "absent" {
  dataset_id = "fx-absent-dataset-id"
  table_id   = "absent"
}

resource "google_bigquery_table" "literal" {
  dataset_id = "analytics"
  table_id   = "literal"
}

resource "google_bigquery_table" "mismatch" {
  dataset_id = google_storage_bucket.archive.name
  table_id   = "mismatch"
}

resource "google_bigquery_table" "ambiguous" {
  dataset_id = "duplicate"
  table_id   = "ambiguous"
}

resource "google_bigquery_table" "dynamic" {
  dataset_id = upper("analytics")
  table_id   = "dynamic"
}

resource "google_bigquery_table" "templated" {
  dataset_id = "analytics_${terraform.workspace}"
  table_id   = "templated"
}

resource "kestra_namespace" "platform" {

  namespace_id = "platform"

}
resource "kestra_namespace" "duplicate_a" {

  namespace_id = "duplicate"

}
resource "kestra_namespace" "duplicate_b" {

  namespace_id = "duplicate"

}
resource "kestra_role" "operator" {
  name      = "operator"
  namespace = kestra_namespace.platform.id
}

resource "kestra_flow" "absent" {
  namespace = "fx-absent-namespace"
  flow_id   = "absent"
  content   = "id: absent"
}

resource "kestra_flow" "literal" {
  namespace = "platform"
  flow_id   = "literal"
  content   = "id: literal"
}

resource "kestra_flow" "mismatch" {
  namespace = kestra_role.operator.id
  flow_id   = "mismatch"
  content   = "id: mismatch"
}

resource "kestra_flow" "nested" {
  namespace = "platform.team"
  flow_id   = "nested"
  content   = "id: nested"
}

resource "kestra_flow" "ambiguous" {
  namespace = "duplicate.child"
  flow_id   = "ambiguous"
  content   = "id: ambiguous"
}

resource "kestra_flow" "dynamic" {
  namespace = upper("platform")
  flow_id   = "dynamic"
  content   = "id: dynamic"
}

resource "kestra_binding" "literal" {
  type        = "USER"
  external_id = "external"
  role_id     = "operator"
}

resource "kestra_binding" "mismatch" {
  type        = "USER"
  external_id = "external"
  role_id     = kestra_namespace.platform.id
}
