# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "snowflake" {
  organization_name = "FIXTURE"
  account_name      = "FIXTURE"
  user              = "fixture"
  password          = "fixture"
  protocol          = "http"
  host              = "127.0.0.1"
  port              = 47201
}
