# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "newrelic" {
  account_id = 1
  api_key    = "fixture"
  region     = "US"
}
