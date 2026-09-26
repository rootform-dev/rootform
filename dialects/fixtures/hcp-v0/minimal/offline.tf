# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "hcp" {
  client_id         = "fixture"
  client_secret     = "fixture"
  project_id        = "00000000-0000-0000-0000-000000000000"
  skip_status_check = true
}
