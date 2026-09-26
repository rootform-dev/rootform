concept "kafka-cluster" {
  description = "A managed Apache Kafka cluster in Confluent Cloud."
}

concept "kafka-configuration" {
  description = "Cluster, topic, quota, or access configuration supporting a Confluent Cloud Kafka cluster."
}

rule "kafka-cluster" {
  match {
    type = "confluent_kafka_cluster"
  }

  as = concept.kafka-cluster

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
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.network[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-key" {
    to       = concept.byok-key
    via      = source.byok_key[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "kafka-topic" {
  match {
    type = "confluent_kafka_topic"
  }

  as = concept.message-topic

  identity {
    attributes = ["topic_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "topic_name"]
  }

  context {
    as       = rf.context.runtime
    to       = concept.kafka-cluster
    via      = source.kafka_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "rtce-topic" {
  match {
    type = "confluent_rtce_topic"
  }

  as = concept.message-topic

  identity {
    attributes = ["topic_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "topic_name"]
  }

  context {
    as       = context.ownership
    to       = concept.environment
    via      = source.environment[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  context {
    as       = rf.context.runtime
    to       = concept.kafka-cluster
    via      = source.kafka_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "kafka-acl" {
  match {
    type = "confluent_kafka_acl"
  }

  as = concept.kafka-configuration

  contribution {
    to       = concept.kafka-cluster
    via      = source.kafka_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "kafka-client-quota" {
  match {
    type = "confluent_kafka_client_quota"
  }

  as = concept.kafka-configuration

  contribution {
    to       = concept.kafka-cluster
    via      = source.kafka_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "kafka-cluster-config" {
  match {
    type = "confluent_kafka_cluster_config"
  }

  as = concept.kafka-configuration

  contribution {
    to       = concept.kafka-cluster
    via      = source.kafka_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
