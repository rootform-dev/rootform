# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "datadog" {
  api_key  = "fixture"
  app_key  = "fixture"
  validate = false
}
