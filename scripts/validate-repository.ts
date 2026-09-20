#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BINARY_LICENSE_FILE, BINARY_LICENSE_SPDX, readBinaryLicense } from "./release/license.ts";
import { readRuntimeLicensing } from "./release/runtime-licenses.ts";

type ExportManifest = {
  format_version: string;
  source_repository: string;
  source_commit: string;
  files: Array<{ path: string; sha256: string }>;
};

type DialectLock = {
  dialects?: unknown;
  format_version?: unknown;
  excluded_owners?: unknown;
  policy_packs?: unknown;
  replacements?: unknown;
};

const root = join(import.meta.dir, "..");
const allowedTopLevel = new Set([
  ".gitattributes",
  ".github",
  ".gitignore",
  ".gitleaks.toml",
  ".trivyignore.yaml",
  "AGENTS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.txt",
  "TRADEMARKS.md",
  "biome.json",
  "bun.lock",
  "contracts",
  "dependencies",
  "docs",
  "dialects",
  "examples",
  "oci",
  "package.json",
  "policy-packs",
  "public-export.json",
  "reference",
  "schemas",
  "scripts",
  "tsconfig.json",
]);
const forbiddenTopLevel = new Set(["apps", "cmd", "internal", "packages", "specs", "web"]);
const forbiddenText =
  /(?:\/Users\/|\/home\/(?!rootform(?:\/|$))[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\|BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY|github_pat_|ghp_)/u;
const enginePathReference =
  /(?:\bpackages\/renderer\/|\bweb\/src\/|\bweb\/fixtures\/|\btestdata\/|\bprd\.md|\bdocs\/internal\/|\.ai-private|\bspecs\/[0-9]{3}-|\bdocs\/adr\/[0-9]{3}-|\bSPEC-[0-9]{3}\b|\bADR-[0-9]{3}\b)/u;

export function findEnginePathReference(body: string): string | null {
  return enginePathReference.exec(body)?.[0] ?? null;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function hasExactLine(body: string, expected: string): boolean {
  return body.split(/\r?\n/u).some((line) => line === expected);
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

export function validateExampleDialectLock(directory: string, example: string): void {
  const lock = JSON.parse(readFileSync(join(directory, "rootform.lock"), "utf8")) as DialectLock;
  if (
    lock.format_version !== "1" ||
    "entries" in lock ||
    "sources" in lock ||
    "unsupported_providers" in lock
  ) {
    throw new Error(`${example} rootform.lock has invalid structure`);
  }
  for (const key of ["dialects", "policy_packs", "excluded_owners", "replacements"] as const) {
    if (!Array.isArray(lock[key])) {
      throw new Error(`${example} rootform.lock ${key} must be an array`);
    }
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
    ".github/workflows/publish-image.yml",
    ".github/workflows/publish-policy-packs.yml",
    ".trivyignore.yaml",
    "dependencies/ROOTFORM-BINARY-LICENSE.txt",
    "contracts/binary-handoff.md",
    "contracts/dialect-distribution.md",
    "contracts/policy-pack-distribution.md",
    "contracts/rootform-oci-core-profile.md",
    "contracts/rootform-lock.md",
    "dialects/dialects.json",
    "dialects/LICENSE",
    "dialects/README.md",
    "dialects/THIRD_PARTY_NOTICES.md",
    "dialects/evidence/auth0/scenarios.json",
    "dialects/fixtures/auth0-v1/minimal/main.tf",
    "policy-packs/README.md",
    "policy-packs/baseline/LICENSE",
    "policy-packs/baseline/NOTICE",
    "policy-packs/baseline/pack.rf.hcl",
    "policy-packs/baseline/policies/cluster-network-context.rf.hcl",
    "policy-packs/baseline/policies/managed-database-network-context.rf.hcl",
    "docs/integrations/oci-image.md",
    "docs/integrations/ci/README.md",
    "docs/integrations/ci/azure-pipelines.yml",
    "docs/integrations/ci/generic-ci.sh",
    "docs/integrations/ci/github-actions.yml",
    "docs/integrations/ci/gitlab-ci.yml",
    "docs/integrations/ci/rootform-ci.sh",
    "oci/Dockerfile",
    "docs/integrations/registry-compatibility.md",
    "scripts/assemble-release.ts",
    "scripts/build-image.ts",
    "scripts/download-handoff.ts",
    "scripts/download-release.ts",
    "scripts/extract-release-binary.ts",
    "scripts/release/archive.ts",
    "scripts/release/contract.ts",
    "scripts/release/digest.ts",
    "scripts/release/handoff.ts",
    "scripts/release/license.ts",
    "scripts/release/metadata.ts",
    "scripts/release/oci.ts",
    "scripts/release/runtime-licenses.ts",
    "scripts/render-candidate-report.ts",
    "scripts/publish-image.ts",
    "scripts/qualify-registry.ts",
    "scripts/qualify-image.ts",
    "scripts/validate-oci-core-profile.ts",
    "scripts/validate-trivy-policy.ts",
    "dependencies/runtime-components.json",
    "schemas/compiled-policy-pack.schema.json",
    "schemas/rootform-lock.schema.json",
  ]) {
    if (!files.includes(required))
      throw new Error(`required repository control is missing: ${required}`);
  }
  for (const path of files) {
    if (path.endsWith(".go") || path.startsWith("specs/") || path.startsWith("docs/adr/")) {
      throw new Error(`private implementation material is forbidden: ${path}`);
    }
    if (
      ![
        "scripts/validate-repository.ts",
        "scripts/validate-repository.test.ts",
        "scripts/dialects/validate.ts",
      ].includes(path) &&
      /\.(?:json|md|tf|ts|yml|yaml)$/u.test(path)
    ) {
      const body = readFileSync(join(root, path), "utf8");
      if (forbiddenText.test(body))
        throw new Error(`private or secret-shaped text is forbidden: ${path}`);
      const reference = findEnginePathReference(body);
      if (reference)
        throw new Error(`private Engine path reference is forbidden: ${reference} in ${path}`);
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

  const exportedPaths = exported.files.map(({ path }) => path);
  const expectedExportedPaths = [
    "THIRD_PARTY_NOTICES.txt",
    "dependencies/runtime-components.json",
    "reference/cli.json",
    "schemas/architecture-ir.schema.json",
    "schemas/compiled-policy-pack.schema.json",
    "schemas/rootform-lock.schema.json",
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
  const standardExamples = [
    "aws-vpc",
    "azure-network",
    "gcp-cloud-sql",
    "kubernetes-workload",
    "multi-cloud",
  ];
  if (
    JSON.stringify(examples) !==
    JSON.stringify([...standardExamples, "playground"].sort((a, b) => a.localeCompare(b, "en")))
  ) {
    throw new Error(`example inventory mismatch: ${examples.join(", ")}`);
  }
  for (const example of standardExamples) {
    const directory = join(root, "examples", example);
    validateExampleDialectLock(directory, example);
    if (!readdirSync(directory).some((name) => name.endsWith(".tf") || name.endsWith(".tf.json"))) {
      throw new Error(`example contains no Terraform source: ${example}`);
    }
  }

  const playground = join(root, "examples", "playground");
  const playgroundScenarios = readdirSync(playground, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .sort((a, b) => a.localeCompare(b, "en"));
  if (
    JSON.stringify(playgroundScenarios) !==
    JSON.stringify(["commerce-platform", "event-driven-platform", "shared-data-platform"])
  ) {
    throw new Error(`playground scenario inventory mismatch: ${playgroundScenarios.join(", ")}`);
  }
  for (const scenario of playgroundScenarios) {
    const directory = join(playground, scenario);
    if (!existsSync(join(directory, "README.md"))) {
      throw new Error(`playground scenario has no README: ${scenario}`);
    }
    for (const side of ["base", "head"]) {
      const input = join(directory, side);
      validateExampleDialectLock(input, `playground/${scenario}/${side}`);
      if (!readdirSync(input).some((name) => name.endsWith(".tf") || name.endsWith(".tf.json"))) {
        throw new Error(`playground scenario contains no Terraform source: ${scenario}/${side}`);
      }
    }
  }

  const policyPackFiles = files
    .filter((path) => path.startsWith("policy-packs/baseline/"))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (
    JSON.stringify(policyPackFiles) !==
    JSON.stringify([
      "policy-packs/baseline/LICENSE",
      "policy-packs/baseline/NOTICE",
      "policy-packs/baseline/pack.rf.hcl",
      "policy-packs/baseline/policies/cluster-network-context.rf.hcl",
      "policy-packs/baseline/policies/managed-database-network-context.rf.hcl",
    ])
  ) {
    throw new Error(`policy pack example boundary drifted: ${policyPackFiles.join(", ")}`);
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
  const candidateArtifactName =
    "name: rootform-candidate-$" + "{{ inputs.version }}-$" + "{{ github.sha }}";
  if (
    candidateWorkflow.includes("rootform-dev/engine") ||
    candidateWorkflow.includes("rootform-dev/action/") ||
    candidateWorkflow.includes("ROOTFORM_REPOSITORIES_READ_TOKEN") ||
    !candidateWorkflow.includes("packages: write") ||
    !candidateWorkflow.includes("test:oci-registry-compatibility") ||
    !candidateWorkflow.includes("rootform-oci-core-v1") ||
    !candidateWorkflow.includes("Require qualification package to start public or absent") ||
    !candidateWorkflow.includes("Require qualification package to remain public") ||
    (candidateWorkflow.match(/= public/gmu)?.length ?? 0) !== 2 ||
    candidateWorkflow.includes("private GHCR") ||
    !candidateWorkflow.includes(
      "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
    ) ||
    candidateWorkflow.split(candidateArtifactName).length !== 3 ||
    !candidateWorkflow.includes('server="$(cat)"') ||
    candidateWorkflow.includes("IFS= read -r server")
  ) {
    throw new Error("candidate workflow violates distribution ownership");
  }
  const imageWorkflow = readFileSync(
    join(root, ".github", "workflows", "publish-image.yml"),
    "utf8",
  );
  if (
    imageWorkflow.includes("rootform-dev/engine") ||
    imageWorkflow.includes("rootform-dev/action/") ||
    !imageWorkflow.includes("packages: write") ||
    !imageWorkflow.includes("name: publish official image") ||
    !imageWorkflow.includes("Verify exact public release source") ||
    !imageWorkflow.includes("Require existing official GHCR package to be public") ||
    !imageWorkflow.includes("Verify published official GHCR package remains public") ||
    (imageWorkflow.match(/= public/gmu)?.length ?? 0) !== 3 ||
    imageWorkflow.includes("= private") ||
    imageWorkflow.includes("ghcr.io/rootform-dev/rootform:latest") ||
    imageWorkflow.includes("PATCH /orgs/rootform-dev/packages")
  ) {
    throw new Error("image publication workflow violates distribution ownership");
  }
  const policyPackWorkflow = readFileSync(
    join(root, ".github", "workflows", "publish-policy-packs.yml"),
    "utf8",
  );
  const policyPackSettingsLine =
    "              'https://github.com/orgs/rootform-dev/packages/container/policy-packs/settings' >&2";
  if (
    policyPackWorkflow.includes("rootform-dev/engine") ||
    policyPackWorkflow.includes("rootform-dev/action/") ||
    policyPackWorkflow.includes("ROOTFORM_REPOSITORIES_READ_TOKEN") ||
    !policyPackWorkflow.includes("packages: write") ||
    !policyPackWorkflow.includes("name: publish example policy packs") ||
    !policyPackWorkflow.includes("Require public package visibility") ||
    !hasExactLine(policyPackWorkflow, policyPackSettingsLine) ||
    !policyPackWorkflow.includes("Verify anonymous tag and digest pulls") ||
    !policyPackWorkflow.includes(".content.schemaVersion == 2") ||
    !policyPackWorkflow.includes(
      '.content.artifactType == "application/vnd.rootform.policy-pack.v1"',
    ) ||
    !policyPackWorkflow.includes("application/vnd.rootform.policy-pack.manifest.v1+json") ||
    !policyPackWorkflow.includes("application/vnd.rootform.policy-pack.layer.v1.tar+gzip") ||
    policyPackWorkflow.includes("\n              .schemaVersion == 2") ||
    policyPackWorkflow.includes("\n              .artifactType ==")
  ) {
    throw new Error("Policy Pack publication workflow violates distribution ownership");
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
