concept "organization" {
  description = "A MongoDB Atlas organization owning projects, access, and billing boundaries."
}

concept "project" {
  description = "A MongoDB Atlas project isolating database deployments, networking, access, and service configuration."
}

concept "governance-configuration" {
  description = "A policy or administrative configuration supporting an Atlas organization or project."
}

rule "organization" {
  match {
    type = "mongodbatlas_organization"
  }

  as = concept.organization

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "project" {
  match {
    type = "mongodbatlas_project"
  }

  as = concept.project

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.organization
    via      = source.org_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared organization instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "resource-policy" {
  match {
    type = "mongodbatlas_resource_policy"
  }

  as = concept.governance-configuration

  contribution {
    to       = concept.organization
    via      = source.org_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared organization instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
