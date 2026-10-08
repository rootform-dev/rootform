
concept "online-serving-configuration" {
  description = "An online table or feature-serving configuration supporting Databricks online serving."
}


rule "online-table" {
  match {
    type = "databricks_online_table"
  }

  as = concept.online-serving-configuration

  contribution {
    to       = concept.lakeflow-pipeline
    via      = source.spec[0].pipeline_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
