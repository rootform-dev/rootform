concept "secret-manager-secret-version" {
  description = "A version attached to a Secret Manager secret without exposing its secret data."
}

rule "secret-manager-secret" {
  match {
    type = "google_secret_manager_secret"
  }

  as = concept.managed-secret

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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

rule "secret-manager-secret-version" {
  match {
    type = "google_secret_manager_secret_version"
  }

  as = concept.secret-manager-secret-version

  contribution {
    to       = concept.managed-secret
    via      = source.secret
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "secret-manager-regional-secret" {
  match {
    type = "google_secret_manager_regional_secret"
  }

  as = concept.managed-secret

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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

rule "secret-manager-regional-secret-version" {
  match {
    type = "google_secret_manager_regional_secret_version"
  }

  as = concept.secret-manager-secret-version

  contribution {
    to       = concept.managed-secret
    via      = source.secret
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
