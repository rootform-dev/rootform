#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

type ExportManifest = {
  format_version: string;
  source_repository: string;
  source_commit: string;
  files: Array<{ path: string; sha256: string }>;
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
  "THIRD_PARTY_NOTICES.md",
  "TRADEMARKS.md",
  "biome.json",
  "bun.lock",
  "contracts",
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
  const exportedPaths = exported.files.map(({ path }) => path);
  if (JSON.stringify(exportedPaths) !== JSON.stringify(["schemas/architecture-ir.schema.json"])) {
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
    JSON.parse(readFileSync(join(directory, "example.json"), "utf8"));
    JSON.parse(readFileSync(join(directory, "rootform.lock"), "utf8"));
    if (!readdirSync(directory).some((name) => name.endsWith(".tf") || name.endsWith(".tf.json"))) {
      throw new Error(`example contains no Terraform source: ${example}`);
    }
  }

  const binaryNotice = readFileSync(
    join(root, "LICENSES", "ROOTFORM-BINARY-LICENSE-REVIEW.md"),
    "utf8",
  );
  if (!binaryNotice.includes("not approved for public distribution")) {
    throw new Error("binary legal-review blocker is missing");
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
