# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

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
