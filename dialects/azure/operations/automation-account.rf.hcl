# Maintained directly from pinned provider evidence.
concept "automation-account" {
  description = "An Azure Automation account owning runbooks and schedules."
}

rule "automation-account" {
  match {
    type = "azurerm_automation_account"
  }

  as = concept.automation-account

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
