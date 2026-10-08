# Maintained directly from pinned provider evidence.
rule "service-bus-namespace" {
  match {
    type = "azurerm_servicebus_namespace"
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

rule "service-bus-queue" {
  match {
    type = "azurerm_servicebus_queue"
  }

  as = concept.message-queue

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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

rule "service-bus-subscription" {
  match {
    type = "azurerm_servicebus_subscription"
  }

  as = concept.message-subscription

  context {
    as       = context.ownership
    to       = concept.service-bus-topic
    via      = source.topic_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "subscribes-to" {
    to       = concept.service-bus-topic
    via      = source.topic_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "service-bus-subscription-rule" {
  match {
    type = "azurerm_servicebus_subscription_rule"
  }

  as = concept.messaging-detail
}

rule "service-bus-topic" {
  match {
    type = "azurerm_servicebus_topic"
  }

  as = concept.service-bus-topic

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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
