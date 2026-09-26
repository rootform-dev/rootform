import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configuration, markedCommand } from "./docs-core-examples.ts";

type Case = {
  page: string;
  name: string;
  scenario: string;
  exit: number;
};

const cases: Case[] = [
  { page: "cli.md", name: "selection-embedded-run", scenario: "small", exit: 0 },
  { page: "cli.md", name: "selection-list-aws", scenario: "small", exit: 0 },
  { page: "cli.md", name: "selection-pack-override", scenario: "commerce", exit: 0 },
  { page: "cli.md", name: "selection-init-locked", scenario: "small-lock", exit: 0 },
  { page: "cli.md", name: "selection-list-selection", scenario: "small-lock", exit: 0 },
  { page: "cli.md", name: "selection-project-run", scenario: "cli-project", exit: 0 },
  { page: "guides/reproduce-build.md", name: "reproduce-source", scenario: "replay", exit: 0 },
  {
    page: "guides/reproduce-build.md",
    name: "reproduce-independent",
    scenario: "replay-before",
    exit: 0,
  },
  {
    page: "guides/reproduce-build.md",
    name: "reproduce-saved",
    scenario: "replay-before",
    exit: 0,
  },
  {
    page: "guides/reproduce-build.md",
    name: "reproduce-vendor-source",
    scenario: "local-lock",
    exit: 0,
  },
  {
    page: "guides/reproduce-build.md",
    name: "reproduce-vendor-replay",
    scenario: "local-vendor",
    exit: 0,
  },
  { page: "guides/local-dialect.md", name: "local-dialect-run", scenario: "local", exit: 0 },
  { page: "guides/local-dialect.md", name: "local-dialect-inspect", scenario: "local", exit: 0 },
  { page: "guides/local-dialect.md", name: "local-dialect-test", scenario: "local", exit: 0 },
  { page: "guides/local-dialect.md", name: "local-dialect-add", scenario: "local", exit: 0 },
  {
    page: "guides/local-dialect.md",
    name: "local-dialect-remove",
    scenario: "local-lock",
    exit: 0,
  },
  {
    page: "integrations/ci/README.md",
    name: "ci-init-locked",
    scenario: "ci-commerce-lock",
    exit: 0,
  },
  { page: "integrations/ci/README.md", name: "ci-run", scenario: "ci-small", exit: 0 },
  {
    page: "integrations/ci/README.md",
    name: "ci-pack-override",
    scenario: "ci-commerce",
    exit: 0,
  },
  {
    page: "integrations/ci/README.md",
    name: "ci-locked-policy",
    scenario: "ci-commerce-lock",
    exit: 0,
  },
  {
    page: "integrations/ci/README.md",
    name: "ci-review-html",
    scenario: "ci-small-analyzed",
    exit: 0,
  },
  { page: "troubleshooting/index.md", name: "troubleshooting-version", scenario: "small", exit: 0 },
  {
    page: "troubleshooting/index.md",
    name: "troubleshooting-binary-input",
    scenario: "small",
    exit: 3,
  },
  { page: "troubleshooting/index.md", name: "troubleshooting-pair", scenario: "pair", exit: 3 },
  { page: "troubleshooting/index.md", name: "troubleshooting-locked", scenario: "small", exit: 3 },
  {
    page: "troubleshooting/index.md",
    name: "troubleshooting-vendor-repair",
    scenario: "damaged-vendor",
    exit: 0,
  },
];

const ciSummaryDirectories: Record<string, string> = {
  "ci-run": ".rootform-ci-123",
  "ci-pack-override": ".rootform-ci-policy-123",
  "ci-locked-policy": ".rootform-ci-policy-123",
};

const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");
const emptyLock =
  '{"format_version":"1","dialects":[],"policy_packs":[],"excluded_owners":[],"replacements":[]}\n';

function run(
  args: string[],
  cwd: string,
  env: Record<string, string>,
): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(args, { cwd, env, stdout: "pipe", stderr: "pipe" });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString().replace(ansi, ""),
    stderr: result.stderr.toString().replace(ansi, ""),
  };
}

