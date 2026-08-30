#!/usr/bin/env bun

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const root = join(import.meta.dir, "..");

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
