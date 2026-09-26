# Maintained directly from pinned provider evidence.
concept "azure-local-cluster" {
  description = "An Azure Local or Azure Stack HCI cluster."
}

rule "azure-local-cluster" {
  match {
    type = "azurerm_stack_hci_cluster"
  }

  as = concept.azure-local-cluster

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
