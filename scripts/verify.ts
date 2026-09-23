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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const root = join(import.meta.dir, "..");
const examples = [
  "aws-vpc",
  "azure-network",
  "gcp-cloud-sql",
  "kubernetes-workload",
  "multi-cloud",
];

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function digest(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${label} must be an exact SHA-256 digest`);
  }
}

function positiveInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function projectLock(directory: string): Buffer {
  const path = join(directory, "rootform.lock");
  const body = readFileSync(path);
  const lock = object(JSON.parse(body.toString("utf8")) as unknown, "rootform.lock");
  if (lock.format_version !== "1") throw new Error("rootform.lock format_version drifted");
  for (const obsolete of ["entries", "sources", "unsupported_providers", "index"]) {
    if (obsolete in lock) {
      throw new Error(`rootform.lock still uses obsolete field ${obsolete}`);
    }
  }
  for (const key of ["dialects", "policy_packs", "excluded_owners", "replacements"] as const) {
    if (!Array.isArray(lock[key])) {
      throw new Error(`rootform.lock ${key} must be an array`);
    }
  }
  if (
    (lock.dialects as unknown[]).length !== 0 ||
    (lock.policy_packs as unknown[]).length !== 0 ||
    (lock.excluded_owners as unknown[]).length !== 0 ||
    (lock.replacements as unknown[]).length !== 0
  ) {
    throw new Error("supplied examples must use an empty project selection");
  }
  return body;
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

function policyPackPinFromLayout(layout: string): { contentDigest: string } {
  const index = object(
    JSON.parse(readFileSync(join(layout, "index.json"), "utf8")) as unknown,
    "Policy Pack OCI index",
  );
  if (!Array.isArray(index.manifests) || index.manifests.length !== 1) {
    throw new Error("Policy Pack OCI index must contain one manifest");
  }
  const descriptor = object(index.manifests[0], "Policy Pack OCI descriptor");
  if (descriptor.artifactType !== "application/vnd.rootform.policy-pack.v1") {
    throw new Error("Policy Pack OCI descriptor artifact type drifted");
  }
  digest(descriptor.digest, "Policy Pack OCI manifest digest");
  positiveInteger(descriptor.size, "Policy Pack OCI manifest size");
  const annotations = object(descriptor.annotations, "Policy Pack OCI annotations");
  const tag = annotations["org.opencontainers.image.ref.name"];
  if (tag !== "policy-pack-baseline-0.1.0") {
    throw new Error("Policy Pack OCI tag drifted");
  }
  const manifestPath = join(layout, "blobs", "sha256", descriptor.digest.slice(7));
  if (lstatSync(manifestPath).size !== descriptor.size) {
    throw new Error("Policy Pack OCI manifest size does not match its descriptor");
  }
  const manifest = object(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    "Policy Pack OCI manifest",
  );
  if (
    manifest.artifactType !== "application/vnd.rootform.policy-pack.v1" ||
    !Array.isArray(manifest.layers) ||
    manifest.layers.length !== 1
  ) {
    throw new Error("Policy Pack OCI manifest shape drifted");
  }
  const configDescriptor = object(manifest.config, "Policy Pack OCI config descriptor");
  if (configDescriptor.mediaType !== "application/vnd.rootform.policy-pack.manifest.v1+json") {
    throw new Error("Policy Pack OCI config media type drifted");
  }
  digest(configDescriptor.digest, "Policy Pack OCI config digest");
  const config = object(
    JSON.parse(
      readFileSync(join(layout, "blobs", "sha256", configDescriptor.digest.slice(7)), "utf8"),
    ) as unknown,
    "Policy Pack OCI config",
  );
  const layer = object(manifest.layers[0], "Policy Pack OCI layer descriptor");
  if (layer.mediaType !== "application/vnd.rootform.policy-pack.layer.v1.tar+gzip") {
    throw new Error("Policy Pack OCI layer media type drifted");
  }
  digest(layer.digest, "Policy Pack OCI layer digest");
  positiveInteger(layer.size, "Policy Pack OCI layer size");
  digest(config.policy_pack_digest, "Policy Pack content digest");
  digest(config.layer_digest, "Policy Pack config layer digest");
  positiveInteger(config.download_size, "Policy Pack download size");
  positiveInteger(config.install_size, "Policy Pack install size");
  if (
    config.format_version !== "1" ||
    config.name !== "baseline" ||
    config.version !== "0.1.0" ||
    config.layer_digest !== layer.digest ||
    config.download_size !== layer.size
  ) {
    throw new Error("Policy Pack OCI config drifted from its exact package");
  }
  return {
    contentDigest: config.policy_pack_digest,
  };
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

process.stdout.write(run(["bun", "run", "verify:dialects"], root, { ROOTFORM_BIN: binary }));

function runLockedBuildJourney(
  project: string,
  environment: Record<string, string>,
  offline: boolean,
): { architecture: Buffer; init: Buffer } {
  const initFlags = ["--locked", "--no-input", "--format", "json"];
  if (offline) initFlags.push("--offline");
  return {
    init: run([binary, "init", project, ...initFlags], root, environment),
    architecture: run(
      [binary, "build", project, "--locked", "--format", "json"],
      root,
      environment,
    ),
  };
}

process.stdout.write(run(["bun", "run", "verify:docs-examples"], root, { ROOTFORM_BIN: binary }));

const registryHome = mkdtempSync(join(tmpdir(), "rootform-registry-home-"));
const outputs = mkdtempSync(join(tmpdir(), "rootform-examples-"));
const environment = { ROOTFORM_HOME: registryHome };
const locks = new Map(
  examples.map((example) => {
    const directory = join(root, "examples", example);
    return [example, projectLock(directory)] as const;
  }),
);

const registryExample = "aws-vpc";
const registryDirectory = join(root, "examples", registryExample);
const registryLock = locks.get(registryExample);
if (!registryLock) throw new Error("registry example lock is unavailable");
const onlineJourney = runLockedBuildJourney(registryDirectory, environment, false);
if (!readFileSync(join(registryDirectory, "rootform.lock")).equals(registryLock)) {
  throw new Error("init --locked changed the versioned example lock");
}
if (existsSync(join(registryHome, "dialects", "aws"))) {
  throw new Error("supplied Dialects must never materialize in the store");
}

const offlineJourney = runLockedBuildJourney(registryDirectory, environment, true);
for (const name of ["init", "architecture"] as const) {
  if (!onlineJourney[name].equals(offlineJourney[name])) {
    throw new Error(`locked build journey is not deterministic: ${name}`);
  }
}
if (!readFileSync(join(registryDirectory, "rootform.lock")).equals(registryLock)) {
  throw new Error("offline init --locked changed the versioned example lock");
}

const policyPack = join(root, "policy-packs", "baseline");
const policyLayoutFirst = join(outputs, "policy-pack-first");
const policyLayoutSecond = join(outputs, "policy-pack-second");
const policyRepository = "registry.example/rootform/policy-packs";
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
    policyRepository,
    "--dry-run",
    "--format",
    "json",
  ],
  root,
  environment,
);
run([binary, "list", "policy-packs", "--policy-pack", policyPack, "--format", "json"]);
run([binary, "show", "policy-pack", "baseline", "--policy-pack", policyPack, "--format", "json"]);

const policyPin = policyPackPinFromLayout(policyLayoutFirst);
const policyCIProject = join(outputs, "policy-backed-ci-project");
cpSync(join(root, "examples", "playground", "shared-data-platform", "base"), policyCIProject, {
  recursive: true,
});
const localPolicyPack = join(policyCIProject, "policy-packs", "baseline");
mkdirSync(join(policyCIProject, "policy-packs"), { recursive: true });
cpSync(policyPack, localPolicyPack, { recursive: true });
const policyCILockPath = join(policyCIProject, "rootform.lock");
const policyCILock = object(
  JSON.parse(readFileSync(policyCILockPath, "utf8")) as unknown,
  "Policy-backed CI rootform.lock",
);
if (
  policyCILock.format_version !== "1" ||
  !Array.isArray(policyCILock.dialects) ||
  !Array.isArray(policyCILock.policy_packs) ||
  !Array.isArray(policyCILock.excluded_owners) ||
  !Array.isArray(policyCILock.replacements) ||
  policyCILock.dialects.length !== 0 ||
  policyCILock.policy_packs.length !== 0 ||
  policyCILock.excluded_owners.length !== 0 ||
  policyCILock.replacements.length !== 0
) {
  throw new Error("Policy-backed CI base lock shape drifted");
}
policyCILock.policy_packs = [
  {
    name: "baseline",
    version: "0.1.0",
    content_digest: policyPin.contentDigest,
    source: { local: { path: "policy-packs/baseline" } },
  },
];
writeFileSync(policyCILockPath, `${JSON.stringify(policyCILock, null, 2)}\n`);
const policyCILockBody = readFileSync(policyCILockPath);
const policyCIOutput = join(outputs, "policy-backed-ci-output");
run(["sh", join(root, "docs", "integrations", "ci", "rootform-ci.sh")], root, {
  ROOTFORM_BIN: binary,
  ROOTFORM_HOME: mkdtempSync(join(tmpdir(), "rootform-policy-ci-home-")),
  ROOTFORM_OFFLINE: "1",
  ROOTFORM_CHECK: "1",
  ROOTFORM_OUTPUT_DIR: policyCIOutput,
  ROOTFORM_PROJECT: policyCIProject,
});
if (!readFileSync(policyCILockPath).equals(policyCILockBody)) {
  throw new Error("policy-backed CI journey changed its exact lock");
}
const policyCIResult = object(
  JSON.parse(readFileSync(join(policyCIOutput, "check.json"), "utf8")) as unknown,
  "policy-backed CI check",
);
const policyCISummary = object(policyCIResult.summary, "policy-backed CI check summary");
if (
  policyCIResult.status !== "compliant" ||
  policyCIResult.compliant !== true ||
  policyCISummary.policies !== 2 ||
  policyCISummary.evaluations !== 2 ||
  policyCISummary.passed !== 2 ||
  policyCISummary.violated !== 0 ||
  policyCISummary.indeterminate !== 0 ||
  policyCISummary.not_evaluated !== 0 ||
  !Array.isArray(policyCIResult.diagnostics) ||
  policyCIResult.diagnostics.length !== 0
) {
  throw new Error("policy-backed CI check did not produce exact compliant coverage");
}
if (!Array.isArray(policyCIResult.policy_packs) || policyCIResult.policy_packs.length !== 1) {
  throw new Error("policy-backed CI check did not report one Policy Pack");
}
const policyCIResultPack = object(policyCIResult.policy_packs[0], "policy-backed CI Policy Pack");
if (
  policyCIResultPack.id !== "baseline" ||
  policyCIResultPack.version !== "0.1.0" ||
  policyCIResultPack.content_digest !== policyPin.contentDigest
) {
  throw new Error("policy-backed CI check drifted from packaged baseline identity");
}

for (const example of examples) {
  const directory = join(root, "examples", example);
  const lock = locks.get(example);
  if (!lock) throw new Error(`example lock is unavailable: ${example}`);
  const firstPath = join(outputs, `${example}-first.json`);
  const secondPath = join(outputs, `${example}-second.json`);
  const firstBuild = [binary, "build", ".", "--locked", "--format", "json", "--output", firstPath];
  run(firstBuild, directory, environment);
  run(
    [binary, "build", ".", "--locked", "--format", "json", "--output", secondPath],
    directory,
    environment,
  );
  if (!readFileSync(firstPath).equals(readFileSync(secondPath))) {
    throw new Error(`example is nondeterministic: ${example}`);
  }
  if (!readFileSync(join(directory, "rootform.lock")).equals(lock)) {
    throw new Error(`locked example changed its lock: ${example}`);
  }
  const architecture = object(
    JSON.parse(readFileSync(firstPath, "utf8")) as unknown,
    `${example} Architecture IR`,
  );
  const represented = object(architecture.architecture, `${example} architecture`).representations;
  if (architecture.format_version !== "0.1.0" || !Array.isArray(represented)) {
    throw new Error(`example did not produce current Architecture IR: ${example}`);
  }
}

console.log("Distribution verification passed.");
