#!/usr/bin/env bun

// Maintainer tool: plan every official Dialect fixture offline with Terraform
// and record what "rootform test" replays.
//
//   ROOTFORM_BIN=/path/to/rootform bun scripts/dialects/generate-plan-fixtures.ts [filter ...]
//
// For each fixture directory under dialects/fixtures, or each whose path
// contains one of the filters, the tool:
//   1. writes offline.tf, placeholder configuration for every provider the
//      fixture does not configure itself;
//   2. copies the Terraform source to a scratch directory and runs
//      "terraform init" there, which installs the pinned providers and records
//      their checksums in the fixture's .terraform.lock.hcl;
//   3. runs "terraform plan" and "terraform show -json" in a sandbox that
//      refuses every connection except loopback, with a scrubbed environment
//      and a scratch home, so no credential, cloud account or live state can
//      reach a fixture; providers that call their API while configuring
//      themselves talk to a loopback stand-in (offline-api.ts) instead;
//   4. records plan.json and plan.tfplan beside the source, then
//      analysis.golden, the analysis "rootform test --update" records for them;
//   5. records the outcome in dialects/evidence/plan-fixture-inventory.json.
// A fixture that cannot plan offline keeps its source, records why, and holds
// no plan or golden.
//
// TERRAFORM_BIN names the Terraform executable (default: terraform on PATH).
// ROOTFORM_PLAN_FIXTURE_CACHE names the provider cache directory.
// The HCP stand-in serves TLS with a throwaway certificate from openssl.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  needsAzureCli,
  needsOfflineApi,
  OFFLINE_API_HTTP_PORT,
  OFFLINE_API_HTTPS_PORT,
  offlineConfiguration,
  offlineEnvironment,
} from "./offline-providers.ts";
import {
  configuredProviders,
  discoverFixtures,
  exactVersion,
  fixtureSources,
  GOLDEN,
  type InventoryFixture,
  LOCK_FILE,
  OFFLINE_CONFIGURATION,
  PLAN_EXPORT,
  providerRequirements,
  SAVED_PLAN,
  sourceDigest,
} from "./plan-fixtures.ts";
import { readInventory, writeGoldens, writeInventory } from "./update-goldens.ts";

const rootform = join(import.meta.dir, "../..");
const dialects = join(rootform, "dialects");
const fixtures = join(dialects, "fixtures");

// Loopback stays reachable: providers pointed at 127.0.0.1:1 fail fast there.
const DARWIN_PROFILE =
  '(version 1)(allow default)(deny network-outbound (remote ip "*:*"))' +
  '(allow network-outbound (remote ip "localhost:*"))';

function sandboxed(command: string[]): string[] {
  if (process.platform === "darwin") return ["sandbox-exec", "-p", DARWIN_PROFILE, ...command];
  if (process.platform === "linux") return ["unshare", "--map-root-user", "--net", ...command];
  throw new Error("offline planning needs sandbox-exec (macOS) or unshare (Linux)");
}

function executable(name: string, configured: string | undefined): string {
  const found = configured
    ? isAbsolute(configured)
      ? configured
      : Bun.which(configured)
    : Bun.which(name);
  if (!found || !existsSync(found)) throw new Error(`${name} executable is unavailable`);
  return found;
}

type Step = { exitCode: number; stdout: string; stderr: string };

// A provider that keeps retrying an unreachable API must not stall the run.
const STEP_TIMEOUT_MS = 10 * 60 * 1000;

