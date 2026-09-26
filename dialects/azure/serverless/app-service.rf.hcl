# Maintained directly from pinned provider evidence.
concept "app-service" {
  description = "An Azure App Service web application runtime."
}

concept "app-service-environment" {
  description = "An isolated Azure App Service hosting environment."
}

concept "app-service-plan" {
  description = "An Azure App Service plan providing shared runtime capacity."
}

rule "app-service-environment" {
  match {
    type = "azurerm_app_service_environment_v3"
  }

  as = concept.app-service-environment

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

rule "app-service-plan" {
  match {
    type = "azurerm_service_plan"
  }

  as = concept.app-service-plan

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

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

rule "linux-web-app" {
  match {
    type = "azurerm_linux_web_app"
  }

  as = concept.app-service

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

  context {
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.virtual_network_subnet_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = rf.context.runtime
    to       = concept.app-service-plan
    via      = source.service_plan_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

}

rule "windows-web-app" {
  match {
    type = "azurerm_windows_web_app"
  }

  as = concept.app-service

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

  context {
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.virtual_network_subnet_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = rf.context.runtime
    to       = concept.app-service-plan
    via      = source.service_plan_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

}
