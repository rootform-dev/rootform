concept "secret-sync-configuration" {
  description = "A destination association or service setting supporting Vault Secrets Sync."
}

concept "secret-sync-destination" {
  description = "An external cloud or SaaS destination receiving secrets through Vault Secrets Sync."
}

rule "secrets-sync-association" {
  match {
    type = "vault_secrets_sync_association"
  }

  as = concept.secret-sync-configuration

  contribution {
    to       = concept.secret-sync-destination
    via      = source.name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "secrets-sync-aws-destination" {
  match {
    type = "vault_secrets_sync_aws_destination"
  }

  as = concept.secret-sync-destination

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-encryption-key" {
    to       = concept.encryption-key
    via      = source.kms_key_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared encryption-key instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "secrets-sync-azure-destination" {
  match {
    type = "vault_secrets_sync_azure_destination"
  }

  as = concept.secret-sync-destination

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.client_id
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "secrets-sync-config" {
  match {
    type = "vault_secrets_sync_config"
  }

  as = concept.secret-sync-configuration
}

rule "secrets-sync-gcp-destination" {
  match {
    type = "vault_secrets_sync_gcp_destination"
  }

  as = concept.secret-sync-destination

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.service_account_email
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "uses-encryption-key" {
    to       = concept.encryption-key
    via      = source.kms_key_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared encryption-key instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-encryption-key" {
    to       = concept.encryption-key
    via      = source.global_kms_key
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared encryption-key instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "secrets-sync-gh-destination" {
  match {
    type = "vault_secrets_sync_gh_destination"
  }

  as = concept.secret-sync-destination

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "secrets-sync-github-apps" {
  match {
    type = "vault_secrets_sync_github_apps"
  }

  as = concept.secret-sync-destination

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "secrets-sync-vercel-destination" {
  match {
    type = "vault_secrets_sync_vercel_destination"
  }

  as = concept.secret-sync-destination

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
