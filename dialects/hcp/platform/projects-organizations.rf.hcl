concept "organization" {
  description = "A top-level HCP ownership and governance boundary."
}

concept "project" {
  description = "An HCP boundary grouping managed products and access."
}

rule "organization-lookup" {
  match {
    kind = "data"
    type = "hcp_organization"
  }

  as = concept.organization

  identity {
    attributes = ["resource_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["resource_id", "resource_name"]
  }
}

rule "project" {
  match {
    type = "hcp_project"
  }

  as = concept.project

  identity {
    attributes = ["resource_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["resource_id", "resource_name"]
  }
}

rule "project-lookup" {
  match {
    kind = "data"
    type = "hcp_project"
  }

  as = concept.project

  identity {
    attributes = ["resource_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["resource_id", "resource_name"]
  }
}
