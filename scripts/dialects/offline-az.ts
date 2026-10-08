#!/usr/bin/env bun

// Offline stand-in for the Azure CLI. With use_cli set, the azurerm, azuread
// and azapi providers authenticate by running "az"; this answers the account
// and token commands they issue with placeholder identities so an official
// Dialect fixture plans without an Azure account or network access. The tokens
// are unsigned and no service accepts them.

const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_OBJECT = "00000000-0000-0000-0000-00000000000a";
const AZURE_CLI_CLIENT = "04b07795-8ddb-461a-bbee-02f9e1bf7b46";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function token(audience: string, issued: number): string {
  const claims = {
    aud: audience,
    iss: `https://sts.windows.net/${PLACEHOLDER_ID}/`,
    iat: issued,
    nbf: issued,
    exp: issued + 86400,
    oid: PLACEHOLDER_OBJECT,
    tid: PLACEHOLDER_ID,
    sub: PLACEHOLDER_OBJECT,
    upn: "fixture@example.invalid",
    idtyp: "user",
    appid: AZURE_CLI_CLIENT,
  };
  return [encode({ alg: "none", typ: "JWT" }), encode(claims), "fixture"].join(".");
}

function localTime(seconds: number): string {
  const date = new Date(seconds * 1000);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000000`
  );
}

const account = {
  environmentName: "AzureCloud",
  homeTenantId: PLACEHOLDER_ID,
  id: PLACEHOLDER_ID,
  isDefault: true,
  name: "fixture",
  state: "Enabled",
  tenantId: PLACEHOLDER_ID,
  user: { name: "fixture@example.invalid", type: "user" },
};

const args = process.argv.slice(2);
const [group, command] = args;
if (group === "version" || group === "--version") {
  console.log(
    JSON.stringify({ "azure-cli": "2.64.0", "azure-cli-core": "2.64.0", extensions: {} }),
  );
} else if (group === "account" && command === "show") {
  console.log(JSON.stringify(account));
} else if (group === "account" && command === "list") {
  console.log(JSON.stringify([account]));
} else if (group === "account" && command === "get-access-token") {
  let audience = "https://management.azure.com/";
  for (let index = 0; index < args.length - 1; index++) {
    if (args[index] === "--resource" || args[index] === "--scope") {
      audience = (args[index + 1] ?? audience).replace(/\/\.default$/u, "/");
    }
  }
  const issued = Math.floor(Date.now() / 1000);
  console.log(
    JSON.stringify({
      accessToken: token(audience, issued),
      expiresOn: localTime(issued + 86400),
      expires_on: issued + 86400,
      subscription: PLACEHOLDER_ID,
      tenant: PLACEHOLDER_ID,
      tokenType: "Bearer",
    }),
  );
} else {
  console.error(`offline az: unsupported command: ${args.join(" ")}`);
  process.exit(2);
}
