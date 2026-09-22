#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { verifyCoreExamples } from "./docs-core-examples.ts";
import { verifyLanguageExamples } from "./docs-language-examples.ts";
import { verifyReviewExamples } from "./docs-review-examples.ts";

const repoRoot = resolve(import.meta.dir, "..");
const docPath = join(repoRoot, "docs/getting-started/first-architecture.md");
const buildRefPath = join(repoRoot, "docs/reference/cli/build.md");
const examplePath = join(repoRoot, "examples/aws-vpc/main.tf");
const fence = "```";

function fail(message: string): never {
  throw new Error(message);
}

function binaryPath(environment: Record<string, string | undefined> = process.env): string {
  const specified = environment.ROOTFORM_BIN?.trim();
  if (!specified || !isAbsolute(specified) || !existsSync(specified)) {
    fail("ROOTFORM_BIN must name an existing absolute Rootform executable");
  }
  return specified;
}

function run(binary: string, args: string[], cwd: string, home: string) {
  const result = Bun.spawnSync([binary, ...args], {
    cwd,
    env: { ...process.env, ROOTFORM_HOME: home, DOCKER_CONFIG: join(home, "docker") },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode === null) fail(`rootform ${args.join(" ")} was killed`);
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString("utf8"),
    stderr: result.stderr.toString("utf8"),
  };
}

function normalized(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n")
    .trim();
}

function fencedMain(page: string): string {
  const matches = [
    ...page.matchAll(new RegExp(`${fence}hcl title="main\\.tf"\\n([\\s\\S]*?)\\n${fence}`, "gu")),
  ];
  if (matches.length !== 1 || matches[0]?.[1] === undefined) {
    fail("first architecture page must contain one main.tf fence");
  }
  return `${matches[0][1].replace(/\r\n/gu, "\n").replace(/\s+$/u, "")}\n`;
}

function displayedSummary(page: string): string {
  const matches = [
    ...page.matchAll(
      new RegExp(`${fence}text title="Declaration summary"\\n([\\s\\S]*?)\\n${fence}`, "gu"),
    ),
  ];
  if (matches.length !== 1 || matches[0]?.[1] === undefined) fail("declaration summary missing");
  return normalized(matches[0][1]);
}

function documentedFlags(text: string): string[] {
  return [...new Set([...text.matchAll(/(--[a-z][a-z0-9-]*)/gu)].map((match) => match[1] ?? ""))]
    .filter(Boolean)
    .sort();
}

const binary = binaryPath();
const page = readFileSync(docPath, "utf8");
const buildReference = readFileSync(buildRefPath, "utf8");
const main = fencedMain(page);
if (normalized(main) !== normalized(readFileSync(examplePath, "utf8"))) {
  fail("main.tf fence differs from examples/aws-vpc/main.tf");
}

