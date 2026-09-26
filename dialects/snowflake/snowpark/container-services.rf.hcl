concept "compute-pool" {
  description = "A Snowpark Container Services compute pool containing managed compute nodes."
}

concept "image-repository" {
  description = "A Snowpark Container Services OCI image repository."
}

concept "container-service" {
  description = "A Snowpark Container Services workload running on a compute pool."
}

rule "compute-pool" {
  match {
    type = "snowflake_compute_pool"
  }

  as = concept.compute-pool

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "image-repository" {
  match {
    type = "snowflake_image_repository"
  }

  as = concept.image-repository

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

rule "service" {
  match {
    type = "snowflake_service"
  }

  as = concept.container-service

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
    to       = concept.compute-pool
    via      = source.compute_pool
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "queries-on-warehouse" {
    to       = concept.virtual-warehouse
    via      = source.query_warehouse
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

  relation "loads-specification-from-stage" {
    to       = concept.stage
    via      = source.from_specification[0].stage
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "job-service" {
  match {
    type = "snowflake_job_service"
  }

  as = concept.container-service

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
    to       = concept.compute-pool
    via      = source.compute_pool
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "queries-on-warehouse" {
    to       = concept.virtual-warehouse
    via      = source.query_warehouse
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

  relation "loads-specification-from-stage" {
    to       = concept.stage
    via      = source.from_specification[0].stage
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}
