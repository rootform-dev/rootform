# Maintained directly from pinned provider evidence.
concept "spring-apps-service" {
  description = "An Azure Spring Apps service boundary."
}

rule "spring-apps-gateway" {
  match {
    type = "azurerm_spring_cloud_gateway"
  }

  as = concept.spring-app
}

rule "spring-apps-service" {
  match {
    type = "azurerm_spring_cloud_service"
  }

  as = concept.spring-apps-service

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
