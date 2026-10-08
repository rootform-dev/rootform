rule "organization" {
  match {
    type = "grafana_organization"
  }

  as = concept.observability-tenant

  identity {
    attributes = ["id", "org_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "org_id", "name"]
  }
}

rule "organization-lookup" {
  match {
    kind = "data"
    type = "grafana_organization"
  }

  as = concept.observability-tenant

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}
