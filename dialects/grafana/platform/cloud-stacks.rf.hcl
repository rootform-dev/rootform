rule "cloud-stack" {
  match {
    type = "grafana_cloud_stack"
  }

  as = concept.observability-tenant

  identity {
    attributes = ["id", "slug"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "slug", "name"]
  }
}

rule "cloud-stack-lookup" {
  match {
    kind = "data"
    type = "grafana_cloud_stack"
  }

  as = concept.observability-tenant

  identity {
    attributes = ["id", "slug"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "slug", "name"]
  }
}
