concept "cloud-identity-group-membership" {
  description = "A membership contributing a principal to a Cloud Identity group."
}

rule "cloud-identity-group" {
  match {
    type = "google_cloud_identity_group"
  }

  as = concept.identity-group

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "cloud-identity-group-membership" {
  match {
    type = "google_cloud_identity_group_membership"
  }

  as = concept.cloud-identity-group-membership

  contribution {
    to       = concept.identity-group
    via      = source.group
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
