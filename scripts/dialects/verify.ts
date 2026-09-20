#!/usr/bin/env bun

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const root = join(import.meta.dir, "../..");
const dialects = join(root, "dialects");
const configuredBinary = process.env.ROOTFORM_BIN;
if (!configuredBinary) throw new Error("ROOTFORM_BIN must name the Rootform executable");
const binary = isAbsolute(configuredBinary) ? configuredBinary : resolve(root, configuredBinary);
if (!existsSync(binary)) throw new Error(`Rootform binary is unavailable: ${binary}`);

function run(command: string[], environment: Record<string, string>): string {
  const result = Bun.spawnSync({
    cmd: command,
    cwd: root,
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  if (result.exitCode !== 0) throw new Error(`${command.join(" ")} exited ${result.exitCode}`);
  return stdout;
}

type BoundaryScenario = {
  expected_build_failure: true;
  expected_diagnostic_codes: string[];
  fixture: string;
  forbidden_output?: string[];
};

function boundaryScenarios(): BoundaryScenario[] {
  const scenarios: BoundaryScenario[] = [];
  for (const entry of readdirSync(join(dialects, "evidence"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(dialects, "evidence", entry.name, "scenarios.json");
    if (!existsSync(path)) continue;
    const document = JSON.parse(readFileSync(path, "utf8")) as { scenarios?: BoundaryScenario[] };
    for (const scenario of document.scenarios ?? []) {
      if (scenario.expected_build_failure === true) scenarios.push(scenario);
    }
  }
  return scenarios.sort((left, right) => left.fixture.localeCompare(right.fixture, "en"));
}

function buildBoundary(
  environment: Record<string, string>,
  scenario: BoundaryScenario,
): string {
  if (!/^fixtures\/[a-z0-9-]+\/boundary$/u.test(scenario.fixture)) {
    throw new Error(`invalid boundary fixture path: ${scenario.fixture}`);
  }
  const fixture = join(dialects, scenario.fixture);
  if (!existsSync(fixture)) throw new Error(`boundary fixture is unavailable: ${scenario.fixture}`);
  const result = Bun.spawnSync({
    cmd: [binary, "build", fixture],
    cwd: root,
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 3) {
    throw new Error(`${scenario.fixture} must exit 3 with delivered partial IR`);
  }
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  const document = JSON.parse(stdout) as {
    architecture?: { representations?: unknown };
    diagnostics?: Array<{ code?: unknown }>;
    format_version?: unknown;
  };
  if (
    document.format_version !== "0.1.0" ||
    !Array.isArray(document.architecture?.representations) ||
    document.architecture.representations.length === 0 ||
    !Array.isArray(document.diagnostics)
  ) {
    throw new Error(`${scenario.fixture} did not deliver valid partial Architecture IR`);
  }
  const actual = document.diagnostics.map(({ code }) => code).sort();
  const expected = [...scenario.expected_diagnostic_codes].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${scenario.fixture} diagnostic codes drifted`);
  }
  for (const sentinel of scenario.forbidden_output ?? []) {
    if (stdout.includes(sentinel) || stderr.includes(sentinel)) {
      throw new Error(`${scenario.fixture} leaked forbidden output`);
    }
  }
  return stdout;
}

const home = mkdtempSync(join(tmpdir(), "rootform-official-dialects-"));
const environment = { ROOTFORM_HOME: home };
try {
  run([binary, "version"], environment);
  run([binary, "fmt", "--check", dialects], environment);
  run([binary, "validate", "dialects", dialects], environment);
  const first = run([binary, "test", join(dialects, "fixtures"), "--format", "json"], environment);
  const second = run([binary, "test", join(dialects, "fixtures"), "--format", "json"], environment);
  if (first !== second) throw new Error("official Dialect fixture output is nondeterministic");
  const boundaries = boundaryScenarios();
  if (boundaries.length === 0) throw new Error("no official Dialect boundary evidence is declared");
  for (const scenario of boundaries) {
    if (buildBoundary(environment, scenario) !== buildBoundary(environment, scenario)) {
      throw new Error(`${scenario.fixture} partial Architecture IR is nondeterministic`);
    }
  }
  console.log(`Verified ${boundaries.length} official Dialect boundaries.`);
} finally {
  rmSync(home, { force: true, recursive: true });
}

console.log("Official Rootform Dialects verification passed.");
