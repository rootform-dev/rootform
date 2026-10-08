# Maintained directly from pinned provider evidence.
concept "bastion-host" {
  description = "An Azure Bastion service providing managed private administration access."
}

rule "bastion-host" {
  match {
    type = "azurerm_bastion_host"
  }

  as = concept.bastion-host

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
