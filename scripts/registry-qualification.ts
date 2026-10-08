#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { createReadStream, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { normalizeVersion } from "./release/contract.ts";

const COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const OCI_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const MAX_PROOF_BYTES = 64 * 1024;

// These are the fields emitted by qualify-registry.ts, not additional claims.
const CAPABILITIES = [
  "custom_media_types",
  "docker_credential_helper",
  "locked_empty_store",
  "offline_vendor_execution",
  "policy_pack_locked_empty_store",
  "policy_pack_offline_vendor_execution",
  "policy_pack_pull_by_digest",
  "policy_pack_vendor_exact_repair",
  "policy_pack_vendor_exclusive",
  "publish",
  "publish_idempotent",
  "pull_by_digest",
  "vendor_exact_repair",
  "vendor_exclusive",
] as const;

const REQUIRED_CAPABILITIES = [
  "docker_credential_helper",
  "locked_empty_store",
  "offline_vendor_execution",
  "policy_pack_locked_empty_store",
  "policy_pack_offline_vendor_execution",
  "policy_pack_pull_by_digest",
  "policy_pack_vendor_exact_repair",
  "policy_pack_vendor_exclusive",
  "pull_by_digest",
] as const;

type ArtifactResult = {
  content_digest: string;
  layer_digest: string;
  manifest_digest: string;
  tag: string;
  version: string;
};

export type RegistryResult = {
  artifact: ArtifactResult & {
    owner: string;
    presentation_digest: string;
    semantic_digest: string;
  };
  capabilities: Record<(typeof CAPABILITIES)[number], boolean>;
  format_version: "1";
  policy_pack: ArtifactResult & { name: string };
  profile: "rootform-oci-core-v1";
  provenance: { documentation: string; licenses: string; revision: string; source: string };
  repository: string;
};

export type RegistryProofExpectation = {
  version: string;
  rootform_commit: string;
  binary_sha256: string;
  candidate_release_id: number;
  engine_commit: string;
};

export type RegistryProof = Omit<RegistryProofExpectation, "engine_commit"> & {
  format_version: "1";
  executor_repository: "rootform-dev/engine";
  executor_commit: string;
  executor_run_id: number;
  package: { id: number; name: string; type: "container"; visibility: "private" };
  result: RegistryResult;
};

type JsonObject = Record<string, unknown>;

function exactObject(value: unknown, keys: readonly string[], label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`${label} fields differ from the registry proof schema`);
  }
  return value as JsonObject;
}

function equal(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) throw new Error(`${label} differs from the required identity`);
}

function positiveInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function pattern(value: unknown, expression: RegExp, label: string): asserts value is string {
  if (typeof value !== "string" || !expression.test(value)) {
    throw new Error(`${label} has an invalid format`);
  }
}

function version(value: unknown, label: string): asserts value is string {
  try {
    if (typeof value === "string" && value.length <= 128 && normalizeVersion(value) === value) {
      return;
    }
  } catch {
    // Diagnostics identify the field, never the supplied value.
  }
  throw new Error(`${label} must be an exact release version`);
}

function httpsURL(value: unknown, label: string): void {
  if (typeof value === "string" && value.length <= 2048) {
    try {
      const parsed = new URL(value);
      if (
        parsed.protocol === "https:" &&
        parsed.username === "" &&
        parsed.password === "" &&
        parsed.search === "" &&
        parsed.hash === "" &&
        parsed.toString() === value
      ) {
        return;
      }
    } catch {
      // Preserve the same credential-free URL boundary as qualify-registry.ts.
    }
  }
  throw new Error(`${label} must be a canonical HTTPS URL`);
}

