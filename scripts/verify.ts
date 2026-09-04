#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const root = join(import.meta.dir, "..");
const officialIndex = "ghcr.io/rootform-dev/dialects:official-index-v1";
const examples = [
  "aws-vpc",
  "azure-network",
  "gcp-cloud-sql",
  "kubernetes-workload",
  "multi-cloud",
];

type PinnedDialect = {
  name: string;
  version: string;
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function digest(value: unknown, label: string): void {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${label} must be an exact SHA-256 digest`);
  }
}

function pinnedRegistryLock(directory: string): {
  body: Buffer;
  entries: PinnedDialect[];
} {
  const path = join(directory, "rootform.lock");
  const body = readFileSync(path);
  const lock = object(JSON.parse(body.toString("utf8")) as unknown, "rootform.lock");
  if (lock.format_version !== "1") throw new Error("rootform.lock format_version drifted");
  if (!Array.isArray(lock.sources) || lock.sources.length !== 1) {
    throw new Error("rootform.lock must contain one exact registry source");
  }
  const source = object(lock.sources[0], "rootform.lock source");
  if (source.kind !== "index" || source.reference !== officialIndex) {
    throw new Error("rootform.lock source is not the official registry index");
  }
  digest(source.manifest_digest, "rootform.lock source manifest_digest");
  if (!Array.isArray(lock.entries) || lock.entries.length === 0) {
    throw new Error("rootform.lock entries are empty");
  }
  const entries = lock.entries.map((value, index) => {
    const entry = object(value, `rootform.lock entry ${index}`);
    if (typeof entry.name !== "string" || typeof entry.version !== "string") {
      throw new Error(`rootform.lock entry ${index} has invalid identity`);
    }
    digest(entry.digest, `rootform.lock entry ${index} digest`);
    digest(entry.presentation_digest, `rootform.lock entry ${index} presentation_digest`);
    const artifact = object(entry.artifact, `rootform.lock entry ${index} artifact`);
    if (artifact.repository !== "ghcr.io/rootform-dev/dialects") {
      throw new Error(`rootform.lock entry ${index} repository drifted`);
    }
    digest(artifact.manifest_digest, `rootform.lock entry ${index} manifest_digest`);
    digest(artifact.layer_digest, `rootform.lock entry ${index} layer_digest`);
    for (const size of ["download_size", "install_size"]) {
      if (!Number.isSafeInteger(artifact[size]) || Number(artifact[size]) < 1) {
        throw new Error(`rootform.lock entry ${index} ${size} is invalid`);
      }
    }
    if (
      !Array.isArray(entry.origins) ||
      entry.origins.length !== 1 ||
      entry.origins[0] !== officialIndex
    ) {
      throw new Error(`rootform.lock entry ${index} origins drifted`);
    }
    return { name: entry.name, version: entry.version };
  });
  return { body, entries };
}

function requireInstalledMarkers(home: string, entries: PinnedDialect[]): void {
  for (const entry of entries) {
    const marker = join(home, "dialects", entry.name, entry.version, ".rootform-artifact.json");
    if (!existsSync(marker)) {
      throw new Error(`registry journey omitted artifact marker: ${entry.name}@${entry.version}`);
    }
  }
}

function treeDigest(directory: string, current = directory): string {
  const digest = createHash("sha256");
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  )) {
    const path = join(current, entry.name);
    const name = path.slice(directory.length + 1).replaceAll("\\", "/");
    const status = lstatSync(path);
    if (status.isSymbolicLink()) throw new Error(`verification tree contains symlink: ${name}`);
    if (entry.isDirectory()) {
      digest.update(`directory\0${name}\0${treeDigest(directory, path)}\0`);
      continue;
    }
    if (!entry.isFile()) throw new Error(`verification tree contains irregular file: ${name}`);
    digest.update(`file\0${name}\0${status.size}\0`);
    digest.update(readFileSync(path));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function run(command: string[], cwd = root, environment: Record<string, string> = {}): Buffer {
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command.join(" ")} exited ${result.exitCode}`);
  }
  return result.stdout;
}

run(["bun", "run", "check"]);

const configuredBinary = process.env.ROOTFORM_BIN;
if (!configuredBinary)
  throw new Error("ROOTFORM_BIN must name the checksum-verified Rootform executable");
const binary = isAbsolute(configuredBinary) ? configuredBinary : resolve(root, configuredBinary);
if (!existsSync(binary)) throw new Error("binary is unavailable");

const registryHome = mkdtempSync(join(tmpdir(), "rootform-registry-home-"));
const outputs = mkdtempSync(join(tmpdir(), "rootform-examples-"));
const environment = { ROOTFORM_HOME: registryHome };
const locks = new Map(
  examples.map((example) => {
    const directory = join(root, "examples", example);
    return [example, pinnedRegistryLock(directory)] as const;
  }),
);

