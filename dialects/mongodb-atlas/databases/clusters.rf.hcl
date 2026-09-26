concept "database-configuration" {
  description = "A configuration supporting MongoDB Atlas database deployments within a project."
}

rule "advanced-cluster" {
  match {
    type = "mongodbatlas_advanced_cluster"
  }

  as = rf.concept.managed-database

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["cluster_id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "cluster" {
  match {
    type = "mongodbatlas_cluster"
  }

  as = rf.concept.managed-database

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "flex-cluster" {
  match {
    type = "mongodbatlas_flex_cluster"
  }

  as = rf.concept.managed-database

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "serverless-instance" {
  match {
    type = "mongodbatlas_serverless_instance"
  }

  as = rf.concept.managed-database

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "global-cluster-configuration" {
  match {
    type = "mongodbatlas_global_cluster_config"
  }

  as = concept.database-configuration

  contribution {
    to       = rf.concept.managed-database
    via      = source.cluster_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "maintenance-window" {
  match {
    type = "mongodbatlas_maintenance_window"
  }

  as = concept.database-configuration

  contribution {
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
