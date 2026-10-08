# Maintained directly from pinned provider evidence.
concept "container-app" {
  description = "An Azure Container Apps service running container revisions."
}

concept "container-app-environment" {
  description = "An Azure Container Apps environment sharing network and operational boundaries."
}

concept "container-app-job" {
  description = "An Azure Container Apps job running finite container work."
}

rule "container-app" {
  match {
    type = "azurerm_container_app"
  }

  as = concept.container-app

  context {
    as       = rf.context.runtime
    to       = concept.container-app-environment
    via      = source.container_app_environment_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # A full ARM resource ID names one environment, which a separate configuration can provision.
    external = "allow"
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

rule "container-app-environment" {
  match {
    type = "azurerm_container_app_environment"
  }

  as = concept.container-app-environment

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.infrastructure_subnet_id
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

  relation "observed-by" {
    to       = concept.log-analytics-workspace
    via      = source.log_analytics_workspace_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared log-analytics-workspace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "container-app-job" {
  match {
    type = "azurerm_container_app_job"
  }

  as = concept.container-app-job

  context {
    as       = rf.context.runtime
    to       = concept.container-app-environment
    via      = source.container_app_environment_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
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