const registryExample = "aws-vpc";
const registryDirectory = join(root, "examples", registryExample);
const registryLock = locks.get(registryExample);
if (!registryLock) throw new Error("registry example lock is unavailable");
const integrationScript = join(root, "docs", "integrations", "ci", "rootform-ci.sh");
const onlineOutput = join(outputs, "registry-ci-online");
run(["sh", integrationScript], root, {
  ROOTFORM_BIN: binary,
  ROOTFORM_HOME: registryHome,
  ROOTFORM_OFFLINE: "0",
  ROOTFORM_OUTPUT_DIR: onlineOutput,
  ROOTFORM_PROJECT: registryDirectory,
});
if (!readFileSync(join(registryDirectory, "rootform.lock")).equals(registryLock.body)) {
  throw new Error("registry init --locked changed the versioned example lock");
}
requireInstalledMarkers(registryHome, registryLock.entries);

const offlineOutput = join(outputs, "registry-ci-offline");
run(["sh", integrationScript], root, {
  ROOTFORM_BIN: binary,
  ROOTFORM_HOME: registryHome,
  ROOTFORM_OFFLINE: "1",
  ROOTFORM_OUTPUT_DIR: offlineOutput,
  ROOTFORM_PROJECT: registryDirectory,
});
for (const name of ["init.json", "architecture.json", "check.json"]) {
  if (!readFileSync(join(onlineOutput, name)).equals(readFileSync(join(offlineOutput, name)))) {
    throw new Error(`documented CI journey is not deterministic: ${name}`);
  }
}
if (!readFileSync(join(registryDirectory, "rootform.lock")).equals(registryLock.body)) {
  throw new Error("offline init --locked changed the versioned example lock");
}

const policyPack = join(root, "policy-packs", "baseline");
const policyLayoutFirst = join(outputs, "policy-pack-first");
const policyLayoutSecond = join(outputs, "policy-pack-second");
const revision = run(["git", "rev-parse", "HEAD"]).toString("utf8").trim();
if (!/^[0-9a-f]{40}$/u.test(revision)) throw new Error("repository revision is not exact");
const provenance = [
  "--source-url",
  "https://github.com/rootform-dev/rootform",
  "--revision",
  revision,
  "--documentation-url",
  `https://github.com/rootform-dev/rootform/blob/${revision}/policy-packs/README.md`,
  "--licenses",
  "Apache-2.0",
];
for (const layout of [policyLayoutFirst, policyLayoutSecond]) {
  run(
    [binary, "package", "policy-packs", policyPack, "--to", layout, ...provenance],
    root,
    environment,
  );
}
if (treeDigest(policyLayoutFirst) !== treeDigest(policyLayoutSecond)) {
  throw new Error("policy pack OCI layout is nondeterministic");
}
run(
  [
    binary,
    "publish",
    "policy-packs",
    policyLayoutFirst,
    "--to",
    "registry.example/rootform/policy-packs",
    "--dry-run",
    "--format",
    "json",
  ],
  root,
  environment,
);
run([binary, "list", "policy-packs", "--policy-pack", policyPack, "--format", "json"]);
run([binary, "show", "policy-pack", "baseline", "--policy-pack", policyPack, "--format", "json"]);

for (const example of examples) {
  const directory = join(root, "examples", example);
  const lock = locks.get(example);
  if (!lock) throw new Error(`example lock is unavailable: ${example}`);
  const firstPath = join(outputs, `${example}-first.json`);
  const secondPath = join(outputs, `${example}-second.json`);
  const htmlPath = join(outputs, `${example}.html`);
  run(
    [binary, "build", ".", "--locked", "--no-input", "--format", "json", "--output", firstPath],
    directory,
    environment,
  );
  requireInstalledMarkers(registryHome, lock.entries);
  run(
    [
      binary,
      "build",
      ".",
      "--locked",
      "--offline",
      "--no-input",
      "--format",
      "json",
      "--output",
      secondPath,
    ],
    directory,
    environment,
  );
  if (!readFileSync(firstPath).equals(readFileSync(secondPath))) {
    throw new Error(`example is nondeterministic: ${example}`);
  }
  if (!readFileSync(join(directory, "rootform.lock")).equals(lock.body)) {
    throw new Error(`locked example changed its lock: ${example}`);
  }
  run([binary, "check", firstPath, "--format", "json"], directory, environment);
  run(
    [
      binary,
      "build",
      ".",
      "--locked",
      "--offline",
      "--no-input",
      "--format",
      "html",
      "--output",
      htmlPath,
    ],
    directory,
    environment,
  );
  const html = readFileSync(htmlPath, "utf8");
  if (!html.toLowerCase().includes("<!doctype html") || /(?:src|href)=["']https?:/iu.test(html)) {
    throw new Error(`HTML export is not self-contained: ${example}`);
  }
}

console.log("Distribution verification passed.");
