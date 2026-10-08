# Maintained directly from pinned provider evidence.
concept "load-test" {
  description = "An Azure Load Testing resource."
}

rule "load-test" {
  match {
    type = "azurerm_load_test"
  }

  as = concept.load-test

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
