concept "vault-secrets-application" {
  description = "An HCP Vault Secrets application boundary grouping secrets and sync destinations."
}

concept "vault-secrets-configuration" {
  description = "A secret read or access setting supporting an HCP Vault Secrets application."
}

concept "vault-secrets-integration" {
  description = "An HCP Vault Secrets integration with an external cloud or SaaS platform."
}

concept "vault-secrets-sync" {
  description = "An HCP Vault Secrets destination synchronizing application secrets externally."
}

rule "vault-secrets-app" {
  match {
    type = "hcp_vault_secrets_app"
  }

  as = concept.vault-secrets-application

  identity {
    attributes = ["app_name", "resource_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "app_name", "resource_name"]
  }

  context {
    as       = context.ownership
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

  relation "syncs-to" {
    to       = concept.vault-secrets-sync
    via      = source.sync_names
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "vault-secrets-app-iam-binding" {
  match {
    type = "hcp_vault_secrets_app_iam_binding"
  }

  as = concept.vault-secrets-configuration

  contribution {
    to       = concept.vault-secrets-application
    via      = source.resource_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_name
      strategy = "exact"
    }
  }
}

rule "vault-secrets-app-iam-policy" {
  match {
    type = "hcp_vault_secrets_app_iam_policy"
  }

  as = concept.vault-secrets-configuration

  contribution {
    to       = concept.vault-secrets-application
    via      = source.resource_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_name
      strategy = "exact"
    }
  }
}

rule "vault-secrets-app-lookup" {
  match {
    kind = "data"
    type = "hcp_vault_secrets_app"
  }

  as = concept.vault-secrets-application

  identity {
    attributes = ["app_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "app_name"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "vault-secrets-dynamic-secret" {
  match {
    type = "hcp_vault_secrets_dynamic_secret"
  }

  as = concept.managed-secret

  context {
    as       = context.ownership
    to       = concept.vault-secrets-application
    via      = source.app_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.app_name
      strategy = "exact"
    }
  }

  relation "uses-integration" {
    to       = concept.vault-secrets-integration
    via      = source.integration_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.gcp_impersonate_service_account.service_account_email
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.email
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "vault-secrets-dynamic-secret-lookup" {
  match {
    kind = "data"
    type = "hcp_vault_secrets_dynamic_secret"
  }

  as = concept.vault-secrets-configuration

  contribution {
    to       = concept.vault-secrets-application
    via      = source.app_name
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.app_name
      strategy = "exact"
    }
  }
}

rule "vault-secrets-integration" {
  match {
    type = "hcp_vault_secrets_integration"
  }

  as = concept.vault-secrets-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "resource_id", "resource_name"]
  }

  context {
    as       = context.ownership
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

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.azure_federated_workload_identity.client_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.gcp_federated_workload_identity.service_account_email
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.email
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.gcp_service_account_key.client_email
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.email
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "vault-secrets-integration-aws" {
  match {
    type = "hcp_vault_secrets_integration_aws"
  }

  as = concept.vault-secrets-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "resource_id", "resource_name"]
  }

  context {
    as       = context.ownership
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

rule "vault-secrets-integration-azure" {
  match {
    type = "hcp_vault_secrets_integration_azure"
  }

  as = concept.vault-secrets-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "resource_id", "resource_name"]
  }

  context {
    as       = context.ownership
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

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.federated_workload_identity.client_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "vault-secrets-integration-confluent" {
  match {
    type = "hcp_vault_secrets_integration_confluent"
  }

  as = concept.vault-secrets-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "resource_id", "resource_name"]
  }

  context {
    as       = context.ownership
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

rule "vault-secrets-integration-gcp" {
  match {
    type = "hcp_vault_secrets_integration_gcp"
  }

  as = concept.vault-secrets-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "resource_id", "resource_name"]
  }

  context {
    as       = context.ownership
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

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.federated_workload_identity.service_account_email
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.email
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.service_account_key.client_email
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.email
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "vault-secrets-integration-mongodbatlas" {
  match {
    type = "hcp_vault_secrets_integration_mongodbatlas"
  }

  as = concept.vault-secrets-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "resource_id", "resource_name"]
  }

  context {
    as       = context.ownership
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

rule "vault-secrets-integration-twilio" {
  match {
    type = "hcp_vault_secrets_integration_twilio"
  }

  as = concept.vault-secrets-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "resource_id", "resource_name"]
  }

  context {
    as       = context.ownership
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

rule "vault-secrets-rotating-secret" {
  match {
    type = "hcp_vault_secrets_rotating_secret"
  }

  as = concept.managed-secret

  context {
    as       = context.ownership
    to       = concept.vault-secrets-application
    via      = source.app_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.app_name
      strategy = "exact"
    }
  }

  relation "uses-integration" {
    to       = concept.vault-secrets-integration
    via      = source.integration_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.azure_application_password.app_client_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.confluent_service_account.service_account_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.gcp_service_account_key.service_account_email
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.email
      strategy = "exact"
    }

    # Shared service-identity instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "vault-secrets-rotating-secret-lookup" {
  match {
    kind = "data"
    type = "hcp_vault_secrets_rotating_secret"
  }

  as = concept.vault-secrets-configuration

  contribution {
    to       = concept.vault-secrets-application
    via      = source.app_name
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.app_name
      strategy = "exact"
    }
  }
}

rule "vault-secrets-secret" {
  match {
    type = "hcp_vault_secrets_secret"
  }

  as = concept.managed-secret

  context {
    as       = context.ownership
    to       = concept.vault-secrets-application
    via      = source.app_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.app_name
      strategy = "exact"
    }
  }
}

rule "vault-secrets-secret-lookup" {
  match {
    kind = "data"
    type = "hcp_vault_secrets_secret"
  }

  as = concept.vault-secrets-configuration

  contribution {
    to       = concept.vault-secrets-application
    via      = source.app_name
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.app_name
      strategy = "exact"
    }
  }
}

rule "vault-secrets-sync" {
  match {
    type = "hcp_vault_secrets_sync"
  }

  as = concept.vault-secrets-sync

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "resource_id"]
  }

  context {
    as       = context.ownership
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

  relation "uses-integration" {
    to       = concept.vault-secrets-integration
    via      = source.integration_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