function step(command: string[], cwd: string, env: Record<string, string>): Step {
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
    timeout: STEP_TIMEOUT_MS,
  });
  if (result.exitedDueToTimeout) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Error: timed out after ${STEP_TIMEOUT_MS / 1000} seconds\n`,
    };
  }
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

// The first Terraform error summary, which names the failure without local
// paths; the full output stays on the maintainer's terminal.
function failureReason(stage: string, output: string): string {
  const summary = output
    .split("\n")
    .map((line) => line.replace(/^[\s│╷╵]+/u, "").trim())
    .find((line) => line.startsWith("Error: "));
  return `terraform ${stage} failed offline: ${summary ?? "no error summary"}`;
}

type Toolchain = { terraform: string; cache: string; bun: string };

function scratchEnvironment(scratch: string, toolchain: Toolchain): Record<string, string> {
  const home = join(scratch, "home");
  const bin = join(scratch, "bin");
  mkdirSync(home, { recursive: true });
  mkdirSync(bin, { recursive: true });
  const config = join(scratch, "terraformrc");
  writeFileSync(config, "");
  return {
    AWS_EC2_METADATA_DISABLED: "true",
    CHECKPOINT_DISABLE: "1",
    HOME: home,
    PATH: [bin, dirname(toolchain.terraform), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
    TF_CLI_CONFIG_FILE: config,
    TF_IN_AUTOMATION: "1",
    TF_PLUGIN_CACHE_DIR: toolchain.cache,
    TMPDIR: join(scratch, "tmp"),
  };
}

function installAzureCli(scratch: string, toolchain: Toolchain): void {
  const stand_in = join(import.meta.dir, "offline-az.ts");
  const path = join(scratch, "bin", "az");
  writeFileSync(path, `#!/bin/sh\nexec "${toolchain.bun}" "${stand_in}" "$@"\n`, { mode: 0o755 });
}

