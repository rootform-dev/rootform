concept "notification-integration" {
  description = "A Snowflake notification integration connecting cloud messaging or email delivery."
}

concept "data-pipe" {
  description = "A Snowpipe pipe continuously loading staged data into Snowflake."
}

concept "stream-configuration" {
  description = "A Snowflake stream tracking change data for a schema object."
}

rule "notification-integration" {
  match {
    type = "snowflake_notification_integration"
  }

  as = concept.notification-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

}

rule "email-notification-integration" {
  match {
    type = "snowflake_email_notification_integration"
  }

  as = concept.notification-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "pipe" {
  match {
    type = "snowflake_pipe"
  }

  as = concept.data-pipe

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

  relation "uses-notification-integration" {
    to       = concept.notification-integration
    via      = source.integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "reports-to-notification-integration" {
    to       = concept.notification-integration
    via      = source.error_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

}

rule "task" {
  match {
    type = "snowflake_task"
  }

  as = concept.workflow

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

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

  relation "runs-after-task" {
    to       = concept.workflow
    via      = source.after[0]
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "runs-after-task" {
    to       = concept.workflow
    via      = source.after[1]
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "finalizes-task" {
    to       = concept.workflow
    via      = source.finalize
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "reports-to-notification-integration" {
    to       = concept.notification-integration
    via      = source.error_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "stream-on-table" {
  match {
    type = "snowflake_stream_on_table"
  }

  as = concept.stream-configuration

  contribution {
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "stream-on-view" {
  match {
    type = "snowflake_stream_on_view"
  }

  as = concept.stream-configuration

  contribution {
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "stream-on-external-table" {
  match {
    type = "snowflake_stream_on_external_table"
  }

  as = concept.stream-configuration

  contribution {
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "stream-on-directory-table" {
  match {
    type = "snowflake_stream_on_directory_table"
  }

  as = concept.stream-configuration

  contribution {
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

}
