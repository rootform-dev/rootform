# Maintained directly from pinned provider evidence.
concept "elastic-san" {
  description = "An Azure Elastic SAN storage boundary."
}

rule "elastic-san" {
  match {
    type = "azurerm_elastic_san"
  }

  as = concept.elastic-san

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

rule "elastic-san-volume-group" {
  match {
    type = "azurerm_elastic_san_volume_group"
  }

  as = concept.elastic-san
}
