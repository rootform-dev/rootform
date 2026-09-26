#!/usr/bin/env bun

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { offlineConfiguration } from "./dialects/offline-providers.ts";
import { configuredProviders, providerRequirements } from "./dialects/plan-fixtures.ts";

const root = resolve(import.meta.dir, "..");
const terraform = process.env.TERRAFORM_BIN ?? "terraform";
const cache = process.env.ROOTFORM_PLAN_FIXTURE_CACHE;
if (!cache || !existsSync(cache))
  throw new Error("ROOTFORM_PLAN_FIXTURE_CACHE must name the offline provider cache");
const families = ["commerce-platform", "event-driven-platform", "shared-data-platform"];
const profile =
  '(version 1)(allow default)(deny network-outbound (remote ip "*:*"))(allow network-outbound (remote ip "localhost:*"))';
function step(command: string[], cwd: string, env: Record<string, string>): string {
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 600000,
  });
  if (result.exitCode !== 0)
    throw new Error(`${command.join(" ")}: ${result.stdout.toString()}${result.stderr.toString()}`);
  return result.stdout.toString();
}
// With no argument, plan every Playground side. Arguments name other
// configuration directories, relative to the repository root, such as a
// documentation fixture under scripts/fixtures/docs/.
const requested = process.argv.slice(2);
const sources =
  requested.length > 0
    ? requested.map((directory) => resolve(root, directory))
    : families.flatMap((family) =>
        ["base", "head"].map((side) => join(root, "examples/playground", family, side)),
      );
for (const source of sources) {
  const label = relative(root, source);
  if (!existsSync(join(source, "main.tf"))) throw new Error(`${label}: missing main.tf`);
  // Provider RPC sockets have a short Unix path limit on macOS.
  const scratch = mkdtempSync("/tmp/rfp-");
  const work = join(scratch, "work");
  const home = join(scratch, "home");
  const bin = join(scratch, "bin");
  mkdirSync(work);
  mkdirSync(home);
  mkdirSync(bin);
  copyFileSync(join(source, "main.tf"), join(work, "main.tf"));
  const main = readFileSync(join(work, "main.tf"), "utf8");
  const requirements = providerRequirements(main);
  const offline = offlineConfiguration(requirements, configuredProviders(main));
  if (offline) writeFileSync(join(work, "offline.tf"), offline);
  const config = join(scratch, "terraformrc");
  writeFileSync(config, "");
  writeFileSync(
    join(bin, "az"),
    `#!/bin/sh\nexec "${Bun.which("bun")}" "${join(import.meta.dir, "dialects/offline-az.ts")}" "$@"\n`,
    { mode: 0o755 },
  );
  const env: Record<string, string> = {
    HOME: home,
    PATH: `${bin}:${dirname(terraform)}:/usr/bin:/bin:/usr/sbin:/sbin`,
    TMPDIR: scratch,
    TF_CLI_CONFIG_FILE: config,
    TF_PLUGIN_CACHE_DIR: cache,
    TF_IN_AUTOMATION: "1",
    CHECKPOINT_DISABLE: "1",
    AWS_EC2_METADATA_DISABLED: "true",
    ARM_SUBSCRIPTION_ID: "00000000-0000-0000-0000-000000000000",
    ARM_TENANT_ID: "00000000-0000-0000-0000-000000000000",
    ARM_USE_CLI: "true",
    GOOGLE_OAUTH_ACCESS_TOKEN: "fixture",
    GOOGLE_PROJECT: "fixture-project",
    TF_VAR_entra_tenant_id: "00000000-0000-0000-0000-000000000002",
    TF_VAR_dba_group_object_id: "00000000-0000-0000-0000-000000000003",
    TF_VAR_payments_psp_api_key: "fixture-placeholder",
    TF_VAR_notifications_smtp_password: "fixture-placeholder",
    TF_VAR_ocr_api_key: "fixture-placeholder",
    TF_VAR_org_id: "123456789012",
    TF_VAR_billing_account: "000000-000000-000000",
    TF_VAR_ingest_hmac_key: "fixture-placeholder",
    TF_VAR_warehouse_db_password: "fixture-placeholder",
    TF_VAR_legacy_warehouse_credentials: "fixture-placeholder",
  };
  console.log(`Planning ${label}`);
  step([terraform, "init", "-input=false", "-no-color"], work, env);
  step(
    [
      "sandbox-exec",
      "-p",
      profile,
      terraform,
      "plan",
      "-input=false",
      "-no-color",
      "-lock=false",
      "-refresh=false",
      "-out=plan.tfplan",
    ],
    work,
    env,
  );
  const plan = step(
    ["sandbox-exec", "-p", profile, terraform, "show", "-json", "-no-color", "plan.tfplan"],
    work,
    env,
  );
  copyFileSync(join(work, ".terraform.lock.hcl"), join(source, ".terraform.lock.hcl"));
  copyFileSync(join(work, "plan.tfplan"), join(source, "plan.tfplan"));
  writeFileSync(join(source, "plan.json"), plan);
  console.log(`${label}: plan.json ${Buffer.byteLength(plan)} bytes`);
}
