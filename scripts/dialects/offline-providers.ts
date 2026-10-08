import type { ProviderRequirement } from "./plan-fixtures.ts";

// Placeholder provider configurations that let Terraform plan an official
// Dialect fixture with no network access and no credentials. Planning a new
// configuration without refresh reads nothing remote, so a provider only has
// to configure itself; every value below is a public placeholder that grants
// access to nothing.

export type OfflineProfile = {
  // Provider block body, one argument or nested block per line.
  body: string[];
  // The provider authenticates through the offline Azure CLI stand-in.
  azureCli?: true;
  // The provider calls its API while configuring itself; the plan runs with
  // the loopback API stand-in (scripts/dialects/offline-api.ts) listening.
  api?: true;
  // Environment the provider reads its API endpoints from.
  env?: Readonly<Record<string, string>>;
};

const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";
const UNREACHABLE_URL = "http://127.0.0.1:1";

// Fixed loopback ports of the API stand-in, so offline.tf stays byte stable.
export const OFFLINE_API_HTTP_PORT = 47201;
export const OFFLINE_API_HTTPS_PORT = 47202;
const OFFLINE_API_URL = `http://127.0.0.1:${OFFLINE_API_HTTP_PORT}`;
const OFFLINE_API_TLS_ADDRESS = `127.0.0.1:${OFFLINE_API_HTTPS_PORT}`;

const google: OfflineProfile = {
  body: ['access_token = "fixture"', 'project = "fixture-project"', 'region = "us-central1"'],
};

export const offlineProfiles: Readonly<Record<string, OfflineProfile>> = {
  "auth0/auth0": { body: ['domain = "fixture.example.invalid"', 'api_token = "fixture"'] },
  "azure/azapi": {
    body: [
      `subscription_id = "${PLACEHOLDER_ID}"`,
      `tenant_id = "${PLACEHOLDER_ID}"`,
      "use_cli = true",
      "skip_provider_registration = true",
    ],
    azureCli: true,
  },
  // The provider accepts only 40-character tokens.
  "cloudflare/cloudflare": { body: [`api_token = "${"fixture".padEnd(40, "0")}"`] },
  "confluentinc/confluent": { body: ['cloud_api_key = "fixture"', 'cloud_api_secret = "fixture"'] },
  // The provider only warns when host metadata is unreachable; a short retry
  // budget keeps that from stalling the plan.
  "databricks/databricks": {
    body: [`host = "${UNREACHABLE_URL}"`, 'token = "fixture"', "retry_timeout_seconds = 1"],
  },
  "datadog/datadog": { body: ['api_key = "fixture"', 'app_key = "fixture"', "validate = false"] },
  // Each API family the provider manages needs its own client configured
  // before a resource of that family can plan.
  "grafana/grafana": {
    body: [
      `url = "${UNREACHABLE_URL}"`,
      'auth = "fixture"',
      'cloud_access_policy_token = "fixture"',
      `cloud_api_url = "${UNREACHABLE_URL}"`,
      'cloud_provider_access_token = "fixture"',
      `cloud_provider_url = "${UNREACHABLE_URL}"`,
      'connections_api_access_token = "fixture"',
      `connections_api_url = "${UNREACHABLE_URL}"`,
      'fleet_management_auth = "fixture:fixture"',
      `fleet_management_url = "${UNREACHABLE_URL}"`,
      'frontend_o11y_api_access_token = "fixture"',
      'k6_access_token = "fixture"',
      `k6_url = "${UNREACHABLE_URL}"`,
      'oncall_access_token = "fixture"',
      `oncall_url = "${UNREACHABLE_URL}"`,
      'sm_access_token = "fixture"',
      `sm_url = "${UNREACHABLE_URL}"`,
      "retries = 0",
    ],
  },
  // Some AWS resources call the API while planning; with a single attempt
  // such a call fails at once instead of backing off against an unreachable
  // endpoint. The provider treats max_retries = 0 as unset (25 attempts).
  "hashicorp/aws": {
    body: [
      'region = "us-east-1"',
      'access_key = "fixture"',
      'secret_key = "fixture"',
      "max_retries = 1",
      "skip_credentials_validation = true",
      "skip_metadata_api_check = true",
      "skip_region_validation = true",
      "skip_requesting_account_id = true",
    ],
  },
  "hashicorp/azuread": {
    body: [`tenant_id = "${PLACEHOLDER_ID}"`, "use_cli = true"],
    azureCli: true,
  },
  "hashicorp/azurerm": {
    body: [
      "features {}",
      `subscription_id = "${PLACEHOLDER_ID}"`,
      "use_cli = true",
      'resource_provider_registrations = "none"',
    ],
    azureCli: true,
  },
  "hashicorp/consul": { body: ['address = "127.0.0.1:1"', 'token = "fixture"'] },
  "hashicorp/google": google,
  "hashicorp/google-beta": google,
  "hashicorp/hcp": {
    body: [
      'client_id = "fixture"',
      'client_secret = "fixture"',
      `project_id = "${PLACEHOLDER_ID}"`,
      "skip_status_check = true",
    ],
    api: true,
    env: {
      HCP_API_ADDRESS: OFFLINE_API_TLS_ADDRESS,
      HCP_API_TLS: "insecure",
      HCP_AUTH_TLS: "insecure",
      HCP_AUTH_URL: `https://${OFFLINE_API_TLS_ADDRESS}`,
    },
  },
  "hashicorp/kubernetes": {
    body: ['host = "https://127.0.0.1:1"', 'token = "fixture"', "insecure = true"],
  },
  "hashicorp/random": { body: [] },
  "hashicorp/vault": {
    body: [
      `address = "${UNREACHABLE_URL}"`,
      'token = "fixture"',
      "skip_child_token = true",
      "skip_get_vault_version = true",
    ],
  },
  "kestra-io/kestra": { body: [`url = "${UNREACHABLE_URL}"`] },
  "mongodb/mongodbatlas": { body: ['public_key = "fixture"', 'private_key = "fixture"'] },
  "newrelic/newrelic": { body: ["account_id = 1", 'api_key = "fixture"', 'region = "US"'] },
  // The provider validates its token against the API; http_proxy routes that
  // call to the stand-in.
  "okta/okta": {
    body: [
      'org_name = "fixture"',
      'base_url = "okta.com"',
      'api_token = "fixture"',
      `http_proxy = "${OFFLINE_API_URL}"`,
    ],
    api: true,
  },
  // The provider opens a session while configuring itself.
  "snowflakedb/snowflake": {
    body: [
      'organization_name = "FIXTURE"',
      'account_name = "FIXTURE"',
      'user = "fixture"',
      'password = "fixture"',
      'protocol = "http"',
      'host = "127.0.0.1"',
      `port = ${OFFLINE_API_HTTP_PORT}`,
    ],
    api: true,
  },
};

