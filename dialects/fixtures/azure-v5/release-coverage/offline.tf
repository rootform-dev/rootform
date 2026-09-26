# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "azapi" {
  subscription_id            = "00000000-0000-0000-0000-000000000000"
  tenant_id                  = "00000000-0000-0000-0000-000000000000"
  use_cli                    = true
  skip_provider_registration = true
}

provider "azuread" {
  tenant_id = "00000000-0000-0000-0000-000000000000"
  use_cli   = true
}

provider "azurerm" {
  features {}
  subscription_id                 = "00000000-0000-0000-0000-000000000000"
  use_cli                         = true
  resource_provider_registrations = "none"
}
