# Maintained directly from pinned provider evidence.
concept "event-stream" {
  description = "An Azure Event Hubs append-only event stream."
}

rule "event-hub" {
  match {
    type = "azurerm_eventhub"
  }

  as = concept.event-stream

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.messaging-namespace
    via      = source.namespace_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # A full ARM resource ID names one namespace, which a separate configuration can provision.
    external = "allow"
  }
}

rule "event-hubs-cluster" {
  match {
    type = "azurerm_eventhub_cluster"
  }

  as = concept.event-stream

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

rule "event-hubs-consumer-group" {
  match {
    type = "azurerm_eventhub_consumer_group"
  }

  as = concept.messaging-detail

  context {
    as       = context.ownership
    to       = concept.event-stream
    via      = source.eventhub_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.event-stream
    via      = source.eventhub_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "event-hubs-namespace" {
  match {
    type = "azurerm_eventhub_namespace"
  }

  as = concept.messaging-namespace

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

rule "event-hubs-schema-group" {
  match {
    type = "azurerm_eventhub_namespace_schema_group"
  }

  as = concept.messaging-detail

  contribution {
    to       = concept.messaging-namespace
    via      = source.namespace_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
