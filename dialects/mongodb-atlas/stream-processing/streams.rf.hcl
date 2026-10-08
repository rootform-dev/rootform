concept "stream-processing-workspace" {
  description = "An Atlas Stream Processing workspace owning processors and registered source or sink connections."
}

concept "stream-connection" {
  description = "A neutral source or sink connection registered with an Atlas Stream Processing workspace."
}

concept "stream-processor" {
  description = "An Atlas Stream Processing processor continuously executing a declared aggregation pipeline."
}

concept "stream-configuration" {
  description = "A failover or runtime configuration supporting Atlas Stream Processing."
}

rule "stream-workspace" {
  match {
    type = "mongodbatlas_stream_workspace"
  }

  as = concept.stream-processing-workspace

  identity {
    attributes = ["workspace_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "workspace_name"]
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

rule "stream-instance" {
  match {
    type = "mongodbatlas_stream_instance"
  }

  as = concept.stream-processing-workspace

  identity {
    attributes = ["instance_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "instance_name"]
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

rule "stream-connection" {
  match {
    type = "mongodbatlas_stream_connection"
  }

  as = concept.stream-connection

  identity {
    attributes = ["connection_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "connection_name"]
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

  context {
    as       = rf.context.runtime
    to       = rule.stream-workspace
    via      = source.workspace_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.workspace_name
      strategy = "exact"
    }
  }

  context {
    as       = rf.context.runtime
    to       = rule.stream-instance
    via      = source.instance_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.instance_name
      strategy = "exact"
    }
  }

  relation "connects-to-database" {
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

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.azure.service_principal_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.principal_id
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.gcp.service_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-private-endpoint" {
    to       = concept.private-endpoint
    via      = source.networking.access.connection_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "stream-connection-failover" {
  match {
    type = "mongodbatlas_stream_connection_failover"
  }

  as = concept.stream-configuration

  contribution {
    to       = concept.stream-connection
    via      = source.connection_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.connection_name
      strategy = "exact"
    }
  }
}

rule "stream-private-endpoint" {
  match {
    type = "mongodbatlas_stream_privatelink_endpoint"
  }

  as = concept.private-endpoint

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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

  relation "connects-to-network-service" {
    to       = rf.concept.virtual-network
    via      = source.service_endpoint_id
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "stream-processor" {
  match {
    type = "mongodbatlas_stream_processor"
  }

  as = concept.stream-processor

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

  context {
    as       = rf.context.runtime
    to       = rule.stream-workspace
    via      = source.workspace_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.workspace_name
      strategy = "exact"
    }
  }

  context {
    as       = rf.context.runtime
    to       = rule.stream-instance
    via      = source.instance_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.instance_name
      strategy = "exact"
    }
  }
}
