# Maintained directly from pinned provider evidence.
concept "ai-foundry" {
  description = "A Microsoft Foundry account or project boundary."
}

concept "machine-learning-workspace" {
  description = "An Azure Machine Learning workspace."
}

rule "ai-foundry" {
  match {
    type = "azurerm_ai_foundry"
  }

  as = concept.ai-foundry

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

rule "ai-foundry-project" {
  match {
    type = "azurerm_ai_foundry_project"
  }

  as = concept.ai-foundry
}

rule "ai-services-project" {
  match {
    type = "azurerm_cognitive_account_project"
  }

  as = concept.ai-foundry
}

rule "machine-learning-workspace" {
  match {
    type = "azurerm_machine_learning_workspace"
  }

  as = concept.machine-learning-workspace

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
