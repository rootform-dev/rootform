# Maintained directly from pinned provider evidence.
rule "dev-test-linux-virtual-machine" {
  match {
    type = "azurerm_dev_test_linux_virtual_machine"
  }

  as = concept.compute-instance

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

rule "dev-test-windows-virtual-machine" {
  match {
    type = "azurerm_dev_test_windows_virtual_machine"
  }

  as = concept.compute-instance

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

rule "linux-virtual-machine" {
  match {
    type = "azurerm_linux_virtual_machine"
  }

  as = concept.compute-instance

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

rule "system-center-virtual-machine" {
  match {
    type = "azurerm_system_center_virtual_machine_manager_virtual_machine_instance"
  }

  as = concept.compute-instance
}

rule "virtual-machine" {
  match {
    type = "azurerm_virtual_machine"
  }

  as = concept.compute-instance

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

rule "windows-virtual-machine" {
  match {
    type = "azurerm_windows_virtual_machine"
  }

  as = concept.compute-instance

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
