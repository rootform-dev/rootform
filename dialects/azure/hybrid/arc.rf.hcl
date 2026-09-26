# Maintained directly from pinned provider evidence.
concept "arc-enabled-server" {
  description = "A server connected to Azure through Azure Arc."
}

concept "arc-resource-bridge" {
  description = "An Azure Arc resource bridge connecting an external platform."
}

concept "custom-location" {
  description = "An Azure Arc custom location extending Azure resource placement."
}

rule "arc-custom-location" {
  match {
    type = "azurerm_extended_location_custom_location"
  }

  as = concept.custom-location

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

rule "arc-enabled-server" {
  match {
    type = "azurerm_arc_machine"
  }

  as = concept.arc-enabled-server

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

rule "arc-resource-bridge" {
  match {
    type = "azurerm_arc_resource_bridge_appliance"
  }

  as = concept.arc-resource-bridge

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
