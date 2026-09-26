import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configuration, markedCommand } from "./docs-core-examples.ts";

type Case = {
  page: string;
  marker: string;
  scenario: "first" | "commerce" | "head";
  serve?: true;
  seed?: true;
};

const cases: Case[] = [
  {
    page: "getting-started/first-architecture.md",
    marker: "journey-first-directory",
    scenario: "first",
  },
  {
    page: "getting-started/first-architecture.md",
    marker: "journey-first-serve",
    scenario: "first",
    serve: true,
  },
  {
    page: "getting-started/first-architecture.md",
    marker: "journey-first-without-plan",
    scenario: "first",
  },
  {
    page: "getting-started/first-architecture.md",
    marker: "journey-first-save",
    scenario: "first",
  },
  {
    page: "getting-started/first-architecture.md",
    marker: "journey-first-explain",
    scenario: "first",
    seed: true,
  },
  {
    page: "getting-started/first-architecture.md",
    marker: "journey-first-html",
    scenario: "first",
  },
  {
    page: "guides/explore-architecture.md",
    marker: "journey-explore-open",
    scenario: "first",
    serve: true,
  },
  { page: "guides/explore-architecture.md", marker: "journey-explore-export", scenario: "first" },
  { page: "inputs/index.md", marker: "journey-inputs-reuse", scenario: "first", seed: true },
  { page: "inputs/plans.md", marker: "journey-plans-verify", scenario: "first" },
  { page: "workflows/index.md", marker: "journey-review-one-plan", scenario: "head" },
  { page: "reference/cli/run.md", marker: "journey-run-save", scenario: "first" },
  { page: "reference/cli/run.md", marker: "journey-run-compare", scenario: "commerce" },
  { page: "reference/outputs.md", marker: "journey-outputs-multiple", scenario: "first" },
];

