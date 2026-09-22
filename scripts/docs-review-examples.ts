import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { configuration, markedCommand } from "./docs-core-examples.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs review example: ${message}`);
}

function execute(
  command: string[],
  cwd: string,
  environment: Record<string, string>,
  expected = 0,
) {
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, ...environment },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  assert(
    result.exitCode === expected,
    `${command.join(" ")}: exit ${result.exitCode}, expected ${expected}\n${result.stderr}`,
  );
  return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

export function verifyReviewExamples(
  binary: string,
  root: string,
  workspace: string,
  home: string,
): string[] {
  const repository = join(workspace, "review-repository");
  const environment = {
    ROOTFORM_HOME: home,
    ROOTFORM_INPUT: "0",
    DOCKER_CONFIG: join(home, "docker"),
    PATH: `${dirname(binary)}:${process.env.PATH ?? ""}`,
  };
  const run = (command: string[], expected = 0) =>
    execute(command, repository, environment, expected);
  const git = (args: string[]) => run(["git", ...args]);
  const page = (path: string) => readFileSync(join(root, "docs", path), "utf8");

  mkdirSync(join(repository, "infra"), { recursive: true });
  mkdirSync(join(repository, "policies"));
  writeFileSync(
    join(repository, "infra/main.tf"),
    configuration(page("getting-started/first-architecture.md"), "main.tf"),
  );
  const policyPage = page("guides/check-architecture.md");
  writeFileSync(
    join(repository, "policies/pack.rf.hcl"),
    configuration(policyPage, "policies/pack.rf.hcl"),
  );
  writeFileSync(
    join(repository, "policies/subnet-network-context.rf.hcl"),
    configuration(policyPage, "policies/subnet-network-context.rf.hcl"),
  );

  git(["init", "--quiet"]);
  git(["config", "user.name", "Rootform docs"]);
  git(["config", "user.email", "docs@example.invalid"]);
  git(["add", "."]);
  git(["commit", "--quiet", "-m", "base architecture"]);
  const baseCommit = git(["rev-parse", "HEAD"]).stdout.trim();
  git(["update-ref", "refs/remotes/origin/main", baseCommit]);

  writeFileSync(
    join(repository, "infra/database.tf"),
    configuration(page("guides/compare-architectures.md"), "database.tf"),
  );
  git(["add", "infra/database.tf"]);
  git(["commit", "--quiet", "-m", "add database subnet"]);

  const workflow = page("workflows/index.md");
  const setup = [
    "review-revisions",
    "review-worktrees",
    "review-build",
    "review-diff",
    "review-reports",
    "review-policy",
    "review-html",
  ]
    .map((marker) => markedCommand(workflow, marker))
    .join("\n");
  const result = run(["sh", "-eu", "-c", setup]);
  const match = /^Review directory: (.+)$/mu.exec(result.stdout);
  assert(match?.[1], "review directory was not reported");
  const reviewRoot = match[1];
  const results = join(reviewRoot, "results");

  const diff = JSON.parse(readFileSync(join(results, "architecture-diff.json"), "utf8"));
  assert(
    diff.summary?.representations?.added === 1 &&
      diff.summary?.contexts?.added === 1 &&
      diff.undetermined?.length === 0,
    "isolated worktrees produced unexpected Architecture Diff",
  );
  assert(
    readFileSync(join(results, "architecture-diff.md"), "utf8").startsWith("## Rootform diff\n"),
    "Markdown review report is missing",
  );
  const policy = JSON.parse(readFileSync(join(results, "policy-result.json"), "utf8"));
  assert(
    policy.summary?.policies === 1 &&
      policy.summary?.evaluations === 2 &&
      policy.summary?.passed === 2,
    "head Policy result lost selected targets or passed outcomes",
  );
  assert(
    readFileSync(join(results, "after.html"), "utf8").startsWith("<!doctype html>"),
    "head architecture HTML was not written",
  );

  const equivalentA = join(reviewRoot, "equivalent-a");
  const equivalentB = join(reviewRoot, "equivalent-b");
  git(["worktree", "add", "--detach", equivalentA, baseCommit]);
  git(["worktree", "add", "--detach", equivalentB, baseCommit]);
  run([binary, "build", join(equivalentA, "infra"), "--output", join(reviewRoot, "a.json")]);
  run([binary, "build", join(equivalentB, "infra"), "--output", join(reviewRoot, "b.json")]);
  const identical = run([
    binary,
    "diff",
    join(reviewRoot, "a.json"),
    join(reviewRoot, "b.json"),
    "--exit-code",
  ]);
  assert(identical.stdout.trim() === "Architecture unchanged", "checkout paths changed Diff");
  git(["worktree", "remove", equivalentA]);
  git(["worktree", "remove", equivalentB]);
  rmSync(join(reviewRoot, "a.json"));
  rmSync(join(reviewRoot, "b.json"));

  execute(["sh", "-eu", "-c", markedCommand(workflow, "review-cleanup")], repository, {
    ...environment,
    review_root: reviewRoot,
  });
  assert(!existsSync(reviewRoot), "review cleanup left temporary files");
  assert(git(["status", "--porcelain"]).stdout === "", "review changed working copy");

  const requiredOnlySetup = [
    "review-revisions",
    "review-worktrees",
    "review-build",
    "review-diff",
    "review-reports",
  ]
    .map((marker) => markedCommand(workflow, marker))
    .join("\n");
  const requiredOnlyResult = run(["sh", "-eu", "-c", requiredOnlySetup]);
  const requiredOnlyMatch = /^Review directory: (.+)$/mu.exec(requiredOnlyResult.stdout);
  assert(requiredOnlyMatch?.[1], "required-only review directory was not reported");
  const requiredOnlyRoot = requiredOnlyMatch[1];
  assert(
    !existsSync(join(requiredOnlyRoot, "results/policy-result.json")) &&
      !existsSync(join(requiredOnlyRoot, "results/after.html")),
    "required-only review unexpectedly created optional artifacts",
  );
  execute(["sh", "-eu", "-c", markedCommand(workflow, "review-cleanup")], repository, {
    ...environment,
    review_root: requiredOnlyRoot,
  });
  assert(!existsSync(requiredOnlyRoot), "required-only cleanup left temporary files");
  assert(git(["status", "--porcelain"]).stdout === "", "required-only review changed working copy");

  return [
    "pull-request review built isolated merge-base and head worktrees without changing checkout",
    "equivalent commits in different worktree paths compared unchanged",
    "review Markdown, JSON, Policy JSON, and architecture HTML were created then cleaned",
    "review without optional Policy or HTML steps created required reports and cleaned successfully",
  ];
}
