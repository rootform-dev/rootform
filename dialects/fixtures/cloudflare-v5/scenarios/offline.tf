# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "fixture"
  secret_key                  = "fixture"
  max_retries                 = 1
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
}

provider "azurerm" {
  features {}
  subscription_id                 = "00000000-0000-0000-0000-000000000000"
  use_cli                         = true
  resource_provider_registrations = "none"
}

provider "cloudflare" {
  api_token = "fixture000000000000000000000000000000000"
}

provider "google" {
  access_token = "fixture"
  project      = "fixture-project"
  region       = "us-central1"
}

provider "kubernetes" {
  host     = "https://127.0.0.1:1"
  token    = "fixture"
  insecure = true
}
