



rule "managed-kafka-topic" {
  match {
    type = "google_managed_kafka_topic"
  }

  as = concept.message-topic

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}
