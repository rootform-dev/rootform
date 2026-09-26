#!/usr/bin/env bun

// Verify the official Dialects with the Rootform executable named by
// ROOTFORM_BIN: formatting, validation, a deterministic replay of every planned
// fixture, the reviewed scenario expectations, and forbidden payloads.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import {
  fixtureSources,
  GOLDEN,
  PLAN_EXPORT,
  type PlanFixtureInventory,
  SAVED_PLAN,
  sentinels,
} from "./plan-fixtures.ts";
import { type Scenario, scenarioProblems, sentinelProblems } from "./scenario-checks.ts";

const root = join(import.meta.dir, "../..");
const dialects = join(root, "dialects");
const fixtures = join(dialects, "fixtures");
const configuredBinary = process.env.ROOTFORM_BIN;
if (!configuredBinary) throw new Error("ROOTFORM_BIN must name the Rootform executable");
const binary = isAbsolute(configuredBinary) ? configuredBinary : resolve(root, configuredBinary);
if (!existsSync(binary)) throw new Error(`Rootform binary is unavailable: ${binary}`);

type Result = { exitCode: number; stdout: string; stderr: string };

function execute(command: string[], cwd: string, environment: Record<string, string>): Result {
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function run(command: string[], environment: Record<string, string>): string {
  const result = execute(command, root, environment);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.exitCode !== 0) throw new Error(`${command.join(" ")} exited ${result.exitCode}`);
  return result.stdout;
}

function scenarios(): Scenario[] {
  const found: Scenario[] = [];
  for (const entry of readdirSync(join(dialects, "evidence"), { withFileTypes: true })) {
    const path = join(dialects, "evidence", entry.name, "scenarios.json");
    if (!entry.isDirectory() || !existsSync(path)) continue;
    const document = JSON.parse(readFileSync(path, "utf8")) as { scenarios?: Scenario[] };
    found.push(...(document.scenarios ?? []));
  }
  return found.sort((left, right) => left.id.localeCompare(right.id, "en"));
}

// What a reader of a fixture analysis can see: the golden, the complete
// document "rootform run" writes, and the text and Markdown summaries with
// their progress lines.
function outputs(directory: string, environment: Record<string, string>): string[] {
  const seen = [readFileSync(join(directory, GOLDEN), "utf8")];
  for (const format of ["json", "text", "markdown"]) {
    const result = execute(
      [binary, "run", PLAN_EXPORT, "--plan-file", SAVED_PLAN, "--no-serve", "--format", format],
      directory,
      environment,
    );
    if (result.exitCode !== 0) throw new Error(`${directory}: the ${format} summary failed`);
    seen.push(result.stdout, result.stderr);
  }
  return seen;
}

function inputs(directory: string): string[] {
  return [
    ...fixtureSources(directory).map((name) => readFileSync(join(directory, name), "utf8")),
    readFileSync(join(directory, PLAN_EXPORT), "utf8"),
  ];
}

const home = mkdtempSync(join(tmpdir(), "rootform-official-dialects-"));
const environment = { ROOTFORM_HOME: home };
try {
  run([binary, "version"], environment);
  run([binary, "fmt", "--check", dialects], environment);
  run([binary, "validate", "dialects", dialects], environment);
  const first = run([binary, "test", fixtures, "--format", "json"], environment);
  const second = run([binary, "test", fixtures, "--format", "json"], environment);
  if (first !== second) throw new Error("official Dialect fixture output is nondeterministic");

  const inventory = JSON.parse(
    readFileSync(join(dialects, "evidence", "plan-fixture-inventory.json"), "utf8"),
  ) as PlanFixtureInventory;
  const planned = new Set(
    inventory.fixtures.filter(({ status }) => status === "planned").map(({ fixture }) => fixture),
  );
  const report = JSON.parse(first) as { cases: Array<{ name: string; status: string }> };
  const replayed = report.cases.filter(({ status }) => status === "passed").map(({ name }) => name);
  if (JSON.stringify(replayed.sort()) !== JSON.stringify([...planned].sort())) {
    throw new Error("the fixture replay does not cover exactly the planned fixtures");
  }

  const problems: string[] = [];
  const unverified: string[] = [];
  const forbidden = new Map<string, Set<string>>();
  for (const scenario of scenarios()) {
    const fixture = scenario.fixture.replace(/^fixtures\//u, "");
    if (!planned.has(fixture)) {
      unverified.push(`${scenario.id} (${fixture} is not planned)`);
      continue;
    }
    const golden = readFileSync(join(fixtures, fixture, GOLDEN), "utf8");
    problems.push(...scenarioProblems(scenario, golden));
    const set = forbidden.get(fixture) ?? new Set<string>();
    for (const sentinel of scenario.forbidden_output ?? []) set.add(sentinel);
    forbidden.set(fixture, set);
  }
  for (const fixture of planned) {
    const directory = join(fixtures, fixture);
    const set = forbidden.get(fixture) ?? new Set<string>();
    for (const sentinel of sentinels(directory)) set.add(sentinel);
    if (set.size === 0) continue;
    problems.push(
      ...sentinelProblems(
        fixture,
        [...set].sort(),
        inputs(directory),
        outputs(directory, environment),
      ),
    );
  }
  for (const line of unverified) console.log(`Not verified: ${line}`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    throw new Error(`${problems.length} scenario expectation(s) failed`);
  }
  console.log(
    `Replayed ${planned.size} planned fixtures; ${unverified.length} scenario(s) name an unplanned fixture.`,
  );
} finally {
  rmSync(home, { force: true, recursive: true });
}

console.log("Official Rootform Dialects verification passed.");
