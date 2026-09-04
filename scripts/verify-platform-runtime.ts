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
  check_sha256: string | null;
  lock_recreated_byte_identical: boolean;
  lock_unchanged: boolean;
  offline_from_vendor_no_credentials: boolean;
  online_offline_identical: boolean;
  passed: boolean;
  steps: JourneyStep[];
  target: TargetLabel;
  vendor_swap_removed_stale: boolean;
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

type SpawnOutcome = { stderr: string; stdout: string };

export function runBinary(
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
  const exitCode = result.exitCode;
  if (exitCode !== 0) {
    const suffix = stderr.trim() === "" ? stdout.trim() : stderr.trim();
    throw new Error(
      `rootform ${arguments_[0] ?? "(command)"} failed (exit ${String(exitCode)}): ${suffix}`,
    );
  }
  return { stderr, stdout };
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

function lockEntries(project: string): { name: string; version: string }[] {
  const lock = JSON.parse(lockBody(project).toString("utf8")) as { entries?: unknown };
  if (!Array.isArray(lock.entries)) throw new Error("rootform.lock has no entries array");
  return lock.entries.map((entry, index) => {
    const value = entry as { name?: unknown; version?: unknown };
    if (typeof value.name !== "string" || typeof value.version !== "string") {
      throw new Error(`rootform.lock entry ${index} has invalid identity`);
    }
    return { name: value.name, version: value.version };
  });
}

function requireStoreMarkers(home: string, entries: { name: string; version: string }[]): void {
  for (const entry of entries) {
    const marker = join(home, "dialects", entry.name, entry.version, ".rootform-artifact.json");
    if (!existsSync(marker)) {
      throw new Error(`store artifact marker is missing: ${entry.name}@${entry.version}`);
    }
  }
}

function currentHost(): Host {
  return { arch: process.arch, platform: process.platform };
}

export function runJourney(
  arguments_: RuntimeArguments,
  steps: JourneyStep[] = [],
  host: Host = currentHost(),
): JourneyEvidence {
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
  let checkSha = "";
  let onlineCheck = "";
  let version: string | null = null;
  let sandbox: string | undefined;

  try {
    sandbox = mkdtempSync(join(tmpdir(), "rootform-platform-runtime-"));
    const project = join(sandbox, "project with spaces");
    const home = join(sandbox, "home with spaces");
    const freshHome = join(sandbox, "fresh home");
    const outputs = join(sandbox, "outputs");
    const root = join(import.meta.dir, "..");
    const example = join(root, "examples", "aws-vpc");
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

    const entries = attempt("sandbox-preparation", () => {
      mkdirSync(outputs);
      mkdirSync(freshHome);
      mkdirSync(registryConfig);
      mkdirSync(invalidDockerConfig);
      writeFileSync(join(registryConfig, "config.json"), "{}\n");
      writeFileSync(join(invalidDockerConfig, "config.json"), "not-json{{{\n");
      writeFileSync(invalidCa, "not a pem bundle\n");
      cpSync(example, project, { recursive: true });
      if (!lockBody(project).equals(lockBody(example))) {
        throw new Error("copied example lock differs from versioned aws-vpc lock");
      }
      return lockEntries(project);
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

    attempt(
      "init-registry-recreates-lock",
      () => {
        rmSync(join(project, "rootform.lock"));
        const outcome = run(
          ["init", project, "--no-input", "--format", "json"],
          project,
          onlineEnvironment,
        );
        if (!lockBody(project).equals(expectedLock)) {
          throw new Error("registry init did not recreate the exact versioned lock bytes");
        }
        return digest(outcome.stdout);
      },
      (sha) => `init stdout sha256:${sha}`,
    );

    attempt("init-locked-preserves-lock", () => {
      run(
        ["init", project, "--locked", "--no-input", "--format", "json"],
        project,
        onlineEnvironment,
      );
      if (!lockBody(project).equals(expectedLock)) {
        throw new Error("init --locked changed the recreated lock");
      }
    });

    const onlineBuild = join(outputs, "build-online.json");
    attempt(
      "build-online-locked",
      () => {
        run(
          ["build", project, "--locked", "--no-input", "--format", "json", "--output", onlineBuild],
          project,
          onlineEnvironment,
        );
        return digest(readFileSync(onlineBuild));
      },
      (sha) => `sha256:${sha}`,
    );

    checkSha = attempt(
      "check-online-locked",
      () => {
        const outcome = run(
          ["check", project, "--locked", "--no-input", "--format", "json"],
          project,
          onlineEnvironment,
        );
        onlineCheck = outcome.stdout;
        return digest(onlineCheck);
      },
      (sha) => `sha256:${sha}`,
    );

    attempt("store-removed-cache-restores", () => {
      rmSync(join(home, "dialects"), { force: true, recursive: true });
      run(
        ["init", project, "--locked", "--offline", "--no-input", "--format", "json"],
        project,
        offlineEnvironment,
      );
      requireStoreMarkers(home, entries);
      if (!lockBody(project).equals(expectedLock)) {
        throw new Error("cache-restored init --locked changed the lock");
      }
    });

    const vendorDirectory = join(project, ".rootform", "dialects");
    const vendorDigest = attempt(
      "vendor-dialects-offline",
      () => {
        run(["vendor", "dialects", "--offline"], project, offlineEnvironment);
        for (const entry of entries) {
          const installed = join(vendorDirectory, entry.name);
          if (!existsSync(installed) || !lstatSync(installed).isDirectory()) {
            throw new Error(`vendored dialect is missing: ${entry.name}`);
          }
        }
        return treeDigest(vendorDirectory);
      },
      (digestValue) => `tree sha256:${digestValue}`,
    );

    const stale = join(vendorDirectory, "stale.injected");
    attempt("vendor-swap-removes-stale", () => {
      writeFileSync(stale, "stale injected content\n");
      run(["vendor", "dialects", "--offline"], project, offlineEnvironment);
      if (existsSync(stale)) throw new Error("vendor did not remove the injected stale file");
      if (treeDigest(vendorDirectory) !== vendorDigest) {
        throw new Error("revendored tree differs from the original vendored tree");
      }
    });

    const offlineBuild = join(outputs, "build-offline.json");
    attempt(
      "offline-build-without-credentials",
      () => {
        run(
          [
            "build",
            project,
            "--locked",
            "--offline",
            "--no-input",
            "--format",
            "json",
            "--output",
            offlineBuild,
          ],
          project,
          {
            ...offlineEnvironment,
            ROOTFORM_HOME: freshHome,
          },
        );
        if (!readFileSync(onlineBuild).equals(readFileSync(offlineBuild))) {
          throw new Error("offline build output differs from the registry-backed build output");
        }
        if (!lockBody(project).equals(expectedLock)) {
          throw new Error("offline --locked build changed the lock");
        }
        return digest(readFileSync(offlineBuild));
      },
      (sha) => `sha256:${sha}`,
    );

    attempt("offline-check-without-credentials", () => {
      const outcome = run(
        ["check", project, "--locked", "--offline", "--no-input", "--format", "json"],
        project,
        {
          ...offlineEnvironment,
          ROOTFORM_HOME: freshHome,
        },
      );
      if (outcome.stdout !== onlineCheck) {
        throw new Error("offline check output differs from the registry-backed check output");
      }
      if (readdirSync(freshHome).length !== 0) {
        throw new Error("vendored offline commands mutated the empty Rootform home");
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
    check_sha256: checkSha,
    lock_recreated_byte_identical: true,
    lock_unchanged: true,
    offline_from_vendor_no_credentials: true,
    online_offline_identical: true,
    passed: true,
    steps,
    target: arguments_.target,
    vendor_swap_removed_stale: true,
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

function main(): void {
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
    evidence = runJourney(parsed, steps);
  } catch (error) {
    evidence = {
      binary: basename(parsed.binary),
      check_sha256: null,
      lock_recreated_byte_identical: false,
      lock_unchanged: false,
      offline_from_vendor_no_credentials: false,
      online_offline_identical: false,
      passed: false,
      steps,
      target: parsed.target,
      vendor_swap_removed_stale: false,
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
  main();
}
