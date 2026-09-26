#!/usr/bin/env bun

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { normalizeVersion } from "./release/contract.ts";

export type TargetLabel =
  | "linux-amd64"
  | "linux-arm64"
  | "macos-amd64"
  | "macos-arm64"
  | "windows-amd64";

export const TARGET_LABELS: readonly TargetLabel[] = [
  "linux-amd64",
  "linux-arm64",
  "macos-amd64",
  "macos-arm64",
  "windows-amd64",
];

export type Host = { arch: string; platform: NodeJS.Platform };

const TARGET_HOSTS: Readonly<Record<TargetLabel, Host>> = {
  "linux-amd64": { arch: "x64", platform: "linux" },
  "linux-arm64": { arch: "arm64", platform: "linux" },
  "macos-amd64": { arch: "x64", platform: "darwin" },
  "macos-arm64": { arch: "arm64", platform: "darwin" },
  "windows-amd64": { arch: "x64", platform: "win32" },
};

export type JourneyStep = { detail?: string; name: string; ok: boolean };

export type JourneyEvidence = {
  binary: string;
  run_sha256: string | null;
  lock_absence_preserved: boolean;
  lock_unchanged: boolean;
  empty_vendor_rejected: boolean;
  offline_inspection_no_credentials: boolean;
  online_offline_identical: boolean;
  passed: boolean;
  local_policy_pack_inspection: boolean;
  steps: JourneyStep[];
  supplied_dialects_not_installed: boolean;
  supplied_release_set_offline: boolean;
  target: TargetLabel;
  version: string | null;
};

export type RuntimeArguments = {
  binary: string;
  evidence?: string;
  target: TargetLabel;
  version: string;
};

export function targetHost(target: TargetLabel): Host {
  return TARGET_HOSTS[target];
}

export function assertTargetMatchesHost(
  target: TargetLabel,
  platform = process.platform,
  arch: string = process.arch,
): void {
  const host = targetHost(target);
  if (host.platform !== platform || host.arch !== arch) {
    throw new Error(`target ${target} cannot run on ${platform}/${arch}`);
  }
}

type Redaction = { path: string; placeholder: string };

export function redact(text: string, redactions: readonly Redaction[]): string {
  let result = text;
  for (const entry of [...redactions].sort((left, right) => right.path.length - left.path.length)) {
    result = result.replaceAll(entry.path, entry.placeholder);
  }
  return result;
}

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

export function parseArguments(arguments_: string[], cwd = process.cwd()): RuntimeArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    const name = ["binary", "evidence", "target", "version"].find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown platform runtime argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate platform runtime argument: --${name}`);
    const inline = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++index];
    if (!inline || inline.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, inline);
  }
  const binary = values.get("binary");
  if (!binary) throw new Error("--binary is required");
  const targetValue = values.get("target");
  if (!targetValue) throw new Error("--target is required");
  const target = TARGET_LABELS.find((label) => label === targetValue);
  if (!target) throw new Error(`unsupported platform runtime target: ${targetValue}`);
  const version = values.get("version");
  if (!version) throw new Error("--version is required");
  const evidence = values.get("evidence");
  return {
    binary: absolute(binary, cwd),
    evidence: evidence === undefined ? undefined : absolute(evidence, cwd),
    target,
    version: normalizeVersion(version),
  };
}

export function requireRegularFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`);
  }
  if (status.size < 1) throw new Error(`${label} has zero size`);
}

export class JourneyError extends Error {
  constructor(
    readonly step: string,
    message: string,
  ) {
    super(message);
    this.name = "JourneyError";
  }
}

type SpawnOutcome = { exitCode: number; stderr: string; stdout: string };

