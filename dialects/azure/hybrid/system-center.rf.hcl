# Maintained directly from pinned provider evidence.
rule "system-center-vmm-server" {
  match {
    type = "azurerm_system_center_virtual_machine_manager_server"
  }

  as = concept.hybrid-platform

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
