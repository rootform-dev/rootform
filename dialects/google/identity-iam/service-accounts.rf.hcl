concept "service-credential" {
  description = "A credential issued for a service identity."
}

rule "iam-service-account" {
  match {
    type = "google_service_account"
  }

  as = rf.concept.service-identity

  # A service account email and its projects/<project>/serviceAccounts/<email>
  # id are unique across Google Cloud, so other providers can name the account.
  identity {
    attributes = ["email", "id"]
    scope      = "global"
  }

  endpoint {
    attributes = ["email", "id", "member", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.google-cloud-project
    via      = source.project
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.project_id
      strategy = "exact"
    }

    # Shared google-cloud-project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "service-account-key" {
  match {
    type = "google_service_account_key"
  }

  as = concept.service-credential

  contribution {
    to       = rf.concept.service-identity
    via      = source.service_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.id, target.email]
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
