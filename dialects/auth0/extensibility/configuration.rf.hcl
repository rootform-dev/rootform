concept "extension-configuration" {
  description = "A module or trigger binding supporting Auth0 identity extensions."
}

rule "action-module" {
  match {
    type = "auth0_action_module"
  }

  as = concept.extension-configuration
}

rule "action-module-lookup" {
  match {
    kind = "data"
    type = "auth0_action_module"
  }

  as = concept.extension-configuration
}

rule "trigger-action" {
  match {
    type = "auth0_trigger_action"
  }

  as = concept.extension-configuration

  contribution {
    to       = concept.identity-extension
    via      = source.action_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "trigger-actions" {
  match {
    type = "auth0_trigger_actions"
  }

  as = concept.extension-configuration
}