function requireSuccess(args: string[], cwd: string, env: Record<string, string>): void {
  const result = run(args, cwd, env);
  if (result.code !== 0) throw new Error(`Setup failed: ${args.join(" ")}\n${result.stderr}`);
}

function copyPair(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const file of ["plan.json", "plan.tfplan"]) cpSync(join(from, file), join(to, file));
}

function outputLines(page: string, name: string): string[] {
  const marker = `<!-- docs-output:${name} -->`;
  const parts = page.split(marker);
  if (parts.length === 1) return [];
  if (parts.length !== 2) throw new Error(`Repeated output marker: ${name}`);
  const match = /^\s*```(?:text|ansi)(?: title="[^"]+")?\n([\s\S]*?)\n```/u.exec(parts[1] ?? "");
  if (!match?.[1]) throw new Error(`Output block missing after ${name}`);
  return match[1].split("\n").filter((line) => line.length > 0);
}

function assertExcerpt(name: string, expected: string[], actual: string): void {
  const lines = actual.replace(ansi, "").split("\n");
  let position = 0;
  for (const line of expected) {
    const found = lines.findIndex((candidate, index) => index >= position && candidate === line);
    if (found < 0)
      throw new Error(`${name}: output line missing or out of order: ${JSON.stringify(line)}`);
    position = found + 1;
  }
}

