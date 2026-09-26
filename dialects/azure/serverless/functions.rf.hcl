# Maintained directly from pinned provider evidence.
rule "flex-consumption-function-app" {
  match {
    type = "azurerm_function_app_flex_consumption"
  }

  as = concept.serverless-function

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

rule "function-app-function" {
  match {
    type = "azurerm_function_app_function"
  }

  as = concept.serverless-function

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "linux-function-app" {
  match {
    type = "azurerm_linux_function_app"
  }

  as = concept.serverless-function

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

  relation "observed-by" {
    to       = concept.application-insights
    via      = source.site_config[0].application_insights_connection_string
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.connection_string
      strategy = "exact"
    }
  }
}

rule "windows-function-app" {
  match {
    type = "azurerm_windows_function_app"
  }

  as = concept.serverless-function

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

  relation "observed-by" {
    to       = concept.application-insights
    via      = source.site_config[0].application_insights_connection_string
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.connection_string
      strategy = "exact"
    }
  }
}
