concept "schema-registry" {
  description = "The Schema Registry cluster provisioned for a Confluent Cloud environment."
}

concept "schema-link" {
  description = "A Schema Exporter link between source and destination Schema Registry clusters."
}

concept "schema-registry-configuration" {
  description = "A schema, subject, mode, compatibility, or encryption configuration supporting Schema Registry."
}

rule "schema-registry" {
  match {
    kind = "data"
    type = "confluent_schema_registry_cluster"
  }

  as = concept.schema-registry

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.environment
    via      = source.environment[0].id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "schema" {
  match {
    type = "confluent_schema"
  }

  as = concept.schema-registry-configuration

  contribution {
    to       = concept.schema-registry
    via      = source.schema_registry_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "schema-registry-cluster-config" {
  match {
    type = "confluent_schema_registry_cluster_config"
  }

  as = concept.schema-registry-configuration

  contribution {
    to       = concept.schema-registry
    via      = source.schema_registry_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "schema-registry-cluster-mode" {
  match {
    type = "confluent_schema_registry_cluster_mode"
  }

  as = concept.schema-registry-configuration

  contribution {
    to       = concept.schema-registry
    via      = source.schema_registry_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "schema-registry-dek" {
  match {
    type = "confluent_schema_registry_dek"
  }

  as = concept.schema-registry-configuration

  contribution {
    to       = concept.schema-registry
    via      = source.schema_registry_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "schema-registry-kek" {
  match {
    type = "confluent_schema_registry_kek"
  }

  as = concept.schema-registry-configuration

  contribution {
    to       = concept.schema-registry
    via      = source.schema_registry_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "subject-config" {
  match {
    type = "confluent_subject_config"
  }

  as = concept.schema-registry-configuration

  contribution {
    to       = concept.schema-registry
    via      = source.schema_registry_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "subject-mode" {
  match {
    type = "confluent_subject_mode"
  }

  as = concept.schema-registry-configuration

  contribution {
    to       = concept.schema-registry
    via      = source.schema_registry_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "schema-exporter" {
  match {
    type = "confluent_schema_exporter"
  }

  as = concept.schema-link

  relation "exports-from" {
    to       = concept.schema-registry
    via      = source.schema_registry_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "exports-to" {
    to       = concept.schema-registry
    via      = source.destination_schema_registry_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
