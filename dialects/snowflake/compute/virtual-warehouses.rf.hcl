concept "virtual-warehouse" {
  description = "A Snowflake virtual warehouse providing an independent compute cluster."
}

rule "warehouse" {
  match {
    type = "snowflake_warehouse"
  }

  as = concept.virtual-warehouse

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "adaptive-warehouse" {
  match {
    type = "snowflake_warehouse_adaptive"
  }

  as = concept.virtual-warehouse

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "interactive-warehouse" {
  match {
    type = "snowflake_warehouse_interactive"
  }

  as = concept.virtual-warehouse

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "falls-back-to-warehouse" {
    to       = concept.virtual-warehouse
    via      = source.fallback_warehouse
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}
