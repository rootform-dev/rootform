rule "pubsub-topic" {
  match {
    type = "google_pubsub_topic"
  }

  as = concept.message-topic

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.google-cloud-project
    via      = source.project
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.project_id
      strategy = "exact"
    }

    # Shared google-cloud-project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "pubsub-subscription" {
  match {
    type = "google_pubsub_subscription"
  }

  as = concept.message-subscription

  relation "subscribes-to" {
    to       = concept.message-topic
    via      = source.topic
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.id, target.name]
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.cloud-run-service
    via      = source.push_config[0].push_endpoint
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.uri
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.message-topic
    via      = source.dead_letter_policy[0].dead_letter_topic
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.id, target.name]
      strategy = "exact"
    }
  }

  context {
    as       = context.ownership
    to       = concept.google-cloud-project
    via      = source.project
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.project_id
      strategy = "exact"
    }

    # Shared google-cloud-project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "pubsub-lite-topic" {
  match {
    type = "google_pubsub_lite_topic"
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

rule "pubsub-lite-subscription" {
  match {
    type = "google_pubsub_lite_subscription"
  }

  as = concept.message-subscription
}
