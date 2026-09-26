terraform {
  required_providers {
    okta = {
      source  = "okta/okta"
      version = "7.0.0"
    }
  }
}

resource "okta_org_configuration" "primary" {
  company_name = "Rootform"
}

resource "okta_app_oauth" "frontend" {
  label = "frontend"
  type  = "web"
}

resource "okta_auth_server" "api" {
  name      = "api"
  audiences = ["api"]
}

resource "okta_idp_oidc" "workforce" {
  client_secret         = "fx-workforce-client-secret"
  token_url             = "https://example.com"
  token_binding         = "fx-workforce-token-binding"
  scopes                = ["fixture"]
  jwks_url              = "https://example.com"
  jwks_binding          = "fx-workforce-jwks-binding"
  issuer_url            = "https://example.com"
  client_id             = "00000000-0000-0000-0000-000000000001"
  authorization_url     = "https://example.com"
  authorization_binding = "fx-workforce-authorization-binding"
  name                  = "workforce"
}

resource "okta_event_hook" "audit" {
  channel = {}
  name    = "audit"
  events  = ["user.lifecycle.create"]
}
