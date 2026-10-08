terraform {
  required_providers {
    okta = {
      source  = "okta/okta"
      version = "7.0.0"
    }
  }
}

# Reads of this provider need its API, so the plan defers them until apply.
resource "terraform_data" "defer_reads" {
}
provider "okta" {
  api_token  = "ROOTFORM_OKTA_PROVIDER_TOKEN_SENTINEL"
  org_name   = "rootform-example"
  base_url   = "okta.com"
  http_proxy = "http://127.0.0.1:47201"
}

resource "okta_api_service_integration" "api_service_integration" {

  type = "fx-api-service-integration-type"

}
data "okta_api_service_integration" "api_service_integration" {
  id         = "fx-api-service-integration-id"
  depends_on = [terraform_data.defer_reads]

}

resource "okta_app_access_policy_assignment" "app_access_policy_assignment" {
  policy_id = okta_app_signon_policy.app_signon_policy.id
  app_id    = okta_app_oauth.oauth.id
}

resource "okta_app_auto_login" "app_auto_login" {

  label = "fx-app-auto-login-label"

}
resource "okta_app_basic_auth" "app_basic_auth" {
  auth_url = "https://fx-app-basic-auth-auth-url.example.com"
  url      = "https://fx-app-basic-auth-url.example.com"
  label    = "fx-app-basic-auth-label"

}

resource "okta_app_bookmark" "app_bookmark" {
  label = "fx-app-bookmark-label"
  url   = "https://fx-app-bookmark-url.example.com"

}

resource "okta_app_connection" "app_connection" {
  base_url = "https://fx-app-connection-base-url.example.com"
  action   = "activate"
  id       = "fx-app-connection-id"
  profile {
    auth_scheme = "TOKEN"
  }
}

data "okta_app_connection" "app_connection" {
  id         = "fx-app-connection-id"
  depends_on = [terraform_data.defer_reads]

}

resource "okta_app_features" "app_features" {
  name   = "USER_PROVISIONING"
  app_id = okta_app_oauth.oauth.id
}

data "okta_app_features" "app_features" {
  name       = "fx-app-features-name"
  depends_on = [terraform_data.defer_reads]
  app_id     = okta_app_oauth.oauth.id
}

resource "okta_app_federated_claim" "app_federated_claim" {
  name       = "fx-app-federated-claim-name"
  expression = "fx-app-federated-claim-expression"
  app_id     = okta_app_oauth.oauth.id
}

data "okta_app_federated_claim" "app_federated_claim" {
  id         = "fx-app-federated-claim-id"
  depends_on = [terraform_data.defer_reads]
  app_id     = okta_app_oauth.oauth.id
}

data "okta_app" "app" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_app_oauth" "oauth" {
  label               = "fx-oauth-label"
  type                = "fx-oauth-type"
  client_basic_secret = "ROOTFORM_OKTA_APP_SECRET_SENTINEL"
}

resource "okta_app_oauth_api_scope" "app_oauth_api_scope" {
  scopes = ["fx-app-oauth-api-scope-scopes"]
  issuer = "https://fx-app-oauth-api-scope-issuer.example.com"
  app_id = okta_app_oauth.oauth.id
}

data "okta_app_oauth" "app_oauth" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_app_oauth_post_logout_redirect_uri" "app_oauth_post_logout_redirect_uri" {
  uri    = "https://fx-app-oauth-post-logout-redirect-uri-uri.example.com"
  app_id = okta_app_oauth.oauth.id
}

resource "okta_app_oauth_redirect_uri" "app_oauth_redirect_uri" {
  uri    = "https://fx-app-oauth-redirect-uri-uri.example.com"
  app_id = okta_app_oauth.oauth.id
}

resource "okta_app_saml" "portal" {
  label          = "fx-portal-label"
  inline_hook_id = okta_inline_hook.token.id
}

resource "okta_app_saml_app_settings" "app_saml_app_settings" {
  settings = jsonencode({ fixture = true })
  app_id   = okta_app_oauth.oauth.id
}

data "okta_app_saml" "app_saml" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_app_secure_password_store" "app_secure_password_store" {
  username_field = "fx-app-secure-password-store-username-field"
  label          = "fx-app-secure-password-store-label"
  password_field = "fx-app-secure-password-store-password-field"
  url            = "https://fx-app-secure-password-store-url.example.com"

}

resource "okta_app_shared_credentials" "app_shared_credentials" {

  label = "fx-app-shared-credentials-label"

}
data "okta_app_sign_on_policy_rule" "app_sign_on_policy_rule" {
  policy_id  = okta_app_signon_policy.app_signon_policy.id
  id         = "fx-app-sign-on-policy-rule-id"
  depends_on = [terraform_data.defer_reads]

}

resource "okta_app_signon_policy" "app_signon_policy" {
  name        = "fx-app-signon-policy-name"
  description = "fx-app-signon-policy-description"

}

data "okta_app_signon_policy" "app_signon_policy" {
  app_id     = "fx-app-signon-policy-app-id"
  depends_on = [terraform_data.defer_reads]

}

