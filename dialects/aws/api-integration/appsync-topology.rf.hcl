rule "appsync-graphql-api" {
  match {
    type = "aws_appsync_graphql_api"
  }

  as = concept.appsync-api

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "appsync-datasource" {
  match {
    type = "aws_appsync_datasource"
  }

  as = concept.appsync-component

  contribution {
    to       = concept.appsync-api
    via      = source.api_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "appsync-function" {
  match {
    type = "aws_appsync_function"
  }

  as = concept.appsync-component

  contribution {
    to       = concept.appsync-api
    via      = source.api_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "appsync-resolver" {
  match {
    type = "aws_appsync_resolver"
  }

  as = concept.appsync-component

  contribution {
    to       = concept.appsync-api
    via      = source.api_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