function verifyArtifact(value: unknown, kind: "artifact" | "policy_pack"): void {
  const identity = kind === "artifact" ? "owner" : "name";
  const keys = ["content_digest", "layer_digest", "manifest_digest", identity, "tag", "version"];
  if (kind === "artifact") keys.push("presentation_digest", "semantic_digest");
  const artifact = exactObject(value, keys, `registry result.${kind}`);
  for (const field of keys.filter((key) => key.endsWith("_digest"))) {
    pattern(artifact[field], OCI_DIGEST, `registry result.${kind}.${field}`);
  }
  const name = artifact[identity];
  pattern(name, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u, `registry result.${kind}.${identity}`);
  if (name.length > 128)
    throw new Error(`registry result.${kind}.${identity} exceeds 128 characters`);
  version(artifact.version, `registry result.${kind}.version`);
  const prefix = kind === "artifact" ? "dialect" : "policy-pack";
  equal(
    artifact.tag,
    `${prefix}-${artifact[identity]}-${artifact.version}`,
    `registry result.${kind}.tag`,
  );
}

function verifyResult(value: unknown, repository: string, revision: string): void {
  const result = exactObject(
    value,
    [
      "artifact",
      "capabilities",
      "format_version",
      "policy_pack",
      "profile",
      "provenance",
      "repository",
    ],
    "registry result",
  );
  equal(result.format_version, "1", "registry result.format_version");
  equal(result.profile, "rootform-oci-core-v1", "registry result.profile");
  equal(result.repository, repository, "registry result.repository");
  const capabilities = exactObject(
    result.capabilities,
    CAPABILITIES,
    "registry result.capabilities",
  );
  for (const name of CAPABILITIES) {
    if (typeof capabilities[name] !== "boolean") {
      throw new Error(`registry result.capabilities.${name} must be a boolean`);
    }
  }
  for (const name of REQUIRED_CAPABILITIES) {
    if (capabilities[name] !== true) {
      throw new Error(`registry result.capabilities.${name} did not pass`);
    }
  }
  const provenance = exactObject(
    result.provenance,
    ["documentation", "licenses", "revision", "source"],
    "registry result.provenance",
  );
  equal(provenance.revision, revision, "registry result.provenance.revision");
  httpsURL(provenance.source, "registry result.provenance.source");
  httpsURL(provenance.documentation, "registry result.provenance.documentation");
  equal(
    provenance.source,
    "https://github.com/rootform-dev/rootform",
    "registry result.provenance.source",
  );
  equal(
    provenance.documentation,
    `https://github.com/rootform-dev/rootform/blob/${revision}/contracts/rootform-oci-core-profile.md`,
    "registry result.provenance.documentation",
  );
  pattern(
    provenance.licenses,
    /^[A-Za-z0-9][A-Za-z0-9 .()+-]{0,255}$/u,
    "registry result.provenance.licenses",
  );
  verifyArtifact(result.artifact, "artifact");
  verifyArtifact(result.policy_pack, "policy_pack");
}

// Authentication of the downloaded proof belongs to its caller. This verifies
// the opaque receipt against the exact candidate and executor identities.
export function verifyRegistryProof(
  value: unknown,
  expected: RegistryProofExpectation,
): RegistryProof {
  version(expected.version, "expected version");
  pattern(expected.rootform_commit, COMMIT, "expected rootform_commit");
  pattern(expected.engine_commit, COMMIT, "expected engine_commit");
  pattern(expected.binary_sha256, SHA256, "expected binary_sha256");
  positiveInteger(expected.candidate_release_id, "expected candidate_release_id");

  const proof = exactObject(
    value,
    [
      "format_version",
      "version",
      "rootform_commit",
      "binary_sha256",
      "candidate_release_id",
      "executor_repository",
      "executor_commit",
      "executor_run_id",
      "package",
      "result",
    ],
    "registry proof",
  );
  equal(proof.format_version, "1", "registry proof.format_version");
  for (const field of [
    "version",
    "rootform_commit",
    "binary_sha256",
    "candidate_release_id",
  ] as const) {
    equal(proof[field], expected[field], `registry proof.${field}`);
  }
  equal(proof.executor_repository, "rootform-dev/engine", "registry proof.executor_repository");
  equal(proof.executor_commit, expected.engine_commit, "registry proof.executor_commit");
  positiveInteger(proof.executor_run_id, "registry proof.executor_run_id");
  const package_ = exactObject(
    proof.package,
    ["id", "name", "type", "visibility"],
    "registry proof.package",
  );
  positiveInteger(package_.id, "registry proof.package.id");
  equal(package_.type, "container", "registry proof.package.type");
  equal(package_.visibility, "private", "registry proof.package.visibility");
  const name = `rootform-oci-qualification-${proof.executor_run_id}`;
  equal(package_.name, name, "registry proof.package.name");
  verifyResult(proof.result, `ghcr.io/rootform-dev/${name}`, expected.rootform_commit);
  return structuredClone(proof) as RegistryProof;
}

