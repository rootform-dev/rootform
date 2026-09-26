# Maintained directly from pinned provider evidence.
concept "attestation-provider" {
  description = "A Microsoft Azure Attestation provider."
}

rule "attestation-provider" {
  match {
    type = "azurerm_attestation_provider"
  }

  as = concept.attestation-provider

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
