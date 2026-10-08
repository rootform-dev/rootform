concept "application" {
  description = "A Snowflake-hosted interactive data application or notebook."
}

rule "streamlit" {
  match {
    type = "snowflake_streamlit"
  }

  as = concept.application

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  context {
    as       = rf.context.runtime
    to       = concept.virtual-warehouse
    via      = source.query_warehouse
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "loads-code-from-stage" {
    to       = concept.stage
    via      = source.stage
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-external-access" {
    to       = concept.external-access-integration
    via      = source.external_access_integrations[0]
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "notebook" {
  match {
    type = "snowflake_notebook"
  }

  as = concept.application

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  context {
    as       = rf.context.runtime
    to       = concept.virtual-warehouse
    via      = source.query_warehouse
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "loads-code-from-stage" {
    to       = concept.stage
    via      = source.from[0].stage
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}
