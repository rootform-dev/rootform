# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "confluent" {
  cloud_api_key    = "fixture"
  cloud_api_secret = "fixture"
}
