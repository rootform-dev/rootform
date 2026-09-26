# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "vault" {
  address                = "http://127.0.0.1:1"
  token                  = "fixture"
  skip_child_token       = true
  skip_get_vault_version = true
}