export const OFFLINE_HEADER = [
  "# Written by scripts/dialects/generate-plan-fixtures.ts: placeholder provider",
  "# configuration that lets Terraform plan this fixture without network access",
  "# or credentials. No value here grants access to anything.",
];

// The offline configuration for every required provider the fixture does not
// configure itself, before formatting. It is empty when there is none.
export function offlineConfiguration(
  requirements: ProviderRequirement[],
  configured: Set<string>,
): string {
  const blocks: string[] = [];
  for (const requirement of requirements) {
    if (configured.has(requirement.local)) continue;
    const profile = offlineProfiles[requirement.source];
    if (!profile) throw new Error(`no offline profile for provider ${requirement.source}`);
    const body = profile.body.map((line) => `  ${line}`);
    blocks.push([`provider "${requirement.local}" {`, ...body, "}"].join("\n"));
  }
  if (blocks.length === 0) return "";
  return `${[OFFLINE_HEADER.join("\n"), ...blocks].join("\n\n")}\n`;
}

export function needsAzureCli(requirements: ProviderRequirement[]): boolean {
  return requirements.some(({ source }) => offlineProfiles[source]?.azureCli === true);
}

export function needsOfflineApi(requirements: ProviderRequirement[]): boolean {
  return requirements.some(({ source }) => offlineProfiles[source]?.api === true);
}

// Environment the required providers read their stand-in endpoints from.
export function offlineEnvironment(requirements: ProviderRequirement[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const { source } of requirements) Object.assign(env, offlineProfiles[source]?.env ?? {});
  return env;
}
