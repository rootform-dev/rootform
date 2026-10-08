terraform {
  required_providers {
    auth0 = {
      source  = "auth0/auth0"
      version = "1.56.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "6.62.0"
    }
  }
}

# Reads of this provider need its API, so the plan defers them until apply.
resource "terraform_data" "defer_reads" {
}
resource "auth0_tenant" "primary" {
}
data "auth0_tenant" "current" {
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_organization" "customer" {
  name = "customer"
}
data "auth0_organization" "customer" {
  name       = "fx-customer-name"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_resource_server" "api" {
  identifier = "https://api.example.invalid"
}
data "auth0_resource_server" "api" {
  identifier = "fx-api-identifier"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_client" "portal" {
  name                       = "portal"
  resource_server_identifier = auth0_resource_server.api.identifier

  default_organization {
    organization_id = auth0_organization.customer.id
  }
}

data "auth0_client" "portal" {

  depends_on = [terraform_data.defer_reads]

}
resource "auth0_client_cimd" "partner" {
  external_client_id = "fx-partner-external-client-id"
}
resource "auth0_client_credentials" "portal" {
  client_id = auth0_client.portal.id
}
resource "auth0_client_grant" "portal" {
  client_id = auth0_client.portal.id
  audience  = auth0_resource_server.api.identifier
  scopes    = ["read:fixture"]
}

resource "auth0_resource_server_scope" "read" {
  resource_server_identifier = auth0_resource_server.api.identifier
  scope                      = "read"
}

resource "auth0_resource_server_scopes" "all" {
  scopes {
    name = "fx-all-name"
  }
  resource_server_identifier = auth0_resource_server.api.identifier
}

resource "auth0_connection" "workforce" {
  name     = "workforce"
  strategy = "oidc"
}

data "auth0_connection" "workforce" {
  connection_id = "fx-workforce-connection-id"
  depends_on    = [terraform_data.defer_reads]
}
resource "auth0_connection_client" "portal" {
  connection_id = auth0_connection.workforce.id
  client_id     = auth0_client.portal.id
}

resource "auth0_connection_clients" "portal" {
  enabled_clients = ["fx-portal-enabled-clients"]
  connection_id   = auth0_connection.workforce.id
}

resource "auth0_connection_directory" "directory" {

  connection_id = auth0_connection.workforce.id

}
data "auth0_connection_directory" "directory" {
  connection_id = "fx-directory-connection-id"
  depends_on    = [terraform_data.defer_reads]
}
resource "auth0_connection_directory_synchronized_groups" "groups" {
  connection_id = auth0_connection_directory.directory.id
}
data "auth0_connection_directory_synchronized_groups" "groups" {
  depends_on    = [terraform_data.defer_reads]
  connection_id = auth0_connection_directory.directory.id
}

resource "auth0_connection_keys" "keys" {
  triggers      = {}
  connection_id = auth0_connection.workforce.id
}

data "auth0_connection_keys" "keys" {
  depends_on    = [terraform_data.defer_reads]
  connection_id = auth0_connection.workforce.id
}

resource "auth0_connection_scim_configuration" "scim" {

  connection_id = auth0_connection.workforce.id

}
data "auth0_connection_scim_configuration" "scim" {
  depends_on    = [terraform_data.defer_reads]
  connection_id = auth0_connection.workforce.id
}

