concept "cortex-agent" {
  description = "A Cortex Agent orchestrating tools across governed structured and unstructured data."
}

concept "cortex-search-service" {
  description = "A Cortex Search service exposing low-latency retrieval over Snowflake data."
}

concept "mcp-server" {
  description = "A Snowflake-managed Model Context Protocol server exposing governed tools."
}

rule "cortex-agent" {
  match {
    type = "snowflake_cortex_agent"
  }

  as = concept.cortex-agent

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
}

rule "cortex-search-service" {
  match {
    type = "snowflake_cortex_search_service"
  }

  as = concept.cortex-search-service

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

rule "mcp-server" {
  match {
    type = "snowflake_mcp_server"
  }

  as = concept.mcp-server

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
}
