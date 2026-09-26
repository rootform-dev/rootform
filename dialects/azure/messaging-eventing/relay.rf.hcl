# Maintained directly from pinned provider evidence.
concept "relay-connection" {
  description = "An Azure Relay hybrid connection."
}

concept "relay-namespace" {
  description = "An Azure Relay namespace."
}

rule "relay-hybrid-connection" {
  match {
    type = "azurerm_relay_hybrid_connection"
  }

  as = concept.relay-connection

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

rule "relay-namespace" {
  match {
    type = "azurerm_relay_namespace"
  }

  as = concept.relay-namespace

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
