# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "mongodbatlas" {
  public_key  = "fixture"
  private_key = "fixture"
}