const workspace = mkdtempSync(join(tmpdir(), "rootform-docs-example-"));
const home = mkdtempSync(join(tmpdir(), "rootform-docs-home-"));
const steps: string[] = [];
try {
  mkdirSync(join(home, "docker"));
  writeFileSync(join(home, "docker/config.json"), "{}\n");
  writeFileSync(join(workspace, "main.tf"), main);

  const version = run(binary, ["version"], repoRoot, home);
  if (version.exitCode !== 0) fail(`rootform version failed: ${version.stderr}`);
  const binaryVersion = version.stdout.trim().replace(/^rootform\s+/u, "");

  const built = run(binary, ["build", ".", "--output", "architecture.json"], workspace, home);
  if (built.exitCode !== 0) fail(`rootform build failed: ${built.stderr}`);
  if (existsSync(join(workspace, "rootform.lock"))) fail("build created rootform.lock");

  const architectureBytes = readFileSync(join(workspace, "architecture.json"));
  const architecture = JSON.parse(architectureBytes.toString("utf8")) as {
    format_version?: string;
    generator?: { name?: string; version?: string };
    source?: {
      declarations?: Array<{
        address?: string;
        representation?: string;
        interpretation?: { status?: string; rule?: string; concept?: string };
      }>;
    };
    architecture?: {
      contexts?: Array<{ dimension?: string; from?: string; to?: string }>;
    };
    semantics?: {
      release_set?: { id?: string };
      owners?: Array<{ id?: string; kind?: string; origin?: string }>;
    };
  };
  if (
    architecture.format_version !== "0.1.0" ||
    architecture.generator?.name !== "rootform" ||
    architecture.generator?.version !== binaryVersion
  ) {
    fail("Architecture IR envelope differs from running binary");
  }

  const declarations = architecture.source?.declarations ?? [];
  for (const [address, rule, concept] of [
    ["aws_vpc.main", "aws.rule.vpc", "rf.concept.virtual-network"],
    ["aws_subnet.application", "aws.rule.subnet", "rf.concept.subnet"],
  ]) {
    const declaration = declarations.find((entry) => entry.address === address);
    if (
      !declaration?.representation?.startsWith("representation:1:root:resource:") ||
      declaration.interpretation?.status !== "applied" ||
      declaration.interpretation.rule !== rule ||
      declaration.interpretation.concept !== concept
    ) {
      fail(`declaration ${address} lacks expected base and interpretation`);
    }
  }
  const network = (architecture.architecture?.contexts ?? []).find(
    (entry) => entry.dimension === "rf.context.network",
  );
  if (!network?.from?.includes("aws_subnet.application") || !network.to?.includes("aws_vpc.main")) {
    fail("network context between subnet and VPC missing");
  }
  const owners = architecture.semantics?.owners ?? [];
  if (
    !owners.some((owner) => owner.id === "aws" && owner.kind === "dialect") ||
    !owners.some((owner) => owner.id === "rf" && owner.kind === "vocabulary") ||
    !architecture.semantics?.release_set?.id?.startsWith("release-set:")
  ) {
    fail("release set owner registry missing AWS Dialect or RF Vocabulary");
  }

  const lock = `${JSON.stringify(
    {
      format_version: "1",
      dialects: [],
      policy_packs: [],
      excluded_owners: [],
      replacements: [],
    },
    null,
    2,
  )}\n`;
  writeFileSync(join(workspace, "rootform.lock"), lock);
  const repeated = run(
    binary,
    ["build", ".", "--locked", "--output", "repeated.json"],
    workspace,
    home,
  );
  if (repeated.exitCode !== 0) fail(`locked rebuild failed: ${repeated.stderr}`);
  if (!readFileSync(join(workspace, "repeated.json")).equals(architectureBytes)) {
    fail("locked rebuild differs byte-for-byte");
  }
  if (readFileSync(join(workspace, "rootform.lock"), "utf8") !== lock) {
    fail("build mutated rootform.lock");
  }

  const help = run(binary, ["build", "--help"], repoRoot, home);
  if (help.exitCode !== 0) fail("rootform build --help failed");
  const missing = documentedFlags(buildReference).filter((flag) => !help.stdout.includes(flag));
  if (missing.length > 0) fail(`build docs carry unsupported flags: ${missing.join(", ")}`);
  const summary = normalized(built.stderr);
  if (displayedSummary(page) !== summary || displayedSummary(buildReference) !== summary) {
    fail("displayed declaration summary differs from real build");
  }

  steps.push(
    `rootform ${binaryVersion} sha256:${createHash("sha256").update(readFileSync(binary)).digest("hex")}`,
    "build created no lock and locked replay stayed byte-identical",
    "resource bases, owner-first Rules, RF Vocabulary, and network context verified",
  );
  steps.push(...verifyCoreExamples(binary, repoRoot, workspace, home));
  steps.push(...verifyReviewExamples(binary, repoRoot, workspace, home));
  steps.push(...verifyLanguageExamples(binary, repoRoot, workspace, home));
  console.log(`documentation examples: PASS (${steps.length} checks)`);
  for (const step of steps) console.log(`  - ${step}`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
}