export function runBinaryStatus(
  binary: string,
  arguments_: string[],
  options: { cwd: string; environment: Record<string, string>; redactions: readonly Redaction[] },
): SpawnOutcome {
  const result = Bun.spawnSync({
    cmd: [binary, ...arguments_],
    cwd: options.cwd,
    env: { ...process.env, ...options.environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  const stdout = redact(result.stdout.toString("utf8"), options.redactions);
  const stderr = redact(result.stderr.toString("utf8"), options.redactions);
  return { exitCode: result.exitCode, stderr, stdout };
}

export function runBinary(
  binary: string,
  arguments_: string[],
  options: { cwd: string; environment: Record<string, string>; redactions: readonly Redaction[] },
): Omit<SpawnOutcome, "exitCode"> {
  const result = runBinaryStatus(binary, arguments_, options);
  if (result.exitCode !== 0) {
    const { exitCode, stderr, stdout } = result;
    const suffix = stderr.trim() === "" ? stdout.trim() : stderr.trim();
    throw new Error(
      `rootform ${arguments_[0] ?? "(command)"} failed (exit ${String(exitCode)}): ${suffix}`,
    );
  }
  return { stderr: result.stderr, stdout: result.stdout };
}

export async function readRunAddress(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const read = async (): Promise<string> => {
    let received = "";
    while (true) {
      const next = await reader.read();
      if (next.value) received += decoder.decode(next.value, { stream: true });
      if (received.length > 65_536) {
        throw new Error("rootform run output exceeded the loopback address probe limit");
      }
      for (const match of received.matchAll(/http:\/\/127\.0\.0\.1:(\d{1,5})(?=[/\s]|$)/gu)) {
        const port = Number(match[1]);
        if (port >= 1 && port <= 65_535) return match[0];
      }
      if (next.done) throw new Error("rootform run stopped before publishing a loopback address");
    }
  };
  return Promise.race([
    read(),
    Bun.sleep(15_000).then(() => {
      throw new Error("rootform run did not publish a loopback address");
    }),
  ]);
}

export async function probeRun(
  binary: string,
  arguments_: string[],
  options: { cwd: string; environment: Record<string, string>; redactions: readonly Redaction[] },
): Promise<string> {
  const server = Bun.spawn([binary, ...arguments_], {
    cwd: options.cwd,
    env: { ...process.env, ...options.environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  try {
    if (!(server.stdout instanceof ReadableStream)) {
      throw new Error("rootform run stdout is unavailable");
    }
    const address = await readRunAddress(server.stdout);
    const response = await fetch(address, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const html = await response.text();
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("text/html") ||
      !html.toLowerCase().includes("<!doctype html>")
    ) {
      throw new Error("rootform run did not serve its self-contained HTML shell");
    }
    return address;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(redact(detail, options.redactions));
  } finally {
    if (server.exitCode === null) server.kill();
    await server.exited;
  }
}

export function treeDigest(directory: string): string {
  const digest = createHash("sha256");
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  )) {
    const path = join(directory, entry.name);
    const name = path.slice(directory.length + 1).replaceAll("\\", "/");
    const status = lstatSync(path);
    if (status.isSymbolicLink()) throw new Error(`verification tree contains symlink: ${name}`);
    if (entry.isDirectory()) {
      digest.update(`directory\0${name}\0${treeDigest(path)}\0`);
      continue;
    }
    if (!entry.isFile()) throw new Error(`verification tree contains irregular file: ${name}`);
    digest.update(`file\0${name}\0${status.size}\0`);
    digest.update(readFileSync(path));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function digest(body: Buffer | string): string {
  return createHash("sha256").update(body).digest("hex");
}

function lockBody(project: string): Buffer {
  return readFileSync(join(project, "rootform.lock"));
}

function lockSelections(project: string): void {
  const lock = JSON.parse(lockBody(project).toString("utf8")) as Record<string, unknown>;
  if (lock.format_version !== "1") throw new Error("rootform.lock format_version drifted");
  for (const obsolete of ["entries", "sources", "unsupported_providers", "index"]) {
    if (obsolete in lock) throw new Error(`rootform.lock uses obsolete field ${obsolete}`);
  }
  for (const key of ["dialects", "policy_packs", "excluded_owners", "replacements"]) {
    if (!Array.isArray(lock[key])) {
      throw new Error(`rootform.lock ${key} must be an array`);
    }
  }
  if (Array.isArray(lock.dialects) && lock.dialects.length !== 0) {
    throw new Error("supplied example locks must not select Dialects");
  }
}

function currentHost(): Host {
  return { arch: process.arch, platform: process.platform };
}

export async function runJourney(
  arguments_: RuntimeArguments,
  steps: JourneyStep[] = [],
  host: Host = currentHost(),
): Promise<JourneyEvidence> {
  let activeRedactions: readonly Redaction[] = [];
  const record = (name: string, detail?: string): void => {
    steps.push(detail === undefined ? { name, ok: true } : { detail, name, ok: true });
  };
  const failed = (step: string, error: unknown): never => {
    const raw = error instanceof Error ? error.message : String(error);
    const message = redact(raw, activeRedactions);
    steps.push({ detail: message, name: step, ok: false });
    throw new JourneyError(step, message);
  };
  const attempt = <T>(step: string, action: () => T, detail?: (result: T) => string): T => {
    try {
      const result = action();
      record(step, detail?.(result));
      return result;
    } catch (error) {
      return failed(step, error);
    }
  };
  attempt("target-matches-host", () =>
    assertTargetMatchesHost(arguments_.target, host.platform, host.arch),
  );
  attempt("binary-is-regular-file", () => requireRegularFile(arguments_.binary, "rootform binary"));
  let runSha = "";
  let onlineRun = "";
  let version: string | null = null;
  let sandbox: string | undefined;

  try {
    sandbox = mkdtempSync(join(tmpdir(), "rootform-platform-runtime-"));
    const project = join(sandbox, "project with spaces");
    const home = join(sandbox, "home with spaces");
    const freshHome = join(sandbox, "fresh home");
    const outputs = join(sandbox, "outputs");
    const root = join(import.meta.dir, "..");
    const example = join(root, "examples", "playground", "shared-data-platform", "base");
    const registryConfig = join(sandbox, "registry docker config");
    const invalidDockerConfig = join(sandbox, "invalid docker config");
    const invalidCa = join(sandbox, "invalid-ca.pem");
    const redactions: Redaction[] = [
      { path: arguments_.binary, placeholder: "<rootform-binary>" },
      { path: dirname(arguments_.binary), placeholder: "<binary-directory>" },
      { path: project, placeholder: "<project>" },
      { path: home, placeholder: "<home>" },
      { path: freshHome, placeholder: "<fresh-home>" },
      { path: root, placeholder: "<distribution>" },
      { path: sandbox, placeholder: "<sandbox>" },
    ];
    activeRedactions = redactions;
    const run = (command: string[], cwd: string, environment: Record<string, string>) =>
      runBinary(arguments_.binary, command, { cwd, environment, redactions });
    const runPlan = (cwd: string, environment: Record<string, string>, output?: string) =>
      run(
        [
          "run",
          join(project, "plan.json"),
          "--project",
          project,
          "--plan-file",
          join(project, "plan.tfplan"),
          "--require-enrichment",
          "--locked",
          "--no-serve",
          ...(output ? ["-o", output] : ["--format", "json"]),
        ],
        cwd,
        environment,
      );

    attempt("sandbox-preparation", () => {
      mkdirSync(outputs);
      mkdirSync(freshHome);
      mkdirSync(registryConfig);
      mkdirSync(invalidDockerConfig);
      writeFileSync(join(registryConfig, "config.json"), "{}\n");
      writeFileSync(join(invalidDockerConfig, "config.json"), "not-json{{{\n");
      writeFileSync(invalidCa, "not a pem bundle\n");
      cpSync(example, project, { recursive: true });
      if (!lockBody(project).equals(lockBody(example))) {
        throw new Error("copied playground lock differs from versioned lock");
      }
      lockSelections(project);
    });
    const expectedLock = lockBody(example);
    const onlineEnvironment = {
      DOCKER_CONFIG: registryConfig,
      ROOTFORM_HOME: home,
      ROOTFORM_OFFLINE: "0",
      SSL_CERT_FILE: "",
    };
    const offlineEnvironment = {
      ALL_PROXY: "http://rootform-proxy-sentinel.invalid:9",
      DOCKER_CONFIG: invalidDockerConfig,
      HTTP_PROXY: "http://rootform-proxy-sentinel.invalid:9",
      HTTPS_PROXY: "http://rootform-proxy-sentinel.invalid:9",
      NO_PROXY: "",
      ROOTFORM_HOME: home,
      ROOTFORM_OFFLINE: "1",
      SSL_CERT_FILE: invalidCa,
      all_proxy: "http://rootform-proxy-sentinel.invalid:9",
      http_proxy: "http://rootform-proxy-sentinel.invalid:9",
      https_proxy: "http://rootform-proxy-sentinel.invalid:9",
      no_proxy: "",
    };

    version = attempt(
      "version",
      () => {
        const probe = run(["version"], project, onlineEnvironment);
        const banner = probe.stdout.trim();
        if (banner !== `rootform ${arguments_.version}`) {
          throw new Error(`rootform version output differs: ${banner}`);
        }
        return arguments_.version;
      },
      (reported) => reported,
    );

    attempt("init-without-lock-preserves-absence", () => {
      const noLockProject = join(sandbox as string, "project without lock");
      cpSync(project, noLockProject, { recursive: true });
      rmSync(join(noLockProject, "rootform.lock"));
      run(
        ["init", noLockProject, "--no-input", "--format", "json"],
        noLockProject,
        onlineEnvironment,
      );
      if (existsSync(join(noLockProject, "rootform.lock"))) {
        throw new Error("init created rootform.lock for an empty selection");
      }
    });

    attempt("init-locked-preserves-lock", () => {
      run(
        ["init", project, "--locked", "--no-input", "--format", "json"],
        project,
        onlineEnvironment,
      );
      if (!lockBody(project).equals(expectedLock)) {
        throw new Error("init --locked changed rootform.lock");
      }
    });

    const onlineDocument = join(outputs, "run-online.json");
    attempt(
      "run-online-locked",
      () => {
        runPlan(project, onlineEnvironment, onlineDocument);
        const document = JSON.parse(readFileSync(onlineDocument, "utf8")) as {
          format_version?: string;
          kind?: string;
        };
        if (document.format_version !== "1" || document.kind !== "plan")
          throw new Error("run did not produce a format-1 plan");
        return digest(readFileSync(onlineDocument));
      },
      (sha) => `sha256:${sha}`,
    );

    runSha = attempt(
      "run-stdout-online-locked",
      () => {
        onlineRun = runPlan(project, onlineEnvironment).stdout;
        if (onlineRun !== readFileSync(onlineDocument, "utf8"))
          throw new Error("stdout document differs from file document");
        return digest(onlineRun);
      },
      (sha) => `sha256:${sha}`,
    );

    attempt("policy-without-target-exits-3", () => {
      const outcome = runBinaryStatus(
        arguments_.binary,
        [
          "run",
          join(root, "scripts", "fixtures", "portable-plan.json"),
          "--project",
          project,
          "--policy-pack",
          join(root, "policy-packs", "baseline"),
          "--no-serve",
          "--format",
          "json",
        ],
        { cwd: project, environment: onlineEnvironment, redactions },
      );
      if (outcome.exitCode !== 3 || !outcome.stderr.includes("POLICY_NO_DECISION")) {
        throw new Error(`policy without target exited ${outcome.exitCode}: ${outcome.stderr}`);
      }
      const document = JSON.parse(outcome.stdout) as { format_version?: string; kind?: string };
      if (document.format_version !== "1" || document.kind !== "plan") {
        throw new Error("undecided policy did not return a format-1 plan");
      }
    });

    attempt("supplied-dialects-never-install", () => {
      if (existsSync(join(home, "dialects")))
        throw new Error("supplied Dialects installed before offline init");
      run(
        ["init", project, "--locked", "--offline", "--no-input", "--format", "json"],
        project,
        offlineEnvironment,
      );
      if (existsSync(join(home, "dialects"))) {
        throw new Error("supplied Dialects must never materialize in the store");
      }
      if (!lockBody(project).equals(expectedLock)) {
        throw new Error("offline init --locked changed the lock");
      }
    });

    const vendorDirectory = join(project, ".rootform", "dialects");
    attempt("empty-dialect-vendor-rejected", () => {
      const outcome = Bun.spawnSync({
        cmd: [arguments_.binary, "vendor", "dialects", "--offline"],
        cwd: project,
        env: { ...process.env, ...offlineEnvironment },
        stderr: "pipe",
        stdout: "pipe",
      });
      if (outcome.exitCode !== 3) {
        const output = redact(
          `${outcome.stdout.toString("utf8")}\n${outcome.stderr.toString("utf8")}`,
          redactions,
        );
        throw new Error(`empty Dialect vendor exit ${outcome.exitCode}: ${output.trim()}`);
      }
      if (existsSync(vendorDirectory)) {
        throw new Error("vendor created a supplied-Dialect tree");
      }
    });

    const offlineDocument = join(outputs, "run-offline.json");
    attempt(
      "offline-run-without-credentials",
      () => {
        runPlan(
          project,
          {
            ...offlineEnvironment,
            ROOTFORM_HOME: freshHome,
          },
          offlineDocument,
        );
        if (!readFileSync(onlineDocument).equals(readFileSync(offlineDocument))) {
          throw new Error("offline run output differs from supplied release-set output");
        }
        if (!lockBody(project).equals(expectedLock)) {
          throw new Error("offline --locked run changed the lock");
        }
        return digest(readFileSync(offlineDocument));
      },
      (sha) => `sha256:${sha}`,
    );

    attempt("offline-run-stdout-without-credentials", () => {
      const outcome = runPlan(project, {
        ...offlineEnvironment,
        ROOTFORM_HOME: freshHome,
      });
      if (outcome.stdout !== onlineRun) {
        throw new Error("offline run output differs from supplied release-set output");
      }
      if (existsSync(join(freshHome, "dialects"))) {
        throw new Error("offline run installed supplied Dialects");
      }
    });

    attempt("offline-list-show-without-credentials", () => {
      const environment = {
        ...offlineEnvironment,
        ROOTFORM_HOME: freshHome,
      };
      const listed = JSON.parse(
        run(["list", "dialects", "--format", "json"], project, environment).stdout,
      ) as { name?: unknown; origin?: unknown; version?: unknown }[];
      const names = listed.map((entry) => String(entry.name ?? ""));
      if (!names.includes("aws") || names.includes("core")) {
        throw new Error("effective Dialect catalog lost AWS or retained legacy core");
      }
      for (const entry of listed) {
        if (typeof entry.name !== "string" || typeof entry.version !== "string") {
          throw new Error("dialect listing lost name or version");
        }
        if (entry.origin !== "supplied") {
          throw new Error("supplied Dialect listing has another origin");
        }
      }
      const shown = JSON.parse(
        run(["show", "aws", "--format", "json"], project, environment).stdout,
      ) as { name?: unknown; origin?: unknown; version?: unknown };
      if (shown.name !== "aws" || shown.origin !== "supplied") {
        throw new Error("embedded supplied Dialect inspection drifted");
      }
    });

    attempt("local-policy-pack-list-show", () => {
      const policyPack = join(root, "policy-packs", "baseline");
      const environment = {
        ...offlineEnvironment,
        ROOTFORM_HOME: freshHome,
      };
      const listed = JSON.parse(
        run(
          ["list", "policy-packs", "--policy-pack", policyPack, "--format", "json"],
          project,
          environment,
        ).stdout,
      ) as { name?: unknown; version?: unknown }[];
      if (listed.length !== 1 || listed[0]?.name !== "baseline" || listed[0]?.version !== "0.1.0") {
        throw new Error("local Policy Pack listing differs from the versioned baseline pack");
      }
      const shown = JSON.parse(
        run(
          ["show", "policy-pack", "baseline", "--policy-pack", policyPack, "--format", "json"],
          project,
          environment,
        ).stdout,
      ) as {
        name?: unknown;
        policies?: unknown;
        version?: unknown;
      };
      if (
        shown.name !== "baseline" ||
        shown.version !== "0.1.0" ||
        !Array.isArray(shown.policies) ||
        shown.policies.length !== 2
      ) {
        throw new Error("local Policy Pack inspection differs from the versioned baseline pack");
      }
    });
  } catch (error) {
    if (error instanceof JourneyError) throw error;
    const raw = error instanceof Error ? error.message : String(error);
    const message = redact(raw, activeRedactions);
    steps.push({ detail: message, name: "journey", ok: false });
    throw new JourneyError("journey", message);
  } finally {
    if (sandbox !== undefined) {
      const cleanupPath = sandbox;
      attempt("sandbox-cleanup", () => rmSync(cleanupPath, { force: true, recursive: true }));
    }
  }

  return {
    binary: basename(arguments_.binary),
    run_sha256: runSha,
    lock_absence_preserved: true,
    lock_unchanged: true,
    empty_vendor_rejected: true,
    offline_inspection_no_credentials: true,
    online_offline_identical: true,
    passed: true,
    local_policy_pack_inspection: true,
    steps,
    supplied_dialects_not_installed: true,
    supplied_release_set_offline: true,
    target: arguments_.target,
    version,
  };
}

function writeEvidence(arguments_: RuntimeArguments, evidence: JourneyEvidence): void {
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  process.stdout.write(body);
  if (arguments_.evidence) {
    mkdirSync(dirname(arguments_.evidence), { recursive: true });
    writeFileSync(arguments_.evidence, body, { flag: "wx" });
  }
}

async function main(): Promise<void> {
  let parsed: RuntimeArguments;
  try {
    parsed = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `invalid platform runtime arguments: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return;
  }
  const steps: JourneyStep[] = [];
  let evidence: JourneyEvidence;
  try {
    evidence = await runJourney(parsed, steps);
  } catch (error) {
    evidence = {
      binary: basename(parsed.binary),
      run_sha256: null,
      lock_absence_preserved: false,
      lock_unchanged: false,
      empty_vendor_rejected: false,
      offline_inspection_no_credentials: false,
      online_offline_identical: false,
      passed: false,
      local_policy_pack_inspection: false,
      steps,
      supplied_dialects_not_installed: false,
      supplied_release_set_offline: false,
      target: parsed.target,
      version: null,
    };
    process.stderr.write(
      `platform runtime verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
  writeEvidence(parsed, evidence);
  if (!evidence.passed) process.exitCode = 1;
}

if (import.meta.main) {
  await main();
}
