#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BINARY_LICENSE_FILE, BINARY_LICENSE_SPDX, readBinaryLicense } from "./release/license.ts";
import { readRuntimeLicensing } from "./release/runtime-licenses.ts";

type ExportManifest = {
  format_version: string;
  source_repository: string;
  source_commit: string;
  files: Array<{ path: string; sha256: string }>;
};

type ExampleContract = {
  dialects?: unknown;
};

type DialectLock = {
  entries?: unknown;
  format_version?: unknown;
};

type DialectPin = {
  commit?: unknown;
  format_version?: unknown;
  repository?: unknown;
};

const root = join(import.meta.dir, "..");
const allowedTopLevel = new Set([
  ".gitattributes",
  ".github",
  ".gitignore",
  ".gitleaks.toml",
  "AGENTS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "LICENSES",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.txt",
  "TRADEMARKS.md",
  "biome.json",
  "bun.lock",
  "contracts",
  "dependencies",
  "docs",
  "examples",
  "package.json",
  "public-export.json",
  "schemas",
  "scripts",
  "tsconfig.json",
]);
const forbiddenTopLevel = new Set([
  "apps",
  "cmd",
  "dialects",
  "internal",
  "packages",
  "specs",
  "web",
]);
const forbiddenText =
  /(?:\/Users\/|\/home\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\|BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY|github_pat_|ghp_)/u;

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function filesBelow(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    if ([".git", "artifacts", "build", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    const name = relative(root, path).replaceAll("\\", "/");
    if (entry.isSymbolicLink()) throw new Error(`symbolic link is forbidden: ${name}`);
    if (entry.isDirectory()) files.push(...filesBelow(path));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`irregular filesystem entry is forbidden: ${name}`);
  }
  return files;
}

function canonicalNames(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((name) => typeof name !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(name))
  ) {
    throw new Error(`${label} has invalid dialect names`);
  }
  const names = value as string[];
  const canonical = [...new Set(names)].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(names) !== JSON.stringify(canonical)) {
    throw new Error(`${label} dialect names are not canonical`);
  }
  return names;
}

export function validateExampleDialectLock(directory: string, example: string): void {
  const contract = JSON.parse(
    readFileSync(join(directory, "example.json"), "utf8"),
  ) as ExampleContract;
  const lock = JSON.parse(readFileSync(join(directory, "rootform.lock"), "utf8")) as DialectLock;
  const expected = canonicalNames(contract.dialects, `${example} example.json`);
  if (lock.format_version !== "1" || !Array.isArray(lock.entries)) {
    throw new Error(`${example} rootform.lock has invalid structure`);
  }
  const locked = canonicalNames(
    lock.entries.map((entry) =>
      typeof entry === "object" && entry !== null && "name" in entry ? entry.name : undefined,
    ),
    `${example} rootform.lock`,
  );
  if (JSON.stringify(expected) !== JSON.stringify(locked)) {
    throw new Error(`${example} dialect contract does not match rootform.lock`);
  }
}

