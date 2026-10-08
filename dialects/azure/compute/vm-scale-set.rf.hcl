# Maintained directly from pinned provider evidence.
concept "virtual-machine-scale-set" {
  description = "An Azure-managed group of virtual machines that scales as one compute workload."
}

rule "linux-virtual-machine-scale-set" {
  match {
    type = "azurerm_linux_virtual_machine_scale_set"
  }

  as = concept.virtual-machine-scale-set

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

rule "orchestrated-virtual-machine-scale-set" {
  match {
    type = "azurerm_orchestrated_virtual_machine_scale_set"
  }

  as = concept.virtual-machine-scale-set

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

rule "virtual-machine-scale-set" {
  match {
    type = "azurerm_virtual_machine_scale_set"
  }

  as = concept.virtual-machine-scale-set

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

rule "windows-virtual-machine-scale-set" {
  match {
    type = "azurerm_windows_virtual_machine_scale_set"
  }

  as = concept.virtual-machine-scale-set

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
