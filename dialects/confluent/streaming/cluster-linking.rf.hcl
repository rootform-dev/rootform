concept "cluster-link" {
  description = "A Confluent Cloud Cluster Linking connection between Kafka clusters."
}

rule "cluster-link" {
  match {
    type = "confluent_cluster_link"
  }

  as = concept.cluster-link

  identity {
    attributes = ["link_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "link_name"]
  }

  relation "local-cluster" {
    to       = concept.kafka-cluster
    via      = source.local_kafka_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "remote-cluster" {
    to       = concept.kafka-cluster
    via      = source.remote_kafka_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "source-cluster" {
    to       = concept.kafka-cluster
    via      = source.source_kafka_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "destination-cluster" {
    to       = concept.kafka-cluster
    via      = source.destination_kafka_cluster[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "kafka-mirror-topic" {
  match {
    type = "confluent_kafka_mirror_topic"
  }

  as = concept.message-topic

  identity {
    attributes = ["mirror_topic_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "mirror_topic_name"]
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

  relation "mirrors" {
    to       = concept.message-topic
    via      = source.source_kafka_topic[0].topic_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.topic_name
      strategy = "exact"
    }
  }

  relation "replicated-through" {
    to       = concept.cluster-link
    via      = source.cluster_link[0].link_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.link_name
      strategy = "exact"
    }
  }
}
