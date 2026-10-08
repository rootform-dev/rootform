rule "dynamodb-global-secondary-index" {
  match {
    type = "aws_dynamodb_global_secondary_index"
  }

  as = concept.dynamodb-component

  contribution {
    to  = concept.dynamodb-table
    via = source.table_name

    on_null  = "absent"
    on_empty = "absent"
    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
