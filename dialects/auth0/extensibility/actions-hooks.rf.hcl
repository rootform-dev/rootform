concept "identity-extension" {
  description = "An Auth0 Action, Rule, or Hook executing custom identity logic."
}

rule "action" {
  match {
    type = "auth0_action"
  }

  as = concept.identity-extension

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "action-lookup" {
  match {
    kind = "data"
    type = "auth0_action"
  }

  as = concept.identity-extension

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "hook" {
  match {
    type = "auth0_hook"
  }

  as = concept.identity-extension

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "rule" {
  match {
    type = "auth0_rule"
  }

  as = concept.identity-extension

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}
