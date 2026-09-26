concept "lakeflow-pipeline" {
  description = "A Lakeflow pipeline running declarative batch or streaming data processing."
}

concept "orchestration-configuration" {
  description = "A task, query, repository, or environment artifact supporting Databricks orchestration."
}

rule "lakeflow-job" {
  match {
    type = "databricks_job"
  }

  as = concept.workflow

  relation "runs-on" {
    to       = concept.compute-cluster
    via      = source.existing_cluster_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "lakeflow-pipeline" {
  match {
    type = "databricks_pipeline"
  }

  as = concept.lakeflow-pipeline

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  relation "publishes-to-catalog" {
    to       = concept.unity-catalog-catalog
    via      = source.catalog
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "publishes-to-schema" {
    to       = concept.unity-catalog-schema
    via      = source.target
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
