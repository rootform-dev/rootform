concept "access-control-configuration" {
  description = "An IAM binding, membership, policy, or constraint supporting an HCP boundary."
}

concept "workload-identity-provider" {
  description = "An HCP federation boundary exchanging an external workload identity for a service principal."
}

rule "group" {
  match {
    type = "hcp_group"
  }

  as = concept.identity-group

  identity {
    attributes = ["resource_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["resource_id", "resource_name"]
  }
}

rule "group-iam-binding" {
  match {
    type = "hcp_group_iam_binding"
  }

  as = concept.access-control-configuration

  contribution {
    to       = concept.identity-group
    via      = source.name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_name
      strategy = "exact"
    }
  }
}

rule "group-iam-policy" {
  match {
    type = "hcp_group_iam_policy"
  }

  as = concept.access-control-configuration

  contribution {
    to       = concept.identity-group
    via      = source.name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_name
      strategy = "exact"
    }
  }
}

rule "group-lookup" {
  match {
    kind = "data"
    type = "hcp_group"
  }

  as = concept.identity-group

  identity {
    attributes = ["resource_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["resource_id", "resource_name"]
  }
}

rule "group-members" {
  match {
    type = "hcp_group_members"
  }

  as = concept.access-control-configuration

  contribution {
    to       = concept.identity-group
    via      = source.group
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_name
      strategy = "exact"
    }
  }
}

rule "iam-workload-identity-provider" {
  match {
    type = "hcp_iam_workload_identity_provider"
  }

  as = concept.workload-identity-provider

  relation "federates-to" {
    to       = rf.concept.service-identity
    via      = source.service_principal
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_name
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "organization-iam-binding" {
  match {
    type = "hcp_organization_iam_binding"
  }

  as = concept.access-control-configuration
}

rule "organization-iam-policy" {
  match {
    type = "hcp_organization_iam_policy"
  }

  as = concept.access-control-configuration
}

rule "project-iam-binding" {
  match {
    type = "hcp_project_iam_binding"
  }

  as = concept.access-control-configuration

  contribution {
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "project-iam-policy" {
  match {
    type = "hcp_project_iam_policy"
  }

  as = concept.access-control-configuration

  contribution {
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "resource-control-policy" {
  match {
    type = "hcp_resource_control_policy"
  }

  as = concept.access-control-configuration

  contribution {
    to       = concept.organization
    via      = source.organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared organization instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "service-principal" {
  match {
    type = "hcp_service_principal"
  }

  as = rf.concept.service-identity

  identity {
    attributes = ["resource_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["resource_id", "resource_name"]
  }
}

rule "service-principal-lookup" {
  match {
    kind = "data"
    type = "hcp_service_principal"
  }

  as = rf.concept.service-identity

  identity {
    attributes = ["resource_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["resource_id", "resource_name"]
  }
}
