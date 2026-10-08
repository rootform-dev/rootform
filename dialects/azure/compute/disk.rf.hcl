# Maintained directly from pinned provider evidence.
rule "elastic-san-volume" {
  match {
    type = "azurerm_elastic_san_volume"
  }

  as = concept.block-storage-volume
}

rule "managed-disk" {
  match {
    type = "azurerm_managed_disk"
  }

  as = concept.block-storage-volume

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

rule "stack-hci-virtual-hard-disk" {
  match {
    type = "azurerm_stack_hci_virtual_hard_disk"
  }

  as = concept.block-storage-volume

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