export function validateRepository(): void {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if ([".git", "artifacts", "build", "node_modules"].includes(entry.name)) continue;
    if (!allowedTopLevel.has(entry.name))
      throw new Error(`unexpected top-level path: ${entry.name}`);
    if (forbiddenTopLevel.has(entry.name))
      throw new Error(`proprietary source boundary violated: ${entry.name}`);
  }

  const files = filesBelow(root);
  for (const required of [
    ".github/CODEOWNERS",
    ".github/dependabot.yml",
    ".github/pull_request_template.md",
    ".github/workflows/candidate.yml",
    ".github/workflows/ci.yml",
    "contracts/binary-handoff.md",
    "dependencies/dialects.json",
    "scripts/assemble-release.ts",
    "scripts/download-handoff.ts",
    "scripts/extract-release-binary.ts",
    "scripts/release/archive.ts",
    "scripts/release/contract.ts",
    "scripts/release/digest.ts",
    "scripts/release/handoff.ts",
    "scripts/release/license.ts",
    "scripts/release/metadata.ts",
    "scripts/release/runtime-licenses.ts",
    "dependencies/runtime-components.json",
  ]) {
    if (!files.includes(required))
      throw new Error(`required repository control is missing: ${required}`);
  }
  for (const path of files) {
    if (path.endsWith(".go") || path.startsWith("specs/") || path.startsWith("docs/adr/")) {
      throw new Error(`private implementation material is forbidden: ${path}`);
    }
    if (path !== "scripts/validate-repository.ts" && /\.(?:json|md|tf|ts|yml|yaml)$/u.test(path)) {
      const body = readFileSync(join(root, path), "utf8");
      if (forbiddenText.test(body))
        throw new Error(`private or secret-shaped text is forbidden: ${path}`);
    }
    if (path.endsWith(".json") || path.endsWith("/rootform.lock")) {
      JSON.parse(readFileSync(join(root, path), "utf8"));
    }
  }

  const exported = JSON.parse(
    readFileSync(join(root, "public-export.json"), "utf8"),
  ) as ExportManifest;
  if (
    exported.format_version !== "1" ||
    exported.source_repository !== "rootform-dev/engine" ||
    !/^[0-9a-f]{40}$/u.test(exported.source_commit)
  ) {
    throw new Error("public-export.json has invalid provenance");
  }

  const dialectPin = JSON.parse(
    readFileSync(join(root, "dependencies", "dialects.json"), "utf8"),
  ) as DialectPin;
  if (
    dialectPin.format_version !== "1" ||
    dialectPin.repository !== "rootform-dev/dialects" ||
    typeof dialectPin.commit !== "string" ||
    !/^[0-9a-f]{40}$/u.test(dialectPin.commit)
  ) {
    throw new Error("dependencies/dialects.json must pin one exact official commit");
  }
  const exportedPaths = exported.files.map(({ path }) => path);
  const expectedExportedPaths = [
    "THIRD_PARTY_NOTICES.txt",
    "dependencies/runtime-components.json",
    "schemas/architecture-ir.schema.json",
  ].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(exportedPaths) !== JSON.stringify(expectedExportedPaths)) {
    throw new Error("public export allow-list changed");
  }
  for (const file of exported.files) {
    if (!/^[0-9a-f]{64}$/u.test(file.sha256) || sha256(join(root, file.path)) !== file.sha256) {
      throw new Error(`exported file digest mismatch: ${file.path}`);
    }
  }

  const examples = readdirSync(join(root, "examples"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .sort((a, b) => a.localeCompare(b, "en"));
  if (
    JSON.stringify(examples) !==
    JSON.stringify([
      "aws-vpc",
      "azure-network",
      "gcp-cloud-sql",
      "kubernetes-workload",
      "multi-cloud",
    ])
  ) {
    throw new Error(`example inventory mismatch: ${examples.join(", ")}`);
  }
  for (const example of examples) {
    const directory = join(root, "examples", example);
    validateExampleDialectLock(directory, example);
    if (!readdirSync(directory).some((name) => name.endsWith(".tf") || name.endsWith(".tf.json"))) {
      throw new Error(`example contains no Terraform source: ${example}`);
    }
  }

  readBinaryLicense(root);
  readRuntimeLicensing(root);
  const readme = readFileSync(join(root, "README.md"), "utf8");
  if (!readme.includes(BINARY_LICENSE_SPDX) || !readme.includes(BINARY_LICENSE_FILE)) {
    throw new Error("README binary licensing boundary drifted");
  }
  const candidateWorkflow = readFileSync(
    join(root, ".github", "workflows", "candidate.yml"),
    "utf8",
  );
  if (
    candidateWorkflow.includes("rootform-dev/engine") ||
    candidateWorkflow.includes("rootform-dev/action/") ||
    candidateWorkflow.includes("ROOTFORM_REPOSITORIES_READ_TOKEN") ||
    !candidateWorkflow.includes("DIALECTS_CONTENTS_READ_TOKEN") ||
    !candidateWorkflow.includes(dialectPin.commit)
  ) {
    throw new Error("candidate workflow violates distribution ownership");
  }
}

if (import.meta.main) {
  try {
    validateRepository();
    console.log("Distribution repository structure is valid.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
