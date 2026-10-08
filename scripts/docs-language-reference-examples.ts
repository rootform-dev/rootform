import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markedCommand } from "./docs-core-examples.ts";
import { fenced } from "./docs-language-examples.ts";

const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");
const pagePath = "docs/language/test-validate.md";
const markers = [
  "language-test-format",
  "language-test-validate",
  "language-test-replay",
  "language-test-run",
];

function excerpt(page: string, marker: string): string[] {
  const after = page.split(`<!-- docs-output:${marker} -->`)[1];
  if (!after) return [];
  const match = /^\s*```ansi title="[^"]+"\n([\s\S]*?)\n```/u.exec(after);
  if (!match?.[1]) throw new Error(`${marker}: output marker needs an ANSI block`);
  return match[1]
    .replace(ansi, "")
    .split("\n")
    .filter((line) => line.trim() !== "");
}

function assertLines(marker: string, expected: string[], actualOutput: string): void {
  const actual = actualOutput.replace(ansi, "").split("\n");
  let cursor = 0;
  for (const line of expected) {
    const next = actual.findIndex((candidate, index) => index >= cursor && candidate === line);
    if (next < 0) throw new Error(`${marker}: missing output line ${JSON.stringify(line)}`);
    cursor = next + 1;
  }
}

function run(binary: string, cwd: string, args: string[], home: string) {
  const result = Bun.spawnSync([binary, ...args], {
    cwd,
    env: { ...process.env, ROOTFORM_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exit: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function verifySource(
  binary: string,
  root: string,
  page: string,
  title: string,
  code: string | null,
): void {
  const source = fenced(readFileSync(join(root, page), "utf8"), "hcl", title);
  const scratch = mkdtempSync(join(tmpdir(), "rf-language-source-"));
  writeFileSync(join(scratch, "dialect.rf.hcl"), source);
  const result = run(
    binary,
    scratch,
    ["validate", "dialects", scratch, "--format", "json"],
    join(scratch, "home"),
  );
  if (code === null) {
    if (result.exit !== 0)
      throw new Error(`${title}: expected valid Dialect: ${result.stdout} ${result.stderr}`);
  } else {
    const codes = JSON.parse(result.stdout).problems.map(
      (problem: { code: string }) => problem.code,
    );
    if (result.exit !== 1 || codes.length !== 1 || codes[0] !== code)
      throw new Error(`${title}: expected only ${code}, got ${result.exit} ${codes.join(", ")}`);
  }
}

function verifyFragment(
  binary: string,
  root: string,
  page: string,
  title: string,
  before: string,
  after: string,
): void {
  const fragment = fenced(readFileSync(join(root, page), "utf8"), "rf", title);
  const scratch = mkdtempSync(join(tmpdir(), "rf-language-fragment-"));
  writeFileSync(join(scratch, "dialect.rf.hcl"), `${before}\n${fragment}\n${after}\n`);
  const result = run(binary, scratch, ["validate", "dialects", scratch], join(scratch, "home"));
  if (result.exit !== 0)
    throw new Error(`${title}: fragment did not compile: ${result.stdout} ${result.stderr}`);
}

export async function verifyLanguageReferenceExamples(
  binary: string,
  root: string,
): Promise<string> {
  const page = readFileSync(join(root, pagePath), "utf8");
  for (const marker of markers) {
    const scratch = mkdtempSync(join(tmpdir(), "rf-language-example-"));
    const fixture = join(root, "scripts/fixtures/docs/local-dialect");
    cpSync(fixture, scratch, { recursive: true });
    const command = markedCommand(page, marker);
    const home = join(scratch, ".home");
    mkdirSync(home, { recursive: true });
    const result = Bun.spawnSync(
      [
        "sh",
        "-c",
        `rootform() { "$ROOTFORM_BIN" "$@"; }
${command}`,
      ],
      {
        cwd: scratch,
        env: {
          ...process.env,
          ROOTFORM_HOME: home,
          ROOTFORM_BIN: binary,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const stdout = result.stdout.toString();
    if (result.exitCode !== 0)
      throw new Error(`${marker}: exit ${result.exitCode}: ${stdout} ${result.stderr.toString()}`);
    assertLines(marker, excerpt(page, marker), stdout);
  }
  verifySource(binary, root, "docs/language/reference/rules.md", "reference/dialect.rf.hcl", null);
  verifySource(
    binary,
    root,
    "docs/language/reference/rules.md",
    "invalid/match-only.rf.hcl",
    "RULE_NO_ARCHITECTURE",
  );
  verifySource(
    binary,
    root,
    "docs/language/reference/emissions.md",
    "emissions/dialect.rf.hcl",
    null,
  );
  const manifest = `dialect "example" {
  version = "0.1.0"
  provider "hashicorp/aws" { version = ">= 6.0.0" }
}`;
  verifyFragment(
    binary,
    root,
    "docs/language/reference/rules.md",
    "Rule match",
    `${manifest}\nrule "bucket" {`,
    "as = rf.concept.object-storage-container\n}",
  );
  verifyFragment(
    binary,
    root,
    "docs/language/reference/emissions.md",
    "Referenced Context",
    `${manifest}\nrule "subnet" {\nmatch { type = "aws_subnet" }\nas = rf.concept.subnet`,
    "}",
  );
  verifyFragment(
    binary,
    root,
    "docs/language/reference/emissions.md",
    "Labeled Relation",
    `${manifest}\nconcept "database" { description = "A database." }\nrule "reader" {\nmatch { type = "aws_subnet" }\nas = rf.concept.subnet`,
    "}",
  );
  verifyFragment(
    binary,
    root,
    "docs/language/reference/emissions.md",
    "Contribution",
    `${manifest}\nrule "config" {\nmatch { type = "aws_s3_bucket_versioning" }`,
    "}",
  );
  verifyFragment(
    binary,
    root,
    "docs/language/reference/emissions.md",
    "Identity match",
    `${manifest}\nrule "vpc" {\nmatch { type = "aws_vpc" }\nas = rf.concept.virtual-network\nidentity { attributes = ["id", "arn"] }\nendpoint { attributes = ["id", "arn"] }\n}\nrule "subnet" {\nmatch { type = "aws_subnet" }\nas = rf.concept.subnet\ncontext {\nas = rf.context.network\nto = rf.concept.virtual-network\nvia = source.vpc_id\non_null = "absent"\non_empty = "absent"`,
    "}\n}",
  );
  const traversalsPage = readFileSync(join(root, "docs/language/reference/traversals.md"), "utf8");
  const traversalSource = readFileSync(
    join(root, "scripts/fixtures/docs/language-traversals/dialect.rf.hcl"),
    "utf8",
  );
  for (const traversal of fenced(traversalsPage, "rf", "Valid traversals").trim().split("\n")) {
    if (!traversalSource.includes(traversal))
      throw new Error(`valid traversal missing from fixture: ${traversal}`);
  }
  const traversalScratch = mkdtempSync(join(tmpdir(), "rf-language-traversals-"));
  writeFileSync(join(traversalScratch, "dialect.rf.hcl"), traversalSource);
  const traversalsResult = run(
    binary,
    traversalScratch,
    ["validate", "dialects", traversalScratch],
    join(traversalScratch, "home"),
  );
  if (traversalsResult.exit !== 0)
    throw new Error(
      `valid traversals did not compile: ${traversalsResult.stdout} ${traversalsResult.stderr}`,
    );
  verifyFragment(
    binary,
    root,
    "docs/language/reference/composition.md",
    "filtered member",
    `${manifest}\nrule "root" {\nmatch { type = "aws_lb" }\nas = rf.concept.virtual-network\ncomposition {\nmember "proxy" {\nvia = source.proxy_id\nmatch { type = "aws_lb_target_group" }\n}`,
    "}\n}",
  );
  const invalid = mkdtempSync(join(tmpdir(), "rf-language-invalid-"));
  writeFileSync(
    join(invalid, "dialect.rf.hcl"),
    fenced(
      readFileSync(join(root, "docs/language/reference/rules.md"), "utf8"),
      "hcl",
      "invalid/match-only.rf.hcl",
    ),
  );
  const failed = run(
    binary,
    invalid,
    ["validate", "dialects", invalid, "--color", "always"],
    join(invalid, "home"),
  );
  if (failed.exit !== 1) throw new Error(`invalid Rule: expected exit 1, got ${failed.exit}`);
  assertLines(
    "invalid Rule",
    fenced(page, "ansi", "Invalid Rule excerpt")
      .replace(ansi, "")
      .split("\n")
      .filter((line) => line.trim() !== ""),
    failed.stdout,
  );
  return "Language reference: 4 commands, 4 complete Dialect sources, 6 fragments, and 1 failure excerpt verified.";
}
