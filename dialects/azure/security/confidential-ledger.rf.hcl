# Maintained directly from pinned provider evidence.
concept "confidential-ledger" {
  description = "An Azure confidential ledger providing tamper-evident storage."
}

rule "confidential-ledger" {
  match {
    type = "azurerm_confidential_ledger"
  }

  as = concept.confidential-ledger

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
