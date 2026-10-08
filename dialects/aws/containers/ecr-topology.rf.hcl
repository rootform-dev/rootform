rule "ecr-repository" {
  match {
    type = "aws_ecr_repository"
  }

  as = concept.container-repository

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "ecr-lifecycle-policy" {
  match {
    type = "aws_ecr_lifecycle_policy"
  }

  as = concept.repository-configuration

  contribution {
    to  = concept.container-repository
    via = source.repository

    on_null  = "absent"
    on_empty = "absent"
    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
