rule "project-iam-member" {
  match {
    type = "google_project_iam_member"
  }

  as = concept.service-identity-binding

  contribution {
    to       = rf.concept.service-identity
    via      = source.member
    on_null  = "absent"
    on_empty = "absent"

    # Only a serviceAccount: member names a service identity; user, group and
    # domain members name principals outside this concept.
    prefix = "serviceAccount:"

    match {
      by       = target.email
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "project-iam-binding" {
  match {
    type = "google_project_iam_binding"
  }

  as = concept.service-identity-binding

  contribution {
    to       = rf.concept.service-identity
    via      = source.members
    on_null  = "absent"
    on_empty = "absent"

    # Only a serviceAccount: member names a service identity; user, group and
    # domain members name principals outside this concept.
    prefix = "serviceAccount:"

    match {
      by       = target.email
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "project-iam-policy" {
  match {
    type = "google_project_iam_policy"
  }

  as = concept.service-identity-binding
}