function format(terraform: string, content: string): string {
  const result = Bun.spawnSync({
    cmd: [terraform, "fmt", "-no-color", "-"],
    stdin: new TextEncoder().encode(content),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(`terraform fmt failed: ${result.stderr.toString()}`);
  return result.stdout.toString();
}

function withoutOutputs(directory: string): void {
  for (const name of [PLAN_EXPORT, SAVED_PLAN, GOLDEN]) {
    const path = join(directory, name);
    if (existsSync(path)) unlinkSync(path);
  }
}

function generate(fixture: string, toolchain: Toolchain): InventoryFixture {
  const directory = join(fixtures, fixture);
  const main = fixtureSources(directory)
    .filter((name) => name.endsWith(".tf") && name !== OFFLINE_CONFIGURATION)
    .map((name) => readFileSync(join(directory, name), "utf8"))
    .join("\n");
  const requirements = providerRequirements(main);
  const providers: Record<string, string> = {};
  for (const requirement of requirements) providers[requirement.source] = exactVersion(requirement);

  const offlinePath = join(directory, OFFLINE_CONFIGURATION);
  const offline = offlineConfiguration(requirements, configuredProviders(main));
  if (offline) writeFileSync(offlinePath, format(toolchain.terraform, offline));
  else if (existsSync(offlinePath)) unlinkSync(offlinePath);
  const digest = sourceDigest(directory);
  const notPlanned = (reason: string): InventoryFixture => {
    withoutOutputs(directory);
    return { fixture, source_sha256: digest, providers, status: "not_planned", reason };
  };

  const scratch = mkdtempSync(join(tmpdir(), "rootform-plan-fixture-"));
  try {
    const env = scratchEnvironment(scratch, toolchain);
    Object.assign(env, offlineEnvironment(requirements));
    mkdirSync(env.TMPDIR ?? join(scratch, "tmp"), { recursive: true });
    if (needsAzureCli(requirements)) installAzureCli(scratch, toolchain);
    const work = join(scratch, "work");
    mkdirSync(work);
    for (const name of fixtureSources(directory))
      copyFileSync(join(directory, name), join(work, name));
    const lock = join(directory, LOCK_FILE);
    if (existsSync(lock)) copyFileSync(lock, join(work, LOCK_FILE));

    const init = step([toolchain.terraform, "init", "-input=false", "-no-color"], work, env);
    if (init.exitCode !== 0) {
      process.stderr.write(init.stdout + init.stderr);
      return notPlanned(failureReason("init", init.stdout + init.stderr));
    }
    const recorded = readFileSync(join(work, LOCK_FILE));
    if (!existsSync(lock) || !readFileSync(lock).equals(recorded)) writeFileSync(lock, recorded);
    const plan = step(
      sandboxed([
        toolchain.terraform,
        "plan",
        "-input=false",
        "-no-color",
        "-lock=false",
        "-refresh=false",
        `-out=${SAVED_PLAN}`,
      ]),
      work,
      env,
    );
    if (plan.exitCode !== 0) {
      process.stderr.write(plan.stdout + plan.stderr);
      return notPlanned(failureReason("plan", plan.stdout + plan.stderr));
    }
    const show = step(
      sandboxed([toolchain.terraform, "show", "-json", "-no-color", SAVED_PLAN]),
      work,
      env,
    );
    if (show.exitCode !== 0) {
      process.stderr.write(show.stderr);
      return notPlanned(failureReason("show", show.stderr));
    }
    const version = step([toolchain.terraform, "version", "-json"], work, env);
    const terraformVersion = (JSON.parse(version.stdout) as { terraform_version: string })
      .terraform_version;

    writeFileSync(join(work, PLAN_EXPORT), show.stdout);
    for (const name of [PLAN_EXPORT, SAVED_PLAN]) {
      const staged = join(directory, `.${name}.tmp`);
      copyFileSync(join(work, name), staged);
      renameSync(staged, join(directory, name));
    }
    const goldens = writeGoldens(directory);
    if (goldens.total !== 1) throw new Error(`${fixture}: expected one fixture case`);
    return {
      fixture,
      source_sha256: digest,
      providers,
      status: "planned",
      terraform_version: terraformVersion,
    };
  } finally {
    rmSync(scratch, { force: true, recursive: true });
  }
}

type StandIn = { stop: () => void };

// Starts the loopback API stand-in with a throwaway TLS certificate and waits
// until it answers.
async function startOfflineApi(bun: string): Promise<StandIn> {
  const scratch = mkdtempSync(join(tmpdir(), "rootform-offline-api-"));
  const certificate = join(scratch, "certificate.pem");
  const key = join(scratch, "key.pem");
  const openssl = Bun.spawnSync({
    cmd: [
      "openssl",
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-subj",
      "/CN=127.0.0.1",
      "-days",
      "1",
      "-keyout",
      key,
      "-out",
      certificate,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (openssl.exitCode !== 0) throw new Error("openssl could not create the stand-in certificate");
  const server = Bun.spawn({
    cmd: [
      bun,
      join(import.meta.dir, "offline-api.ts"),
      String(OFFLINE_API_HTTP_PORT),
      String(OFFLINE_API_HTTPS_PORT),
      certificate,
      key,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  const stop = (): void => {
    server.kill();
    rmSync(scratch, { force: true, recursive: true });
  };
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${OFFLINE_API_HTTP_PORT}/.rootform/ready`);
      if (response.ok) return { stop };
    } catch {
      // not listening yet
    }
    await Bun.sleep(100);
  }
  stop();
  throw new Error(`the offline API stand-in did not start on port ${OFFLINE_API_HTTP_PORT}`);
}

function requirementsOf(fixture: string) {
  const directory = join(fixtures, fixture);
  return providerRequirements(
    fixtureSources(directory)
      .filter((name) => name.endsWith(".tf") && name !== OFFLINE_CONFIGURATION)
      .map((name) => readFileSync(join(directory, name), "utf8"))
      .join("\n"),
  );
}

if (import.meta.main) {
  const filters = process.argv.slice(2);
  const cache = resolve(
    process.env.ROOTFORM_PLAN_FIXTURE_CACHE ?? join(homedir(), ".cache", "rootform-plan-fixtures"),
  );
  mkdirSync(cache, { recursive: true });
  const toolchain: Toolchain = {
    terraform: executable("terraform", process.env.TERRAFORM_BIN),
    cache,
    bun: process.execPath,
  };
  const previous = readInventory()?.fixtures ?? [];
  const entries = new Map(previous.map((entry) => [entry.fixture, entry]));
  const selected = discoverFixtures(fixtures).filter(
    (fixture) => filters.length === 0 || filters.some((filter) => fixture.includes(filter)),
  );
  if (selected.length === 0) throw new Error("no fixture matches the filters");
  const standIn = selected.some((fixture) => needsOfflineApi(requirementsOf(fixture)))
    ? await startOfflineApi(toolchain.bun)
    : undefined;
  try {
    for (const fixture of selected) {
      const entry = generate(fixture, toolchain);
      entries.set(fixture, entry);
      const outcome = entry.status === "planned" ? "planned" : `not planned: ${entry.reason}`;
      console.log(`${fixture}: ${outcome}`);
    }
  } finally {
    standIn?.stop();
  }
  writeInventory([...entries.values()]);
}