const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");
function excerptAfter(page: string, marker: string): string[] {
  const tail = page.split(`<!-- docs-check:${marker} -->`)[1];
  if (tail === undefined) throw new Error(`Missing marker ${marker}`);
  const shell = /^\s*```sh\n[\s\S]*?\n```/u.exec(tail);
  if (shell === null) throw new Error(`Missing shell block after ${marker}`);
  const next = tail.slice(shell[0].length).split(/^## |^<!-- docs-check:/mu)[0] ?? "";
  const output = /```ansi title="[^"]+"\n([\s\S]*?)\n```/u.exec(next)?.[1];
  return (
    output
      ?.split("\n")
      .map((line) => line.replace(ansi, ""))
      .filter((line) => line.trim() !== "") ?? []
  );
}

function copy(source: string, destination: string): void {
  mkdirSync(join(destination, ".."), { recursive: true });
  copyFileSync(source, destination);
}

function prepare(root: string, scratch: string, item: Case): void {
  if (item.scenario === "first") {
    const source = join(root, "scripts/fixtures/docs/first-architecture");
    for (const name of ["main.tf", "plan.json", "plan.tfplan"]) {
      copy(join(source, name), join(scratch, name));
    }
  } else if (item.scenario === "head") {
    const source = join(root, "examples/playground/commerce-platform/head");
    for (const name of ["plan.json", "plan.tfplan"]) {
      copy(join(source, name), join(scratch, name));
    }
  } else {
    for (const side of ["base", "head"]) {
      const source = join(root, "examples/playground/commerce-platform", side);
      for (const name of ["plan.json", "plan.tfplan"]) {
        copy(join(source, name), join(scratch, side, name));
      }
    }
    cpSync(join(root, "policy-packs/baseline"), join(scratch, "policies"), { recursive: true });
    mkdirSync(join(scratch, "review"), { recursive: true });
  }
}

function assertExcerpt(marker: string, lines: string[], output: string): void {
  const actual = output.replace(ansi, "").split("\n");
  let cursor = 0;
  for (const line of lines) {
    const index = actual.findIndex((candidate, offset) => offset >= cursor && candidate === line);
    if (index < 0)
      throw new Error(
        `${marker}: missing output line after ${cursor}: ${JSON.stringify(line)}\n${output}`,
      );
    cursor = index + 1;
  }
}

async function serve(command: string, scratch: string, env: Record<string, string>) {
  const child = Bun.spawn(["/bin/sh", "-c", `${command} --color always --no-browser --port 0`], {
    cwd: scratch,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  child.kill("SIGINT");
  const exit = await child.exited;
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exit, stdout, stderr };
}

export async function verifyJourneyExamples(binary: string, root: string): Promise<string> {
  const tutorial = readFileSync(join(root, "docs/getting-started/first-architecture.md"), "utf8");
  const fixture = readFileSync(
    join(root, "scripts/fixtures/docs/first-architecture/main.tf"),
    "utf8",
  );
  if (configuration(tutorial, "main.tf") !== fixture)
    throw new Error("first architecture configuration differs from its planned fixture");

  const pages = new Set(cases.map((item) => item.page));
  const documented = [...pages].flatMap((path) =>
    [
      ...readFileSync(join(root, "docs", path), "utf8").matchAll(/<!-- docs-check:([^ ]+) -->/gu),
    ].map((match) => match[1] ?? ""),
  );
  const expected = [...cases.map((item) => item.marker), ...reviewSteps, reviewCleanup];
  if (
    documented.length !== expected.length ||
    documented.some((marker) => expected.filter((name) => name === marker).length !== 1)
  )
    throw new Error("Journey markers and verified commands differ");

  const evidence = process.env.ROOTFORM_DOCS_EVIDENCE;
  if (evidence) mkdirSync(evidence, { recursive: true });
  for (const item of cases) {
    const page = readFileSync(join(root, "docs", item.page), "utf8");
    const command = markedCommand(page, item.marker);
    const scratch = mkdtempSync(join(tmpdir(), "rf-journey-"));
    prepare(root, scratch, item);
    const bin = join(scratch, "bin");
    mkdirSync(bin);
    symlinkSync(binary, join(bin, "rootform"));
    const home = join(scratch, "home");
    mkdirSync(home);
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      ROOTFORM_HOME: home,
      ROOTFORM_SOURCE: "",
    };
    if (item.seed) {
      const seeded = Bun.spawnSync(
        [
          binary,
          "run",
          "plan.json",
          "--plan-file",
          "plan.tfplan",
          "--no-serve",
          "-o",
          "architecture.json",
        ],
        {
          cwd: scratch,
          env,
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      if (seeded.exitCode !== 0)
        throw new Error(`${item.marker}: could not seed document: ${seeded.stderr.toString()}`);
    }
    const result = item.serve
      ? await serve(command, scratch, env)
      : (() => {
          const run = Bun.spawnSync(["/bin/sh", "-c", `${command} --color always`], {
            cwd: scratch,
            env,
            stdout: "pipe",
            stderr: "pipe",
            timeout: 30000,
          });
          return {
            exit: run.exitCode,
            stdout: run.stdout.toString(),
            stderr: run.stderr.toString(),
          };
        })();
    if (result.exit !== 0)
      throw new Error(`${item.marker}: exit ${result.exit}\n${result.stdout}\n${result.stderr}`);
    assertExcerpt(
      item.marker,
      excerptAfter(page, item.marker),
      `${result.stdout}\n${result.stderr}`,
    );
    if (evidence) {
      writeFileSync(join(evidence, `${item.marker}.stdout`), result.stdout);
      writeFileSync(join(evidence, `${item.marker}.stderr`), result.stderr);
      writeFileSync(
        join(evidence, `${item.marker}.json`),
        `${JSON.stringify({ command, exit: result.exit, scenario: item.scenario }, null, 2)}\n`,
      );
    }
    const outputs: Record<string, string[]> = {
      "journey-first-directory": ["rootform-first-architecture"],
      "journey-first-save": ["architecture.json"],
      "journey-first-html": ["architecture.html"],
      "journey-explore-export": ["architecture.json", "architecture.html"],
      "journey-inputs-reuse": ["report.md"],
      "journey-plans-verify": ["analysis.json"],
      "journey-run-save": ["architecture.json"],
      "journey-run-compare": ["comparison.md"],
      "journey-outputs-multiple": [
        "architecture.json",
        "architecture.md",
        "architecture.sarif.json",
        "architecture.html",
      ],
    };
    for (const path of outputs[item.marker] ?? []) {
      if (!existsSync(join(scratch, path))) throw new Error(`${item.marker}: missing ${path}`);
    }
  }
  const review = verifyReviewProcedure(binary, root);
  return `Journey examples: ${cases.length} marked commands passed; ${review}`;
}

/* The pull request procedure chains its markers in one shell, as a reader
   would. Planning needs Terraform or OpenTofu and credentials, so the check
   copies the commerce Playground's verified plan pairs into the results
   directory, exactly as the page's try-it paragraph describes. */
const reviewSteps = [
  "journey-review-revisions",
  "journey-review-worktrees",
  "journey-review-compare",
  "journey-review-save",
  "journey-review-policy",
];
const reviewCleanup = "journey-review-cleanup";
const reviewPlans =
  'for side in base head; do cp "$commerce_plans/$side/plan.json" "$results/$side.json"; cp "$commerce_plans/$side/plan.tfplan" "$results/$side.tfplan"; done';

function verifyReviewProcedure(binary: string, root: string): string {
  const page = readFileSync(join(root, "docs/workflows/index.md"), "utf8");
  const scratch = mkdtempSync(join(tmpdir(), "rf-review-"));
  const repository = join(scratch, "repository");
  const bin = join(scratch, "bin");
  mkdirSync(bin);
  symlinkSync(binary, join(bin, "rootform"));
  const home = join(scratch, "home");
  mkdirSync(home);
  const commerce = join(root, "examples/playground/commerce-platform");
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    ROOTFORM_HOME: home,
    ROOTFORM_SOURCE: "",
    commerce_plans: commerce,
  };
  const shell = (script: string, extra: Record<string, string> = {}) => {
    const run = Bun.spawnSync(["/bin/sh", "-eu", "-c", script], {
      cwd: repository,
      env: { ...env, ...extra },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60000,
    });
    const stdout = run.stdout.toString();
    const stderr = run.stderr.toString();
    if (run.exitCode !== 0)
      throw new Error(`review procedure: exit ${run.exitCode}\n${stdout}\n${stderr}`);
    return { stdout, stderr };
  };
  const git = (args: string) => shell(`git ${args}`).stdout.trim();

  mkdirSync(join(repository, "infra"), { recursive: true });
  copyFileSync(join(commerce, "base/main.tf"), join(repository, "infra/main.tf"));
  cpSync(join(root, "policy-packs/baseline"), join(repository, "policies"), { recursive: true });
  git("init --quiet");
  git("config user.name 'Rootform docs'");
  git("config user.email docs@example.invalid");
  git("add .");
  git("commit --quiet -m base");
  const baseCommit = git("rev-parse HEAD");
  git(`update-ref refs/remotes/origin/main ${baseCommit}`);
  copyFileSync(join(commerce, "head/main.tf"), join(repository, "infra/main.tf"));
  git("commit --quiet -am head");

  const complete = shell(
    [
      markedCommand(page, "journey-review-revisions"),
      markedCommand(page, "journey-review-worktrees"),
      reviewPlans,
      markedCommand(page, "journey-review-compare"),
      markedCommand(page, "journey-review-save"),
      markedCommand(page, "journey-review-policy"),
    ].join("\n"),
  );
  const output = `${complete.stdout}\n${complete.stderr}`;
  if (!complete.stdout.includes(`Before: ${baseCommit}`))
    throw new Error("review procedure: merge base is not the base commit");
  const reviewRoot = /^Review directory: (.+)$/mu.exec(complete.stdout)?.[1];
  if (!reviewRoot) throw new Error("review procedure: review directory was not reported");
  for (const marker of ["journey-review-compare", "journey-review-policy"])
    assertExcerpt(marker, excerptAfter(page, marker), output);
  const results = join(reviewRoot, "results");
  for (const name of [
    "comparison.json",
    "comparison.md",
    "comparison.html",
    "policy.md",
    "policy.sarif",
  ]) {
    if (!existsSync(join(results, name))) throw new Error(`review procedure: missing ${name}`);
  }
  const cleanup = markedCommand(page, reviewCleanup);
  shell(cleanup, { review_root: reviewRoot, results });
  if (existsSync(reviewRoot)) throw new Error("review cleanup left temporary files");

  const required = shell(
    [
      markedCommand(page, "journey-review-revisions"),
      markedCommand(page, "journey-review-worktrees"),
      reviewPlans,
      markedCommand(page, "journey-review-compare"),
    ].join("\n"),
  );
  const requiredRoot = /^Review directory: (.+)$/mu.exec(required.stdout)?.[1];
  if (!requiredRoot) throw new Error("review procedure: review directory was not reported");
  shell(cleanup, { review_root: requiredRoot, results: join(requiredRoot, "results") });
  if (existsSync(requiredRoot)) throw new Error("review cleanup without optional artifacts failed");
  if (git("status --porcelain") !== "") throw new Error("review procedure changed the checkout");
  if (
    git("worktree list --porcelain")
      .split("\n")
      .filter((line) => line.startsWith("worktree ")).length !== 1
  )
    throw new Error("review procedure left a registered worktree");
  return `review procedure: ${reviewSteps.length + 1} chained commands passed`;
}
