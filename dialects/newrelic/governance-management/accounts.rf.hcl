rule "account-lookup" {
  match {
    kind = "data"
    type = "newrelic_account"
  }

  as = concept.observability-tenant

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "account-management" {
  match {
    type = "newrelic_account_management"
  }

  as = concept.observability-tenant

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}
