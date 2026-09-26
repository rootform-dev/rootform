# Maintained directly from pinned provider evidence.
rule "signalr-service" {
  match {
    type = "azurerm_signalr_service"
  }

  as = concept.realtime-communication-service

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