export type RegistryProofArguments = Omit<RegistryProofExpectation, "binary_sha256"> & {
  binary: string;
  evidence: string;
  proof: string;
};

export function parseRegistryProofArguments(
  arguments_: string[],
  cwd = process.cwd(),
): RegistryProofArguments {
  const names = [
    "proof",
    "version",
    "rootform-commit",
    "binary",
    "candidate-release-id",
    "engine-commit",
    "evidence",
  ];
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    const name = names.find(
      (name) => argument === `--${name}` || argument.startsWith(`--${name}=`),
    );
    if (!name) throw new Error("unknown registry proof argument");
    if (values.has(name)) throw new Error(`duplicate registry proof argument: --${name}`);
    const value = argument.startsWith(`--${name}=`)
      ? argument.slice(name.length + 3)
      : arguments_[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  for (const name of names) {
    if (!values.has(name)) throw new Error(`--${name} is required`);
  }
  const requestedVersion = values.get("version");
  version(requestedVersion, "--version");
  const rootformCommit = values.get("rootform-commit");
  pattern(rootformCommit, COMMIT, "--rootform-commit");
  const engineCommit = values.get("engine-commit");
  pattern(engineCommit, COMMIT, "--engine-commit");
  const release = values.get("candidate-release-id");
  pattern(release, /^[1-9][0-9]*$/u, "--candidate-release-id");
  const candidateReleaseId = Number(release);
  positiveInteger(candidateReleaseId, "--candidate-release-id");
  return {
    binary: resolve(cwd, values.get("binary") as string),
    candidate_release_id: candidateReleaseId,
    engine_commit: engineCommit,
    evidence: resolve(cwd, values.get("evidence") as string),
    proof: resolve(cwd, values.get("proof") as string),
    rootform_commit: rootformCommit,
    version: requestedVersion,
  };
}

function fileSize(path: string, label: string): number {
  let status: ReturnType<typeof lstatSync>;
  try {
    status = lstatSync(path);
  } catch {
    throw new Error(`${label} is missing or unreadable`);
  }
  if (!status.isFile() || status.isSymbolicLink() || status.size < 1) {
    throw new Error(`${label} must be a non-empty regular file`);
  }
  return status.size;
}

export async function verifyRegistryProofFile(
  options: RegistryProofArguments,
): Promise<RegistryProof> {
  if (fileSize(options.proof, "registry proof file") > MAX_PROOF_BYTES) {
    throw new Error("registry proof file exceeds 64 KiB");
  }
  let value: unknown;
  try {
    const body = readFileSync(options.proof);
    if (body.length > MAX_PROOF_BYTES) throw new Error();
    value = JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error("registry proof file could not be read as bounded JSON");
  }
  fileSize(options.binary, "registry binary");
  const hash = createHash("sha256");
  try {
    for await (const chunk of createReadStream(options.binary)) hash.update(chunk);
  } catch {
    throw new Error("registry binary could not be read");
  }
  const proof = verifyRegistryProof(value, { ...options, binary_sha256: hash.digest("hex") });
  try {
    mkdirSync(dirname(options.evidence), { recursive: true });
    writeFileSync(options.evidence, `${JSON.stringify(proof, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
  } catch {
    throw new Error("registry proof evidence could not be created exclusively");
  }
  return proof;
}

if (import.meta.main) {
  try {
    await verifyRegistryProofFile(parseRegistryProofArguments(process.argv.slice(2)));
    console.log("Registry qualification proof verified.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "registry proof verification failed");
    process.exitCode = 1;
  }
}
