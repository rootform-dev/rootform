# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "google" {
  access_token = "fixture"
  project      = "fixture-project"
  region       = "us-central1"
}
