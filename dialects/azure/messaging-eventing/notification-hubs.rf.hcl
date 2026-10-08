# Maintained directly from pinned provider evidence.
concept "notification-hub" {
  description = "An Azure Notification Hubs push-notification hub."
}

concept "notification-namespace" {
  description = "An Azure Notification Hubs namespace."
}

rule "notification-hub" {
  match {
    type = "azurerm_notification_hub"
  }

  as = concept.notification-hub

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

rule "notification-hubs-namespace" {
  match {
    type = "azurerm_notification_hub_namespace"
  }

  as = concept.notification-namespace

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
