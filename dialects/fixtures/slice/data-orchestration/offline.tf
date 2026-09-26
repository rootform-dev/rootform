# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "google" {
  access_token = "fixture"
  project      = "fixture-project"
  region       = "us-central1"
}

provider "kestra" {
  url = "http://127.0.0.1:1"
}

provider "random" {
}

provider "vault" {
  address                = "http://127.0.0.1:1"
  token                  = "fixture"
  skip_child_token       = true
  skip_get_vault_version = true
}