resource "okta_app_signon_policy_rule" "app_signon_policy_rule" {
  policy_id = okta_app_signon_policy.app_signon_policy.id
  name      = "fx-app-signon-policy-rule-name"

}

resource "okta_app_swa" "app_swa" {

  label = "fx-app-swa-label"

}
resource "okta_app_three_field" "app_three_field" {
  button_selector      = "fx-app-three-field-button-selector"
  username_selector    = "fx-app-three-field-username-selector"
  extra_field_selector = "fx-app-three-field-extra-field-selector"
  url                  = "https://fx-app-three-field-url.example.com"
  password_selector    = "fx-app-three-field-password-selector"
  extra_field_value    = "fx-app-three-field-extra-field-value"
  label                = "fx-app-three-field-label"

}

resource "okta_auth_server" "api" {
  audiences = ["fx-api-audiences"]
  name      = "fx-api-name"

}

resource "okta_auth_server_claim" "auth_server_claim" {
  value          = "fx-auth-server-claim-value"
  claim_type     = "fx-auth-server-claim-claim-type"
  name           = "fx-auth-server-claim-name"
  auth_server_id = okta_auth_server.api.id
}

resource "okta_auth_server_claim_default" "auth_server_claim_default" {
  name           = "fx-auth-server-claim-default-name"
  auth_server_id = okta_auth_server.api.id
}

data "okta_auth_server_claim" "auth_server_claim" {
  depends_on     = [terraform_data.defer_reads]
  auth_server_id = okta_auth_server.api.id
}

resource "okta_auth_server_default" "auth_server_default" {

}
data "okta_auth_server" "auth_server" {
  name       = "fx-auth-server-name"
  depends_on = [terraform_data.defer_reads]

}

resource "okta_auth_server_policy" "auth_server_policy" {
  priority         = 1
  name             = "fx-auth-server-policy-name"
  description      = "fx-auth-server-policy-description"
  client_whitelist = ["fx-auth-server-policy-client-whitelist"]
  auth_server_id   = okta_auth_server.api.id
}

data "okta_auth_server_policy" "auth_server_policy" {
  name           = "fx-auth-server-policy-name"
  depends_on     = [terraform_data.defer_reads]
  auth_server_id = okta_auth_server.api.id
}

resource "okta_auth_server_policy_rule" "auth_server_policy_rule" {
  name                 = "fx-auth-server-policy-rule-name"
  grant_type_whitelist = ["fx-auth-server-policy-rule-grant-type-whitelist"]
  policy_id            = okta_auth_server_policy.auth_server_policy.id
  priority             = 1
  auth_server_id       = okta_auth_server.api.id
  inline_hook_id       = okta_inline_hook.token.id
}

resource "okta_auth_server_scope" "read" {
  name           = "fx-read-name"
  auth_server_id = okta_auth_server.api.id
}

resource "okta_authenticator" "primary" {
  key  = "fx-primary-key"
  name = "fx-primary-name"

}

data "okta_authenticator" "authenticator" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_authenticator_method_webauthn" "authenticator_method_webauthn" {

  authenticator_id = okta_authenticator.primary.id

}
data "okta_authenticator_method_webauthn" "authenticator_method_webauthn" {
  depends_on       = [terraform_data.defer_reads]
  authenticator_id = okta_authenticator.primary.id
}

resource "okta_authenticator_webauthn_custom_aaguid" "authenticator_webauthn_custom_aaguid" {
  aaguid           = "fx-authenticator-webauthn-custom-aaguid-aaguid"
  name             = "fx-authenticator-webauthn-custom-aaguid-name"
  authenticator_id = okta_authenticator.primary.id
}

data "okta_authenticator_webauthn_custom_aaguids" "authenticator_webauthn_custom_aaguids" {
  authenticator_id = "fx-authenticator-webauthn-custom-aaguids-authent"
  depends_on       = [terraform_data.defer_reads]

}

resource "okta_behavior" "behavior" {
  name = "fx-behavior-name"
  type = "fx-behavior-type"

}

data "okta_behavior" "behavior" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_captcha" "captcha" {

}
data "okta_captcha" "captcha" {
  id         = "fx-captcha-id"
  depends_on = [terraform_data.defer_reads]

}

resource "okta_domain" "login" {

  name = "fx-login-name"

}
resource "okta_domain_certificate" "domain_certificate" {
  certificate_chain = "fx-domain-certificate-certificate-chain"
  certificate       = "fx-domain-certificate-certificate"
  domain_id         = okta_domain.login.id
  private_key       = "ROOTFORM_OKTA_DOMAIN_PRIVATE_KEY_SENTINEL"
}

data "okta_domain" "domain" {
  domain_id_or_name = "fx-domain-domain-id-or-name"
  depends_on        = [terraform_data.defer_reads]

}

