import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configuration, markedCommand } from "./docs-core-examples.ts";

type Example = { page: string; marker: string; exit: number; output?: string };

const pages = [
  "concepts/architecture-ir.md",
  "concepts/dialects.md",
  "guides/compare-architectures.md",
  "guides/check-architecture.md",
] as const;

const examples: Example[] = [
  { page: pages[0], marker: "concept-document-save", exit: 0 },
  { page: pages[0], marker: "concept-document-reopen", exit: 0 },
  { page: pages[1], marker: "concept-dialect-list", exit: 0, output: "concept-dialect-list" },
  {
    page: pages[1],
    marker: "concept-dialect-show-rule",
    exit: 0,
    output: "concept-dialect-show-rule",
  },
  { page: pages[2], marker: "compare-commerce", exit: 0, output: "compare-commerce" },
  { page: pages[2], marker: "compare-reopen-html", exit: 0 },
  { page: pages[3], marker: "check-architecture-pass", exit: 0, output: "check-architecture-pass" },
  {
    page: pages[3],
    marker: "check-architecture-explain-architecture",
    exit: 0,
    output: "check-architecture-explain-architecture",
  },
  {
    page: pages[3],
    marker: "check-architecture-explain-policy",
    exit: 0,
    output: "check-architecture-explain-policy",
  },
  {
    page: pages[3],
    marker: "check-architecture-violation",
    exit: 1,
    output: "check-architecture-violation",
  },
  {
    page: pages[3],
    marker: "check-architecture-indeterminate",
    exit: 3,
    output: "check-architecture-indeterminate",
  },
  {
    page: pages[3],
    marker: "check-architecture-no-target",
    exit: 3,
    output: "check-architecture-no-target",
  },
  { page: pages[3], marker: "check-architecture-lock", exit: 0 },
];

function required<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Missing ${String(key)}`);
  return value;
}

const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");
function outputExcerpt(page: string, marker: string): string[] {
  const after = page.split(`<!-- docs-output:${marker} -->`);
  if (after.length !== 2) throw new Error(`Missing output marker ${marker}`);
  const match = /^\s*```(?:ansi|text) title="[^"]+"\n([\s\S]*?)\n```/u.exec(after[1] ?? "");
  if (!match?.[1]) throw new Error(`Missing output fence ${marker}`);
  return match[1].replace(ansi, "").split("\n").filter(Boolean);
}
function assertExcerpt(actual: string, expected: string[], marker: string): void {
  const lines = actual.replace(ansi, "").split("\n");
  let cursor = 0;
  for (const expectedLine of expected) {
    while (cursor < lines.length && lines[cursor] !== expectedLine) cursor += 1;
    if (cursor === lines.length)
      throw new Error(`${marker}: output omitted ${JSON.stringify(expectedLine)}\n${actual}`);
    cursor += 1;
  }
}
function fixture(root: string, name: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const file of ["plan.json", "plan.tfplan"])
    copyFileSync(join(root, "scripts/fixtures/docs", name, file), join(target, file));
}
function run(
  binaryDirectory: string,
  cwd: string,
  command: string,
  marker: string,
  expectedExit: number,
): string {
  const result = Bun.spawnSync({
    cmd: ["/bin/sh", "-c", command],
    cwd,
    env: {
      ...process.env,
      PATH: `${binaryDirectory}:${process.env.PATH ?? ""}`,
      ROOTFORM_HOME: mkdtempSync(join(tmpdir(), "rf-docs-concept-home-")),
    },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120000,
  });
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  if (result.exitCode !== expectedExit)
    throw new Error(
      `${marker}: exit ${result.exitCode}, expected ${expectedExit}\n${stdout}\n${stderr}`,
    );
  return stdout;
}

export async function verifyConceptExamples(binary: string, root: string): Promise<string> {
  const binaryDirectory = mkdtempSync(join(tmpdir(), "rf-docs-concept-bin-"));
  copyFileSync(binary, join(binaryDirectory, "rootform"));
  const source = new Map(
    pages.map((path) => [path, readFileSync(join(root, "docs", path), "utf8")]),
  );
  const work = new Map(
    pages.map((path) => [path, mkdtempSync(join(tmpdir(), "rf-docs-concept-work-"))]),
  );
  fixture(root, "check-architecture/pass", required(work, pages[0]));
  fixture(root, "check-architecture/pass", join(required(work, pages[3]), "pass"));
  fixture(root, "check-architecture/violation", join(required(work, pages[3]), "violation"));
  fixture(root, "check-architecture/no-target", join(required(work, pages[3]), "no-target"));
  mkdirSync(join(required(work, pages[3]), "policies"));
  const guide = required(source, pages[3]);
  writeFileSync(
    join(required(work, pages[3]), "policies", "pack.rf.hcl"),
    configuration(guide, "policies/pack.rf.hcl"),
  );
  writeFileSync(
    join(required(work, pages[3]), "policies", "network-context.rf.hcl"),
    configuration(guide, "policies/network-context.rf.hcl"),
  );
  const compare = required(work, pages[2]);
  for (const side of ["base", "head"]) {
    mkdirSync(join(compare, side));
    for (const file of ["plan.json", "plan.tfplan"])
      copyFileSync(
        join(root, "examples/playground/commerce-platform", side, file),
        join(compare, side, file),
      );
  }
  const markers = new Set(examples.map(({ marker }) => marker));
  for (const [path, page] of source) {
    for (const match of page.matchAll(/<!-- docs-check:([^\s>]+) -->/gu)) {
      if (!markers.has(match[1] ?? "")) throw new Error(`${path}: unchecked marker ${match[1]}`);
    }
  }
  for (const example of examples) {
    const page = required(source, example.page);
    const stdout = run(
      binaryDirectory,
      required(work, example.page),
      markedCommand(page, example.marker),
      example.marker,
      example.exit,
    );
    if (example.output) assertExcerpt(stdout, outputExcerpt(page, example.output), example.marker);
  }
  return `${examples.length} concept and review command blocks verified`;
}
