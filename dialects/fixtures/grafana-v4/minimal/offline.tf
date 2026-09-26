# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider
# configuration that lets Terraform plan this fixture without network access
# or credentials. No value here grants access to anything.

provider "grafana" {
  url                            = "http://127.0.0.1:1"
  auth                           = "fixture"
  cloud_access_policy_token      = "fixture"
  cloud_api_url                  = "http://127.0.0.1:1"
  cloud_provider_access_token    = "fixture"
  cloud_provider_url             = "http://127.0.0.1:1"
  connections_api_access_token   = "fixture"
  connections_api_url            = "http://127.0.0.1:1"
  fleet_management_auth          = "fixture:fixture"
  fleet_management_url           = "http://127.0.0.1:1"
  frontend_o11y_api_access_token = "fixture"
  k6_access_token                = "fixture"
  k6_url                         = "http://127.0.0.1:1"
  oncall_access_token            = "fixture"
  oncall_url                     = "http://127.0.0.1:1"
  sm_access_token                = "fixture"
  sm_url                         = "http://127.0.0.1:1"
  retries                        = 0
}
