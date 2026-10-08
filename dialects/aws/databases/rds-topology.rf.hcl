rule "db-instance" {
  match {
    type = "aws_db_instance"
  }

  as = rf.concept.managed-database

  identity {
    attributes = ["arn", "identifier"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["arn", "id", "identifier"]
  }
}

rule "rds-cluster" {
  match {
    type = "aws_rds_cluster"
  }

  as = rf.concept.managed-database

  identity {
    attributes = ["arn", "cluster_identifier"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["arn", "id", "cluster_identifier"]
  }
}

rule "rds-cluster-instance" {
  match {
    type = "aws_rds_cluster_instance"
  }

  as = concept.managed-database-component

  contribution {
    to       = rule.rds-cluster
    via      = source.cluster_identifier
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.cluster_identifier
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "docdb-cluster-instance" {
  match {
    type = "aws_docdb_cluster_instance"
  }

  as = concept.managed-database-component

  contribution {
    to       = rule.docdb-cluster
    via      = source.cluster_identifier
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.cluster_identifier
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "neptune-cluster-instance" {
  match {
    type = "aws_neptune_cluster_instance"
  }

  as = concept.managed-database-component

  contribution {
    to       = rule.neptune-cluster
    via      = source.cluster_identifier
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.cluster_identifier
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "rds-cluster-endpoint" {
  match {
    type = "aws_rds_cluster_endpoint"
  }

  as = concept.managed-database-component

  contribution {
    to       = rule.rds-cluster
    via      = source.cluster_identifier
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.cluster_identifier
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "rds-cluster-activity-stream" {
  match {
    type = "aws_rds_cluster_activity_stream"
  }

  as = concept.managed-database-component

  contribution {
    to       = rf.concept.managed-database
    via      = source.resource_arn
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.arn
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "db-proxy-default-target-group" {
  match {
    type = "aws_db_proxy_default_target_group"
  }

  as = concept.db-proxy-component

  contribution {
    to       = concept.db-proxy
    via      = source.db_proxy_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "db-proxy-endpoint" {
  match {
    type = "aws_db_proxy_endpoint"
  }

  as = concept.db-proxy-component

  contribution {
    to       = concept.db-proxy
    via      = source.db_proxy_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
