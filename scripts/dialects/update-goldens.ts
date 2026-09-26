#!/usr/bin/env bun

// Record analysis.golden for every planned official Dialect fixture from its
// committed plan.json and plan.tfplan, with the Rootform executable named by
// ROOTFORM_BIN. Run it after a Dialect or Engine change; planning a fixture
// again is the job of generate-plan-fixtures.ts. The plan fixture inventory
// then states again which emitting rules no recorded analysis gives a fact.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  discoverFixtures,
  type InventoryFixture,
  type PlanFixtureInventory,
  recordedGoldens,
  rulesWithoutFactEvidence,
} from "./plan-fixtures.ts";
import { emittingRuleIds } from "./validate.ts";

const rootform = join(import.meta.dir, "../..");
const dialects = join(rootform, "dialects");
const fixtures = join(dialects, "fixtures");
const inventoryPath = join(dialects, "evidence", "plan-fixture-inventory.json");

function binary(): string {
  const configured = process.env.ROOTFORM_BIN;
  if (!configured) throw new Error("ROOTFORM_BIN must name a Rootform executable");
  const path = isAbsolute(configured) ? configured : resolve(rootform, configured);
  if (!existsSync(path)) throw new Error(`Rootform binary is unavailable: ${path}`);
  return path;
}

type TestReport = { total: number; passed: number; updated: number };

// "rootform test --update" records the golden of every case under directory
// that differs from its analysis or has none: the analysis in fixture form.
// A saved plan beside the export must verify, so a golden always carries the
// configuration snapshot; a refused pair errors the run instead.
export function writeGoldens(directory: string): TestReport {
  const home = mkdtempSync(join(tmpdir(), "rootform-dialect-goldens-"));
  try {
    const result = Bun.spawnSync({
      cmd: [binary(), "test", directory, "--update", "--format", "json"],
      env: { ...process.env, ROOTFORM_HOME: home, ROOTFORM_SOURCE: rootform },
      stderr: "pipe",
      stdout: "pipe",
    });
    if (result.exitCode !== 0) {
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      throw new Error(
        `rootform test --update ${relative(fixtures, directory) || "."} exited ${result.exitCode}`,
      );
    }
    return JSON.parse(result.stdout.toString()) as TestReport;
  } finally {
    rmSync(home, { force: true, recursive: true });
  }
}

// The plan fixture inventory, or undefined before any fixture was planned.
export function readInventory(): PlanFixtureInventory | undefined {
  if (!existsSync(inventoryPath)) return undefined;
  return JSON.parse(readFileSync(inventoryPath, "utf8")) as PlanFixtureInventory;
}

// Writes the inventory entry of every fixture directory that has one, in
// discovery order, with the emitting rules that no recorded golden gives a
// fact.
export function writeInventory(entries: InventoryFixture[]): void {
  const inventory = JSON.parse(readFileSync(join(dialects, "dialects.json"), "utf8")) as {
    format_version: string;
    dialects: Array<{ name: string; version: string }>;
  };
  const byFixture = new Map(entries.map((entry) => [entry.fixture, entry]));
  const document: PlanFixtureInventory = {
    format_version: "1",
    generator: "scripts/dialects/generate-plan-fixtures.ts",
    fixtures: discoverFixtures(fixtures).flatMap((fixture) => {
      const entry = byFixture.get(fixture);
      return entry ? [entry] : [];
    }),
    rules_without_fact_evidence: rulesWithoutFactEvidence(
      emittingRuleIds(inventory),
      recordedGoldens(fixtures),
    ),
  };
  writeFileSync(inventoryPath, `${JSON.stringify(document, null, 2)}\n`);
}

if (import.meta.main) {
  const report = writeGoldens(fixtures);
  const inventory = readInventory();
  if (inventory) writeInventory(inventory.fixtures);
  console.log(`Updated ${report.updated} of ${report.total} analysis goldens.`);
}
