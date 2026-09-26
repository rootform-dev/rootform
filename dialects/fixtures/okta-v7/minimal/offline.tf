# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "okta" {
  org_name   = "fixture"
  base_url   = "okta.com"
  api_token  = "fixture"
  http_proxy = "http://127.0.0.1:47201"
}
