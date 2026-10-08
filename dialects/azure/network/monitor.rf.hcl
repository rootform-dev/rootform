# Maintained directly from pinned provider evidence.
rule "monitor-private-link-scope" {
  match {
    type = "azurerm_monitor_private_link_scope"
  }

  as = concept.private-link-scope

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
