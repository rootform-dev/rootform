rule "iam-role" {
  match {
    type = "aws_iam_role"
  }

  as = concept.iam-role

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "iam-role-policy-attachment" {
  match {
    type = "aws_iam_role_policy_attachment"
  }

  as = concept.service-identity-binding

  contribution {
    to  = concept.iam-role
    via = source.role

    on_null  = "absent"
    on_empty = "absent"

    # Shared iam-role instances can be provisioned by a separate configuration.
    external = "allow"
    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "iam-instance-profile" {
  match {
    type = "aws_iam_instance_profile"
  }

  as = concept.instance-profile

  contribution {
    to  = concept.iam-role
    via = source.role

    on_null  = "absent"
    on_empty = "absent"

    # Shared iam-role instances can be provisioned by a separate configuration.
    external = "allow"
    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
