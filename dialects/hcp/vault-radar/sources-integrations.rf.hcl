concept "vault-radar-configuration" {
  description = "A subscription or access setting supporting HCP Vault Radar."
}

concept "vault-radar-integration" {
  description = "An external workflow destination integrated with HCP Vault Radar."
}

concept "vault-radar-secret-manager" {
  description = "A Vault Dedicated secret manager correlated with HCP Vault Radar findings."
}

concept "vault-radar-source" {
  description = "A source repository scanned by HCP Vault Radar for secret exposure."
}

rule "vault-radar-integration-jira-connection" {
  match {
    type = "hcp_vault_radar_integration_jira_connection"
  }

  as = concept.vault-radar-integration

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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

rule "vault-radar-integration-jira-subscription" {
  match {
    type = "hcp_vault_radar_integration_jira_subscription"
  }

  as = concept.vault-radar-configuration

  contribution {
    to       = concept.vault-radar-integration
    via      = source.connection_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "vault-radar-integration-slack-connection" {
  match {
    type = "hcp_vault_radar_integration_slack_connection"
  }

  as = concept.vault-radar-integration

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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

rule "vault-radar-integration-slack-subscription" {
  match {
    type = "hcp_vault_radar_integration_slack_subscription"
  }

  as = concept.vault-radar-configuration

  contribution {
    to       = concept.vault-radar-integration
    via      = source.connection_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "vault-radar-resource-iam-binding" {
  match {
    type = "hcp_vault_radar_resource_iam_binding"
  }

  as = concept.vault-radar-configuration
}

rule "vault-radar-resource-iam-policy" {
  match {
    type = "hcp_vault_radar_resource_iam_policy"
  }

  as = concept.vault-radar-configuration
}

rule "vault-radar-secret-manager-vault-dedicated" {
  match {
    type = "hcp_vault_radar_secret_manager_vault_dedicated"
  }

  as = concept.vault-radar-secret-manager

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

  relation "connects-vault-cluster" {
    to       = concept.vault-dedicated-cluster
    via      = source.vault_url
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.vault_public_endpoint_url
      strategy = "exact"
    }
  }
}

rule "vault-radar-source-github-cloud" {
  match {
    type = "hcp_vault_radar_source_github_cloud"
  }

  as = concept.vault-radar-source

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

rule "vault-radar-source-github-enterprise" {
  match {
    type = "hcp_vault_radar_source_github_enterprise"
  }

  as = concept.vault-radar-source

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
