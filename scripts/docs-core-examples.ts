import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseReference } from "./generate-cli-reference.ts";

const fence = "```";

export function markedCommand(page: string, name: string): string {
  const marker = `<!-- docs-check:${name} -->`;
  const parts = page.split(marker);
  if (parts.length !== 2) throw new Error(`Expected one command marker: ${name}`);
  const match = new RegExp(`^\\s*${fence}sh\\n([\\s\\S]*?)\\n${fence}`).exec(parts[1] ?? "");
  if (!match?.[1]) throw new Error(`Expected shell block after ${name}`);
  return match[1];
}

function fencedBlock(page: string, language: string, title: string): string {
  const opening = `${fence}${language} title="${title}"\n`;
  const parts = page.split(opening);
  if (parts.length !== 2) throw new Error(`Expected one ${language} block: ${title}`);
  const body = parts[1]?.split(`\n${fence}`)[0];
  if (!body) throw new Error(`Empty ${language} block: ${title}`);
  return `${body}\n`;
}

export function configuration(page: string, title: string): string {
  return fencedBlock(page, "hcl", title);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs example: ${message}`);
}

export function verifyCoreExamples(
  binary: string,
  root: string,
  workspace: string,
  home: string,
): string[] {
  const checks: string[] = [];
  const read = (path: string) => readFileSync(join(workspace, path));
  const page = (path: string) => readFileSync(join(root, "docs", path), "utf8");
  const original = read("main.tf");
  const binDir = join(home, "bin");
  mkdirSync(binDir);
  symlinkSync(binary, join(binDir, "rootform"));
  const env = {
    ...process.env,
    ROOTFORM_HOME: home,
    ROOTFORM_INPUT: "0",
    DOCKER_CONFIG: join(home, "docker"),
    PATH: `${binDir}:${process.env.PATH ?? ""}`,
  };

  function run(args: string[], expected = 0) {
    const result = Bun.spawnSync([binary, ...args], {
      cwd: workspace,
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    assert(
      result.exitCode === expected,
      `${args.join(" ")}: exit ${result.exitCode}, expected ${expected}\n${result.stderr}`,
    );
    return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  }

  function command(document: string, marker: string, expected = 0) {
    const result = Bun.spawnSync(["sh", "-eu", "-c", markedCommand(page(document), marker)], {
      cwd: workspace,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    assert(
      result.exitCode === expected,
      `${marker}: exit ${result.exitCode}, expected ${expected}\n${result.stderr}`,
    );
    checks.push(`executed ${marker} fence, exit ${expected}`);
    return result.stdout.toString();
  }

  const commands = parseReference(
    JSON.parse(readFileSync(join(root, "reference/cli.json"), "utf8")),
  );
  for (const cmd of commands) {
    const help = run([...cmd.path.split(" ").slice(1), "--help"]).stdout;
    const flagsStart = help.indexOf("\nFlags:\n");
    assert(flagsStart >= 0, `${cmd.path} help has no flag section`);
    const actual = [...help.slice(flagsStart).matchAll(/^\s+(?:-\w,\s+)?--([a-z][a-z0-9-]*)\b/gmu)]
      .map((match) => match[1])
      .sort();
    const expected = [...(cmd.flags ?? []), ...(cmd.inherited_flags ?? [])]
      .map((flag) => flag.name)
      .sort();
    assert(JSON.stringify(actual) === JSON.stringify(expected), `${cmd.path} flags differ`);
  }
  checks.push(`all ${commands.length} command help surfaces match exported public flags`);

  const explanation = run([
    "explain",
    "architecture",
    "aws_subnet.application",
    "--input",
    "architecture.json",
    "--format",
    "json",
  ]);
  assert(
    explanation.stdout.includes("aws_subnet.application") &&
      explanation.stdout.includes("aws.rule.subnet"),
    "saved-document explanation lost source or Rule",
  );
  checks.push("saved architecture explains subnet source and owner-first Rule");

  const explanationText = run([
    "explain",
    "architecture",
    "aws_subnet.application",
    "--input",
    "architecture.json",
  ]).stdout.trim();
  assert(
    fencedBlock(
      page("getting-started/first-architecture.md"),
      "text",
      "Subnet explanation excerpt",
    ).trim() === explanationText,
    "displayed subnet explanation differs from command",
  );
  checks.push("first architecture explanation matches displayed output");

  const policyPage = page("guides/check-architecture.md");
  const pack = configuration(policyPage, "policies/pack.rf.hcl");
  const policySource = configuration(policyPage, "policies/subnet-network-context.rf.hcl");
  const orphanSource = configuration(policyPage, "orphan.tf");
  const unresolvedSource = configuration(policyPage, "unresolved.tf");
  const noSubnetSource = configuration(policyPage, "no-subnet/main.tf");
  mkdirSync(join(workspace, "policies"));
  writeFileSync(join(workspace, "policies/pack.rf.hcl"), pack);
  writeFileSync(join(workspace, "policies/subnet-network-context.rf.hcl"), policySource);

  const passed = command("guides/check-architecture.md", "policy-local").trim();
  assert(
    fencedBlock(policyPage, "text", "Passed check").trim() === passed,
    "displayed compliant result differs from command",
  );
  command("guides/check-architecture.md", "policy-architecture");

  writeFileSync(join(workspace, "orphan.tf"), orphanSource);
  const violated = command("guides/check-architecture.md", "policy-violation", 1).trim();
  assert(
    fencedBlock(policyPage, "text", "Mixed check with violation").trim() === violated,
    "displayed violation result differs from command",
  );
  const omitted = command("guides/check-architecture.md", "policy-violation-explain").trim();
  assert(
    fencedBlock(policyPage, "text", "Proven omission").trim() === omitted,
    "displayed proven omission differs from architecture explanation",
  );
  command("guides/check-architecture.md", "policy-remove-violation");
  assert(!existsSync(join(workspace, "orphan.tf")), "violation scenario was not restored");

  writeFileSync(join(workspace, "unresolved.tf"), unresolvedSource);
  const indeterminate = command("guides/check-architecture.md", "policy-indeterminate", 3).trim();
  assert(
    indeterminate.startsWith(fencedBlock(policyPage, "text", "Mixed indeterminate check").trim()),
    "displayed indeterminate summary differs from command",
  );
  command("guides/check-architecture.md", "policy-remove-indeterminate");
  assert(!existsSync(join(workspace, "unresolved.tf")), "indeterminate scenario was not restored");

  const noneSelected = command("guides/check-architecture.md", "policy-none", 3).trim();
  assert(
    fencedBlock(policyPage, "text", "No Policy Pack selected").trim() === noneSelected,
    "displayed no-selection result differs from command",
  );

  mkdirSync(join(workspace, "no-subnet"));
  writeFileSync(join(workspace, "no-subnet/main.tf"), noSubnetSource);
  const noTarget = command("guides/check-architecture.md", "policy-no-target", 3).trim();
  assert(
    fencedBlock(policyPage, "text", "Selected Policy without a target").trim() === noTarget,
    "displayed no-target result differs from command",
  );
  command("guides/check-architecture.md", "policy-remove-no-target");
  assert(!existsSync(join(workspace, "no-subnet")), "no-target scenario was not restored");

  command("guides/check-architecture.md", "policy-show");
  command("guides/check-architecture.md", "policy-json");
  const policy = JSON.parse(read("policy-result.json").toString());
  assert(
    policy.summary.evaluations === 1 &&
      policy.summary.passed === 1 &&
      policy.evaluations[0]?.policy === "tutorial.policy.subnet-network-context",
    "tutorial Policy identity or result changed",
  );
  const architectureExplanation = command(
    "guides/check-architecture.md",
    "policy-explain-architecture",
  ).trim();
  assert(
    architectureExplanation ===
      fencedBlock(
        page("getting-started/first-architecture.md"),
        "text",
        "Subnet explanation excerpt",
      ).trim(),
    "Policy guide architecture explanation differs from saved evidence",
  );
  assert(read("main.tf").equals(original), "documentation checks mutated Terraform source");
  checks.push("Policy pass, indeterminate, not_evaluated, and violation remain distinct");

  const ciOutput = join(workspace, "ci-output");
  const ci = Bun.spawnSync(["sh", join(root, "docs/integrations/ci/rootform-ci.sh")], {
    cwd: workspace,
    env: {
      ...env,
      ROOTFORM_BIN: binary,
      ROOTFORM_OUTPUT_DIR: ciOutput,
      ROOTFORM_POLICY_PACK: join(workspace, "policies"),
      ROOTFORM_PROJECT: workspace,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  assert(ci.exitCode === 0, `CI example failed: ${ci.stderr}`);
  const ciPolicy = JSON.parse(readFileSync(join(ciOutput, "check.json"), "utf8"));
  assert(
    ciPolicy.summary?.policies === 1 && ciPolicy.summary?.passed === 1,
    "CI example lost selected local Policy Pack coverage",
  );
  checks.push("portable CI script builds and preserves selected Policy result");

  const diffPage = page("guides/compare-architectures.md");
  command("guides/compare-architectures.md", "diff-base");
  writeFileSync(join(workspace, "database.tf"), configuration(diffPage, "database.tf"));
  command("guides/compare-architectures.md", "diff-head");
  const diffText = command("guides/compare-architectures.md", "diff-text").trim();
  const displayedDiff = fencedBlock(diffPage, "text", "Diff output").trim();
  assert(diffText === displayedDiff, "displayed Diff output differs from command");
  assert(
    command("guides/compare-architectures.md", "diff-exit", 1).trim() === diffText,
    "--exit-code changed Diff report",
  );
  assert(
    command("guides/compare-architectures.md", "diff-identical").trim() ===
      "Architecture unchanged",
    "identical Diff result changed",
  );
  command("guides/compare-architectures.md", "diff-json");
  command("guides/compare-architectures.md", "diff-markdown");
  const delta = JSON.parse(read("delta.json").toString());
  assert(
    delta.summary?.representations?.added === 1 &&
      delta.summary?.contexts?.added === 1 &&
      delta.undetermined?.length === 0,
    "documented Diff summary changed",
  );
  assert(
    read("architecture-diff.md").toString().startsWith("## Rootform diff\n"),
    "Markdown Diff report was not written",
  );
  checks.push("Diff tutorial reports one representation and one network context");
  return checks;
}