resource "okta_domain_verification" "login" {

  domain_id = okta_domain.login.id

}
resource "okta_event_hook" "events" {
  events  = ["fx-events-events"]
  channel = {}
  name    = "fx-events-name"
  headers {
    key   = "Authorization"
    value = "ROOTFORM_OKTA_HOOK_HEADER_SENTINEL"
  }
}

resource "okta_event_hook_verification" "event_hook_verification" {

  event_hook_id = okta_event_hook.events.id

}
resource "okta_hook_key" "hook_key" {

  name = "fx-hook-key-name"

}
data "okta_hook_key" "hook_key" {
  id         = "fx-hook-key-id"
  depends_on = [terraform_data.defer_reads]

}

resource "okta_idp_oidc" "idp_oidc" {
  scopes                = ["fx-idp-oidc-scopes"]
  token_url             = "https://fx-idp-oidc-token-url.example.com"
  token_binding         = "fx-idp-oidc-token-binding"
  client_id             = "00000000-0000-0000-0000-000000000001"
  jwks_binding          = "fx-idp-oidc-jwks-binding"
  authorization_url     = "https://fx-idp-oidc-authorization-url.example.com"
  name                  = "fx-idp-oidc-name"
  jwks_url              = "https://fx-idp-oidc-jwks-url.example.com"
  authorization_binding = "fx-idp-oidc-authorization-binding"
  issuer_url            = "https://fx-idp-oidc-issuer-url.example.com"
  client_secret         = "ROOTFORM_OKTA_IDP_SECRET_SENTINEL"
}

data "okta_idp_oidc" "idp_oidc" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_idp_saml" "idp_saml" {
  name    = "fx-idp-saml-name"
  issuer  = "https://fx-idp-saml-issuer.example.com"
  kid     = "fx-idp-saml-kid"
  sso_url = "https://fx-idp-saml-sso-url.example.com"

}

data "okta_idp_saml" "idp_saml" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_idp_social" "idp_social" {
  scopes = ["fx-idp-social-scopes"]
  name   = "fx-idp-social-name"
  type   = "fx-idp-social-type"

}

data "okta_idp_social" "idp_social" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_inline_hook" "token" {
  name    = "fx-token-name"
  version = "fx-token-version"
  type    = "fx-token-type"

}

resource "okta_log_stream" "log_stream" {
  name = "fx-log-stream-name"
  type = "splunk_cloud_logstreaming"
  settings {
    edition = "aws"
    host    = "fixture.splunkcloud.com"
    token   = "0badc0de-5e47-4e11-8000-000000000001"
  }
}

data "okta_log_stream" "log_stream" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_network_zone" "network_zone" {
  name = "fx-network-zone-name"
  type = "fx-network-zone-type"

}

data "okta_network_zone" "network_zone" {

  depends_on = [terraform_data.defer_reads]

}
data "okta_oauth_authorization_server" "oauth_authorization_server" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_org_captcha" "org_captcha" {

}
data "okta_org_captcha" "org_captcha" {
  depends_on = [terraform_data.defer_reads]
}
resource "okta_org_configuration" "primary" {

  company_name = "fx-primary-company-name"

}
data "okta_org_metadata" "org_metadata" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_policy_rule_idp_discovery" "routing" {

  name = "fx-routing-name"

}
resource "okta_realm" "customers" {

  name = "fx-customers-name"

}
resource "okta_realm_assignment" "realm_assignment" {
  name              = "fx-realm-assignment-name"
  profile_source_id = "fx-realm-assignment-profile-source-id"
  realm_id          = okta_realm.customers.id
}

data "okta_realm_assignment" "realm_assignment" {
  depends_on = [terraform_data.defer_reads]
}

data "okta_realm" "realm" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_security_events_provider" "security_events_provider" {
  type       = "fx-security-events-provider-type"
  name       = "fx-security-events-provider-name"
  is_enabled = "fx-security-events-provider-is-enabled"

}

data "okta_security_events_provider" "security_events_provider" {
  id         = "fx-security-events-provider-id"
  depends_on = [terraform_data.defer_reads]

}

resource "okta_threat_insight_settings" "threat_insight_settings" {

  action = "fx-threat-insight-settings-action"

}
data "okta_threat_insight_settings" "threat_insight_settings" {

  depends_on = [terraform_data.defer_reads]

}
resource "okta_trusted_origin" "trusted_origin" {
  origin = "fx-trusted-origin-origin"
  name   = "fx-trusted-origin-name"

}

data "okta_trusted_origin" "trusted_origin" {
  id         = "fx-trusted-origin-id"
  depends_on = [terraform_data.defer_reads]

}

resource "okta_trusted_server" "trusted_server" {
  trusted        = ["fx-trusted-server-trusted"]
  auth_server_id = okta_auth_server.api.id
}

resource "okta_user" "must_not_create_topology" {
  first_name = "Rootform"
  last_name  = "Sentinel"
  login      = "sentinel@example.invalid"
  email      = "sentinel@example.invalid"

  custom_profile_attributes = jsonencode({ private = "ROOTFORM_OKTA_USER_PROFILE_SENTINEL" })
}
