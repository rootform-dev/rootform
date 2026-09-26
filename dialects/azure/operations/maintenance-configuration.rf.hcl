# Maintained directly from pinned provider evidence.
concept "maintenance-configuration" {
  description = "An Azure maintenance configuration defining update windows."
}

rule "maintenance-configuration" {
  match {
    type = "azurerm_maintenance_configuration"
  }

  as = concept.maintenance-configuration

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
