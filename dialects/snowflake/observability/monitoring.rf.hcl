
concept "alert" {
  description = "A Snowflake alert evaluating a condition and running an action."
}

rule "alert" {
  match {
    type = "snowflake_alert"
  }

  as = concept.alert

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
    via      = source.warehouse
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}
