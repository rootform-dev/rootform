import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Official Dialect fixtures are Terraform configurations that a maintainer
// plans offline. Each planned fixture records the plan JSON export, the saved
// plan it came from, and the analysis "rootform test --update" records for
// them; "rootform test" then compares a fresh analysis with that golden.

export const PLAN_EXPORT = "plan.json";
export const SAVED_PLAN = "plan.tfplan";
export const GOLDEN = "analysis.golden";
export const OFFLINE_CONFIGURATION = "offline.tf";
export const SENTINEL_MANIFEST = "manifest.txt";
// Terraform's dependency lock file: the checksums of the provider packages the
// fixture was planned with, so a later plan installs the same packages.
export const LOCK_FILE = ".terraform.lock.hcl";

// Files a fixture plans from: its Terraform source and variable definitions.
export function isFixtureSource(name: string): boolean {
  return name.endsWith(".tf") || name.endsWith(".tfvars");
}

// A fixture is a directory below the fixture root that holds Terraform source.
export function discoverFixtures(root: string): string[] {
  const found: string[] = [];
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name, "en"),
    );
    if (entries.some((entry) => entry.isFile() && entry.name.endsWith(".tf"))) {
      found.push(relative(root, directory).replaceAll("\\", "/"));
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) visit(join(directory, entry.name));
    }
  };
  visit(root);
  return found;
}

export function fixtureSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isFixtureSource(entry.name))
    .map(({ name }) => name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

// The digest of what a plan was made from: every source file name and byte,
// in name order. A fixture whose digest no longer matches its inventory entry
// was edited without planning it again.
export function sourceDigest(directory: string): string {
  const hash = createHash("sha256");
  for (const name of fixtureSources(directory)) {
    const content = readFileSync(join(directory, name));
    hash.update(`${name}\0${content.length}\0`);
    hash.update(content);
  }
  return hash.digest("hex");
}

export type ProviderRequirement = {
  local: string;
  source: string;
  version: string;
};

// Provider sources compare without the default registry host, in lower case.
export function normalizeSource(source: string): string {
  return source
    .trim()
    .toLowerCase()
    .replace(/^registry\.(?:terraform\.io|opentofu\.org)\//u, "");
}

function blockBodies(text: string, opener: RegExp): string[] {
  const bodies: string[] = [];
  for (const match of text.matchAll(opener)) {
    let depth = 1;
    const start = (match.index ?? 0) + match[0].length;
    let index = start;
    while (index < text.length && depth > 0) {
      const character = text[index];
      if (character === "{") depth++;
      if (character === "}") depth--;
      index++;
    }
    bodies.push(text.slice(start, index - 1));
  }
  return bodies;
}

// Fixture sources declare providers in required_providers entries of the form
// name = { source = "...", version = "..." }, on one line or several.
export function providerRequirements(text: string): ProviderRequirement[] {
  const requirements = new Map<string, ProviderRequirement>();
  for (const body of blockBodies(text, /required_providers\s*\{/gu)) {
    for (const entry of body.matchAll(/([A-Za-z][A-Za-z0-9_-]*)\s*=\s*\{([^{}]*)\}/gu)) {
      const local = entry[1] ?? "";
      const fields = entry[2] ?? "";
      const source = /source\s*=\s*"([^"]+)"/u.exec(fields)?.[1];
      const version = /version\s*=\s*"([^"]+)"/u.exec(fields)?.[1] ?? "";
      if (!source) throw new Error(`required provider ${local} has no source`);
      requirements.set(local, { local, source: normalizeSource(source), version: version.trim() });
    }
  }
  return [...requirements.values()].sort((left, right) =>
    left.local.localeCompare(right.local, "en"),
  );
}

// A fixture pins every provider to one release, so planning it again later
// resolves the same provider build.
export function exactVersion(requirement: ProviderRequirement): string {
  const version = /^(?:=\s*)?([0-9]+\.[0-9]+\.[0-9]+)$/u.exec(requirement.version)?.[1];
  if (!version) {
    throw new Error(
      `provider ${requirement.local} must pin one exact version, not "${requirement.version}"`,
    );
  }
  return version;
}

// Provider blocks the fixture configures itself. Offline configuration never
// overrides them: such a fixture configures the provider for offline planning.
export function configuredProviders(text: string): Set<string> {
  return new Set(
    [...text.matchAll(/^\s*provider\s+"([^"]+)"\s*\{/gmu)].map((match) => match[1] ?? ""),
  );
}

export type InventoryFixture = {
  fixture: string;
  source_sha256: string;
  providers: Record<string, string>;
} & ({ status: "planned"; terraform_version: string } | { status: "not_planned"; reason: string });

export type PlanFixtureInventory = {
  format_version: "1";
  generator: string;
  fixtures: InventoryFixture[];
  rules_without_fact_evidence: Record<string, string[]>;
};

type Provenance = { rule?: unknown };
type Fact = { provenance?: Provenance[] };
type Stage = {
  representations?: Array<{ rule?: unknown }>;
  contexts?: Fact[];
  contributions?: Fact[];
  relations?: Fact[];
};

