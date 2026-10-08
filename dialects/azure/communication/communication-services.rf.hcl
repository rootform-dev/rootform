# Maintained directly from pinned provider evidence.
concept "communication-service" {
  description = "An Azure Communication Services resource."
}

concept "email-communication-service" {
  description = "An Azure Communication Services Email resource."
}

rule "communication-service" {
  match {
    type = "azurerm_communication_service"
  }

  as = concept.communication-service

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

rule "email-communication-service" {
  match {
    type = "azurerm_email_communication_service"
  }

  as = concept.email-communication-service

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
