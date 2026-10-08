# Maintained directly from pinned provider evidence.
concept "integration-account" {
  description = "An Azure Logic Apps integration account."
}

rule "logic-app-http-action" {
  match {
    type = "azurerm_logic_app_action_http"
  }

  as = concept.api-management-detail
}

rule "logic-app-integration-account" {
  match {
    type = "azurerm_logic_app_integration_account"
  }

  as = concept.integration-account

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

rule "logic-app-recurrence-trigger" {
  match {
    type = "azurerm_logic_app_trigger_recurrence"
  }

  as = concept.api-management-detail
}

rule "logic-app-standard" {
  match {
    type = "azurerm_logic_app_standard"
  }

  as = concept.workflow

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

rule "logic-app-workflow" {
  match {
    type = "azurerm_logic_app_workflow"
  }

  as = concept.workflow

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