// Rules whose emissions produced at least one fact in a recorded analysis, at
// any stage. A rule applied to a representation without emitting a fact is
// evidence of its match only.
export function rulesWithFacts(golden: string): Set<string> {
  const document = JSON.parse(golden) as { forms?: Record<string, Stage | undefined> };
  const rules = new Set<string>();
  for (const stage of Object.values(document.forms ?? {})) {
    for (const facts of [stage?.contexts, stage?.contributions, stage?.relations]) {
      for (const fact of facts ?? []) {
        for (const { rule } of fact.provenance ?? []) {
          if (typeof rule === "string") rules.add(rule);
        }
      }
    }
  }
  return rules;
}

export function recordedGoldens(root: string): string[] {
  return discoverFixtures(root)
    .map((fixture) => join(root, fixture, GOLDEN))
    .filter((path) => existsSync(path));
}

export function rulesWithoutFactEvidence(
  emitting: Record<string, string[]>,
  goldens: string[],
): Record<string, string[]> {
  const proven = new Set<string>();
  for (const path of goldens) {
    for (const rule of rulesWithFacts(readFileSync(path, "utf8"))) proven.add(rule);
  }
  const result: Record<string, string[]> = {};
  for (const [dialect, rules] of Object.entries(emitting)) {
    result[dialect] = rules.filter((rule) => !proven.has(rule));
  }
  return result;
}

// Forbidden payloads a fixture declares: one per line, "#" starts a comment.
export function sentinels(directory: string): string[] {
  const path = join(directory, SENTINEL_MANIFEST);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

const FIXTURE_FILES = new Set([PLAN_EXPORT, SAVED_PLAN, GOLDEN, SENTINEL_MANIFEST, LOCK_FILE]);
const PLAN_OUTPUTS = [PLAN_EXPORT, SAVED_PLAN, GOLDEN];

// The inventory states, for every fixture, what it was planned from and
// whether it was planned. Its fixtures must be exactly the fixture
// directories, its digests must match their current source, and its rule
// evidence must match the recorded analyses.
export function planFixtureInventoryProblems(
  value: PlanFixtureInventory,
  fixturesRoot: string,
  emitting: Record<string, string[]>,
): string[] {
  const problems: string[] = [];
  if (value.format_version !== "1")
    problems.push("plan fixture inventory must use format version 1");
  if (value.generator !== "scripts/dialects/generate-plan-fixtures.ts") {
    problems.push("plan fixture inventory must name its generator");
  }
  const listed = value.fixtures.map(({ fixture }) => fixture);
  const discovered = discoverFixtures(fixturesRoot);
  if (JSON.stringify(listed) !== JSON.stringify(discovered)) {
    problems.push("plan fixture inventory must list every fixture directory once, in order");
  }
  for (const entry of value.fixtures) {
    const directory = join(fixturesRoot, entry.fixture);
    if (!existsSync(directory)) continue;
    if (entry.source_sha256 !== sourceDigest(directory)) {
      problems.push(`${entry.fixture} changed since it was planned`);
    }
    const text = fixtureSources(directory)
      .filter((name) => name.endsWith(".tf"))
      .map((name) => readFileSync(join(directory, name), "utf8"))
      .join("\n");
    const providers: Record<string, string> = {};
    try {
      for (const requirement of providerRequirements(text)) {
        providers[requirement.source] = exactVersion(requirement);
      }
    } catch (error) {
      problems.push(`${entry.fixture}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (JSON.stringify(entry.providers) !== JSON.stringify(providers)) {
      problems.push(`${entry.fixture} providers do not match its source`);
    }
    for (const name of readdirSync(directory)) {
      if (!isFixtureSource(name) && !FIXTURE_FILES.has(name)) {
        problems.push(`${entry.fixture} holds an unexpected file: ${name}`);
      }
    }
    const present = PLAN_OUTPUTS.filter((name) => existsSync(join(directory, name)));
    if (entry.status === "planned") {
      if (present.length !== PLAN_OUTPUTS.length) {
        problems.push(`${entry.fixture} is planned but lacks its plan outputs`);
      }
      if (!/^[0-9]+\.[0-9]+\.[0-9]+$/u.test(entry.terraform_version)) {
        problems.push(`${entry.fixture} must name the Terraform version that planned it`);
      }
    } else if (entry.status === "not_planned") {
      if (!entry.reason.trim()) problems.push(`${entry.fixture} must say why it is not planned`);
      if (present.length > 0)
        problems.push(`${entry.fixture} is not planned but holds plan outputs`);
    } else {
      problems.push(`${(entry as { fixture: string }).fixture} has an unknown status`);
    }
  }
  const expected = rulesWithoutFactEvidence(emitting, recordedGoldens(fixturesRoot));
  if (JSON.stringify(value.rules_without_fact_evidence) !== JSON.stringify(expected)) {
    problems.push("plan fixture inventory rule evidence does not match the recorded analyses");
  }
  return problems;
}
