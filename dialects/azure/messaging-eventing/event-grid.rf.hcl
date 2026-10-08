# Maintained directly from pinned provider evidence.
concept "event-grid-domain" {
  description = "An Azure Event Grid domain or namespace owning event topics."
}

rule "event-grid-domain" {
  match {
    type = "azurerm_eventgrid_domain"
  }

  as = concept.event-grid-domain

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "event-grid-domain-topic" {
  match {
    type = "azurerm_eventgrid_domain_topic"
  }

  as = concept.event-grid-topic

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.event-grid-domain
    via      = source.domain_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "event-grid-event-subscription" {
  match {
    type = "azurerm_eventgrid_event_subscription"
  }

  as = concept.message-subscription

  context {
    as       = context.ownership
    to       = concept.event-grid-topic
    via      = source.scope
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "subscribes-to" {
    to       = concept.event-grid-topic
    via      = source.scope
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.event-stream
    via      = source.eventhub_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.message-queue
    via      = source.service_bus_queue_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.service-bus-topic
    via      = source.service_bus_topic_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.serverless-function
    via      = source.azure_function_endpoint[0].function_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.storage-account
    via      = source.storage_queue_endpoint[0].storage_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared storage-account instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "event-grid-namespace" {
  match {
    type = "azurerm_eventgrid_namespace"
  }

  as = concept.event-grid-domain

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "event-grid-namespace-topic" {
  match {
    type = "azurerm_eventgrid_namespace_topic"
  }

  as = concept.message-topic

  context {
    as       = context.ownership
    to       = concept.event-grid-domain
    via      = source.eventgrid_namespace_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "event-grid-partner-namespace" {
  match {
    type = "azurerm_eventgrid_partner_namespace"
  }

  as = concept.event-grid-domain

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "event-grid-system-topic" {
  match {
    type = "azurerm_eventgrid_system_topic"
  }

  as = concept.event-grid-topic

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "event-grid-system-topic-subscription" {
  match {
    type = "azurerm_eventgrid_system_topic_event_subscription"
  }

  as = concept.message-subscription

  # system_topic holds the name of the system topic, which only a system topic
  # rule can carry.
  context {
    as       = context.ownership
    to       = rule.event-grid-system-topic
    via      = source.system_topic
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "subscribes-to" {
    to       = rule.event-grid-system-topic
    via      = source.system_topic
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.event-stream
    via      = source.eventhub_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.message-queue
    via      = source.service_bus_queue_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.service-bus-topic
    via      = source.service_bus_topic_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.serverless-function
    via      = source.azure_function_endpoint[0].function_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "delivers-to" {
    to       = concept.storage-account
    via      = source.storage_queue_endpoint[0].storage_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared storage-account instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "event-grid-topic" {
  match {
    type = "azurerm_eventgrid_topic"
  }

  as = concept.event-grid-topic

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