resource "auth0_connection_profile" "enterprise" {

  name = "fx-enterprise-name"

}
data "auth0_connection_profile" "enterprise" {
  id         = "fx-enterprise-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_self_service_profile" "enterprise" {
  name = "fx-enterprise-name"
}
data "auth0_self_service_profile" "enterprise" {
  id         = "fx-enterprise-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_user_attribute_profile" "enterprise" {
  user_attributes {
    label            = "fx-enterprise-label"
    description      = "fx-enterprise-description"
    auth0_mapping    = "fx-enterprise-auth0-mapping"
    profile_required = false
    name             = "fx-enterprise-name"
  }
  name = "fx-enterprise-name"
}
data "auth0_user_attribute_profile" "enterprise" {
  name       = "fx-enterprise-name"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_custom_domain" "login" {
  domain = "login.example.invalid"
  type   = "auth0_managed_certs"
}

data "auth0_custom_domain" "login" {

  depends_on = [terraform_data.defer_reads]

}
resource "auth0_custom_domain_default" "login" {
  domain = auth0_custom_domain.login.domain
}
resource "auth0_custom_domain_verification" "login" {
  custom_domain_id = auth0_custom_domain.login.id
}
resource "auth0_action" "normalize" {
  supported_triggers {
    id      = "fx-normalize-id"
    version = "fx-normalize-version"
  }
  code = "fx-normalize-code"
  name = "normalize"
}

data "auth0_action" "normalize" {
  id         = "fx-normalize-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_action_module" "shared" {
  name = "fx-shared-name"
  code = "fx-shared-code"
}
data "auth0_action_module" "shared" {
  id         = "fx-shared-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_rule" "legacy" {
  script = "fx-legacy-script"
  name   = "legacy"
}

resource "auth0_hook" "credentials_exchange" {
  trigger_id = "credentials-exchange"
  script     = "fx-credentials-exchange-script"
  name       = "credentials-exchange"
}

resource "auth0_trigger_action" "normalize" {
  action_id = auth0_action.normalize.id
  trigger   = "post-login"
}

resource "auth0_trigger_actions" "login" {
  actions {
    display_name = "fx-login-display-name"
    id           = "fx-login-id"
  }
  trigger = "post-login"
}

resource "auth0_token_exchange_profile" "partner" {
  name      = "partner"
  action_id = auth0_action.normalize.id
}

data "auth0_token_exchange_profile" "partner" {
  id         = "fx-partner-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_flow" "onboarding" {
  name = "onboarding"
}
data "auth0_flow" "onboarding" {
  id         = "fx-onboarding-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_form" "profile" {
  name = "profile"
}
data "auth0_form" "profile" {
  id         = "fx-profile-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_flow_vault_connection" "crm" {
  name   = "crm"
  app_id = "ACTIVECAMPAIGN"
}

data "auth0_flow_vault_connection" "crm" {
  id         = "fx-crm-id"
  depends_on = [terraform_data.defer_reads]
}
resource "aws_cloudwatch_event_bus" "audit" {
  name = "auth0-audit"
}
resource "auth0_event_stream" "lifecycle" {
  name             = "lifecycle"
  destination_type = "action"
  subscriptions    = ["user.created"]

  action_configuration {
    action_id = auth0_action.normalize.id
  }

  depends_on = [aws_cloudwatch_event_bus.audit]
}

data "auth0_event_stream" "lifecycle" {
  id         = "fx-lifecycle-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_log_stream" "security" {
  sink {
  }
  name = "security"
  type = "eventbridge"
}

resource "auth0_network_acl" "authentication" {
  rule {
    match {
    }
    action {
      allow = false
    }
    scope = "management"
  }
  active      = true
  description = "authentication boundary"
  priority    = 1
}

data "auth0_network_acl" "authentication" {
  id         = "fx-authentication-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_attack_protection" "tenant" {
}
data "auth0_attack_protection" "tenant" {
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_guardian" "mfa" {
  policy = "all-applications"
}
resource "auth0_risk_assessments" "tenant" {
  enabled = true
}
resource "auth0_risk_assessments_new_device" "tenant" {
  remember_for = 1
}
resource "auth0_supplemental_signals" "tenant" {
  akamai_enabled = false
}
resource "auth0_encryption_key_manager" "tenant" {
}
resource "auth0_rate_limit_policy" "portal" {
  configuration {
    action = "allow"
  }
  resource          = "oauth_authentication_api"
  consumer_selector = "fx-portal-consumer-selector"
  consumer          = "client"

}
data "auth0_rate_limit_policy" "portal" {
  policy_id  = auth0_rate_limit_policy.portal.id
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_email_provider" "transactional" {
  credentials {
  }
  default_from_address = "identity@example.invalid"
  name                 = "smtp"
}

resource "auth0_phone_provider" "transactional" {
  credentials {
  }
  configuration {
    delivery_methods = ["voice"]
  }
  name = "twilio"
}

data "auth0_phone_provider" "transactional" {
  id         = "fx-transactional-id"
  depends_on = [terraform_data.defer_reads]
}
resource "auth0_organization_client" "portal" {
  organization_id = auth0_organization.customer.id
  client_id       = auth0_client.portal.id
}

data "auth0_organization_client" "portal" {
  depends_on      = [terraform_data.defer_reads]
  organization_id = auth0_organization.customer.id
  client_id       = auth0_client.portal.id
}

resource "auth0_organization_client_grant" "portal" {
  organization_id = auth0_organization.customer.id
  grant_id        = "grant"
}

resource "auth0_organization_clients" "all" {
  clients {
    client_id = "00000000-0000-0000-0000-000000000001"
  }
  organization_id = auth0_organization.customer.id
}

resource "auth0_organization_connection" "workforce" {
  organization_id = auth0_organization.customer.id
  connection_id   = auth0_connection.workforce.id
}

resource "auth0_organization_connections" "workforce" {
  enabled_connections {
    connection_id = "fx-workforce-connection-id"
  }
  organization_id = auth0_organization.customer.id
}

resource "auth0_organization_discovery_domain" "customer" {
  status          = "pending"
  organization_id = auth0_organization.customer.id
  domain          = "customer.example.invalid"
}

resource "auth0_organization_discovery_domains" "customer" {
  discovery_domains {
    status = "pending"
    domain = "fx-customer-domain"
  }
  organization_id = auth0_organization.customer.id
}

resource "auth0_user" "must_not_create_topology" {
  connection_name = "fx-must-not-create-topology-connection-name"
  email           = "identity-user@example.invalid"
}

resource "auth0_role" "must_not_create_topology" {

  name = "reader"

}
resource "auth0_branding" "must_not_create_topology" {
}
