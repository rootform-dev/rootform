concept "queue-consumer-binding" {
  description = "A consumer binding connecting a Cloudflare Queue to a Worker."
}

rule "queue" {
  match {
    type = "cloudflare_queue"
  }

  as = concept.message-queue

  identity {
    attributes = ["id", "queue_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "queue_name"]
  }
}

rule "queue-consumer" {
  match {
    type = "cloudflare_queue_consumer"
  }

  as = concept.queue-consumer-binding

  contribution {
    to       = concept.message-queue
    via      = source.queue_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.serverless-function
    via      = source.script_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
