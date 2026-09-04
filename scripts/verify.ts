#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const root = join(import.meta.dir, "..");

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
const configuredDialects = process.env.ROOTFORM_DIALECTS_DIR;
if (!configuredBinary)
  throw new Error("ROOTFORM_BIN must name the checksum-verified Rootform executable");
if (!configuredDialects)
  throw new Error("ROOTFORM_DIALECTS_DIR must name an exact dialect checkout");
const binary = isAbsolute(configuredBinary) ? configuredBinary : resolve(root, configuredBinary);
const dialects = isAbsolute(configuredDialects)
  ? configuredDialects
  : resolve(root, configuredDialects);
if (!existsSync(binary) || !existsSync(join(dialects, "core", "dialect.rf"))) {
  throw new Error("binary or dialect checkout is unavailable");
}

const isolatedHome = mkdtempSync(join(tmpdir(), "rootform-distribution-"));
const outputs = mkdtempSync(join(tmpdir(), "rootform-examples-"));
const environment = { ROOTFORM_HOME: isolatedHome };
run([binary, "install", "dialects", dialects], root, environment);

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

for (const example of [
  "aws-vpc",
  "azure-network",
  "gcp-cloud-sql",
  "kubernetes-workload",
  "multi-cloud",
]) {
  const directory = join(root, "examples", example);
  const firstPath = join(outputs, `${example}-first.json`);
  const secondPath = join(outputs, `${example}-second.json`);
  const htmlPath = join(outputs, `${example}.html`);
  run([binary, "build", ".", "--format", "json", "--output", firstPath], directory, environment);
  run([binary, "build", ".", "--format", "json", "--output", secondPath], directory, environment);
  if (!readFileSync(firstPath).equals(readFileSync(secondPath))) {
    throw new Error(`example is nondeterministic: ${example}`);
  }
  run([binary, "check", firstPath, "--format", "json"], directory, environment);
  run([binary, "build", ".", "--format", "html", "--output", htmlPath], directory, environment);
  const html = readFileSync(htmlPath, "utf8");
  if (!html.toLowerCase().includes("<!doctype html") || /(?:src|href)=["']https?:/iu.test(html)) {
    throw new Error(`HTML export is not self-contained: ${example}`);
  }
}

console.log("Distribution verification passed.");
