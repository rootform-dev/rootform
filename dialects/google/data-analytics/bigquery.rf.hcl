concept "bigquery-dataset" {
  description = "A BigQuery dataset that organizes tables and their access boundary."
}

concept "bigquery-table" {
  description = "A table managed inside a BigQuery dataset."
}

rule "bigquery-dataset" {
  match {
    type = "google_bigquery_dataset"
  }

  as = concept.bigquery-dataset

  identity {
    attributes = ["dataset_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["dataset_id", "id", "self_link"]
  }
}

rule "bigquery-table" {
  match {
    type = "google_bigquery_table"
  }

  as = concept.bigquery-table

  identity {
    attributes = ["table_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "self_link", "table_id"]
  }

  context {
    as  = context.ownership
    to  = concept.bigquery-dataset
    via = source.dataset_id

    on_null  = "absent"
    on_empty = "absent"
    match {
      by       = target.dataset_id
      strategy = "exact"
    }
  }
}

rule "bigquery-dataset-access" {
  match {
    type = "google_bigquery_dataset_access"
  }

  as = concept.access-binding

  contribution {
    to  = concept.bigquery-dataset
    via = source.dataset_id

    on_null  = "absent"
    on_empty = "absent"
    match {
      by       = target.dataset_id
      strategy = "exact"
    }
  }
}

rule "bigquery-table-iam-member" {
  match {
    type = "google_bigquery_table_iam_member"
  }

  as = concept.access-binding

  contribution {
    to  = concept.bigquery-table
    via = source.table_id

    on_null  = "absent"
    on_empty = "absent"
    match {
      by       = target.table_id
      strategy = "last-segment"
    }
  }
}
