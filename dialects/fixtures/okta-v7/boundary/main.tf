terraform {
  required_providers {
    okta = {
      source  = "okta/okta"
      version = "7.0.0"
    }
  }
}

variable "choose_first" {
  type    = bool
  default = true
}

provider "okta" {
  api_token  = "ROOTFORM_OKTA_BOUNDARY_SECRET_SENTINEL"
  org_name   = "rootform-example"
  base_url   = "okta.com"
  http_proxy = "http://127.0.0.1:47201"
}

resource "okta_app_oauth" "first" {
  label = "first"
  type  = "web"
}

resource "okta_app_oauth" "second" {
  label = "second"
  type  = "web"
}

resource "okta_realm" "mismatch" {

  name = "mismatch"

}
resource "okta_app_features" "literal" {
  name       = "USER_PROVISIONING"
  app_id     = "first"
  depends_on = [okta_app_oauth.first]
}

resource "okta_app_features" "ambiguous" {
  name   = "USER_PROVISIONING"
  app_id = var.choose_first ? okta_app_oauth.first.id : okta_app_oauth.second.id
}

resource "okta_app_features" "mismatch" {
  name   = "USER_PROVISIONING"
  app_id = okta_realm.mismatch.id
}

resource "okta_api_token" "private" {
  id   = "fx-private-id"
  name = "private"
}

resource "okta_user" "private" {
  first_name                = "Rootform"
  last_name                 = "Boundary"
  login                     = "boundary@example.invalid"
  email                     = "boundary@example.invalid"
  custom_profile_attributes = jsonencode({ private = "ROOTFORM_OKTA_BOUNDARY_PROFILE_SENTINEL" })
}
