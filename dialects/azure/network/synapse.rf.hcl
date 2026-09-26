# Maintained directly from pinned provider evidence.
rule "synapse-private-link-hub" {
  match {
    type = "azurerm_synapse_private_link_hub"
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