export async function verifyAutomationExamples(binary: string, root: string): Promise<string> {
  const pages = new Map<string, string>();
  for (const item of cases) {
    if (!pages.has(item.page))
      pages.set(item.page, readFileSync(join(root, "docs", item.page), "utf8"));
  }
  const localPage = pages.get("guides/local-dialect.md") ?? "";
  const fixture = join(root, "scripts/fixtures/docs/local-dialect");
  for (const [title, source] of [
    ["main.tf", join(fixture, "main.tf")],
    [
      "dialects/network-review/dialect.rf.hcl",
      join(fixture, "dialects/network-review/dialect.rf.hcl"),
    ],
  ] as const) {
    if (configuration(localPage, title) !== readFileSync(source, "utf8"))
      throw new Error(`${title} differs from the plan fixture source`);
  }
  for (const [page, content] of pages) {
    const documented = [...content.matchAll(/<!-- docs-check:([\w-]+) -->/gu)].map(
      (match) => match[1],
    );
    const covered = cases.filter((item) => item.page === page).map((item) => item.name);
    if (documented.join("|") !== covered.join("|"))
      throw new Error(
        `${page}: marked command order differs from verifier: ${documented.join(", ")}`,
      );
  }

  const evidence = process.env.ROOTFORM_DOCS_EVIDENCE_DIR;
  if (evidence) mkdirSync(evidence, { recursive: true });
  for (const item of cases) {
    const work = mkdtempSync(join(tmpdir(), "rf-docs-automation-"));
    const home = mkdtempSync(join(tmpdir(), "rf-docs-home-"));
    const toolDir = join(work, "tools");
    mkdirSync(toolDir);
    symlinkSync(binary, join(toolDir, "rootform"));
    const runnerTemp = join(work, "runner");
    const env = {
      ...process.env,
      PATH: `${toolDir}:${process.env.PATH ?? ""}`,
      ROOTFORM_BIN: binary,
      ROOTFORM_HOME: home,
      RUNNER_TEMP: runnerTemp,
    } as Record<string, string>;
    mkdirSync(runnerTemp);
    const first = join(root, "scripts/fixtures/docs/first-architecture");
    const commerce = join(root, "examples/playground/commerce-platform/head");
    if (["small", "small-lock", "cli-project", "pair"].includes(item.scenario))
      copyPair(first, work);
    if (item.scenario === "commerce") {
      copyPair(commerce, work);
      cpSync(join(root, "policy-packs/baseline"), join(work, "policies"), { recursive: true });
    }
    if (item.scenario === "small-lock") writeFileSync(join(work, "rootform.lock"), emptyLock);
    if (item.scenario === "cli-project") {
      mkdirSync(join(work, "infra"));
      writeFileSync(join(work, "infra/rootform.lock"), emptyLock);
    }
    if (item.scenario === "pair") cpSync(join(commerce, "plan.tfplan"), join(work, "other.tfplan"));
    if (item.scenario.startsWith("replay")) {
      copyPair(first, join(work, "source"));
      copyPair(first, join(work, "replay"));
      if (item.scenario === "replay-before") {
        mkdirSync(join(work, "evidence"));
        requireSuccess(
          [
            binary,
            "run",
            "source/plan.json",
            "--project",
            "source",
            "--plan-file",
            "source/plan.tfplan",
            "--require-enrichment",
            "--no-serve",
            "-o",
            "evidence/before.json",
          ],
          work,
          env,
        );
      }
    }
    if (["local", "local-lock", "local-vendor", "damaged-vendor"].includes(item.scenario)) {
      cpSync(fixture, work, { recursive: true, force: true });
      if (item.scenario !== "local") {
        requireSuccess([binary, "add", "dialects", "./dialects/network-review"], work, env);
      }
      if (["local-vendor", "damaged-vendor"].includes(item.scenario)) {
        requireSuccess([binary, "vendor", "dialects", "--offline"], work, env);
      }
      if (item.scenario === "local-vendor") {
        requireSuccess(
          [
            binary,
            "run",
            "plan.json",
            "--plan-file",
            "plan.tfplan",
            "--require-enrichment",
            "--locked",
            "--no-serve",
            "-o",
            "before.json",
          ],
          work,
          env,
        );
      }
      if (item.scenario === "damaged-vendor") {
        renameSync(
          join(work, ".rootform/dialects/network-review/dialect.rf.hcl"),
          join(work, "retired-dialect.rf.hcl"),
        );
      }
    }
    if (item.scenario.startsWith("ci-")) {
      mkdirSync(join(work, "ci"));
      cpSync(join(root, "docs/integrations/ci/rootform-ci.sh"), join(work, "ci/rootform-ci.sh"));
      const isCommerce = !item.scenario.startsWith("ci-small");
      copyPair(isCommerce ? commerce : first, join(work, "infra"));
      copyPair(isCommerce ? commerce : first, runnerTemp);
      if (isCommerce)
        cpSync(join(root, "policy-packs/baseline"), join(work, "policies"), { recursive: true });
      if (item.scenario === "ci-commerce-lock") {
        requireSuccess([binary, "add", "policy-packs", "../policies"], join(work, "infra"), env);
      }
      if (item.scenario === "ci-small-analyzed") {
        const ciPage = pages.get(item.page) ?? "";
        requireSuccess(["sh", "-c", markedCommand(ciPage, "ci-run")], work, env);
      }
    }
    const page = pages.get(item.page) ?? "";
    const command = markedCommand(page, item.name);
    const result = run(["sh", "-c", command], work, env);
    if (result.code !== item.exit)
      throw new Error(
        `${item.name}: exit ${result.code}, expected ${item.exit}\n${result.stdout}\n${result.stderr}`,
      );
    const summaryDirectory = ciSummaryDirectories[item.name];
    const summaryPath = summaryDirectory ? join(work, summaryDirectory, "summary.txt") : "";
    const documentedOutput =
      summaryPath && existsSync(summaryPath)
        ? `${readFileSync(summaryPath, "utf8")}\n${result.stdout}\n${result.stderr}`
        : `${result.stdout}\n${result.stderr}`;
    assertExcerpt(item.name, outputLines(page, item.name), documentedOutput);
    if (evidence) {
      const base = join(evidence, item.name);
      writeFileSync(
        `${base}.command`,
        `cwd: ${work}\nROOTFORM_HOME: ${home}\n${command}\nexit: ${result.code}\n`,
      );
      writeFileSync(`${base}.stdout`, result.stdout);
      writeFileSync(`${base}.stderr`, result.stderr);
      if (summaryPath && existsSync(summaryPath))
        writeFileSync(`${base}.summary`, readFileSync(summaryPath));
    }
  }
  return `Automation docs: ${cases.length} marked commands and ${[...pages.values()].reduce((count, page) => count + [...page.matchAll(/<!-- docs-output:/gu)].length, 0)} output excerpts verified.`;
}
