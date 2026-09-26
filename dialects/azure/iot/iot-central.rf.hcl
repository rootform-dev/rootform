# Maintained directly from pinned provider evidence.
concept "iot-central-application" {
  description = "An Azure IoT Central application."
}

rule "iot-central-application" {
  match {
    type = "azurerm_iotcentral_application"
  }

  as = concept.iot-central-application

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
