import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseReference } from "./generate-cli-reference.ts";

const fence = "```";
const ansiSgr = new RegExp(String.fromCharCode(27) + String.raw`\[[0-9;]*m`, "gu");

export function markedCommand(page: string, name: string): string {
  const marker = `<!-- docs-check:${name} -->`;
  const parts = page.split(marker);
  if (parts.length !== 2) throw new Error(`Expected one command marker: ${name}`);
  const match = new RegExp(`^\\s*${fence}sh\\n([\\s\\S]*?)\\n${fence}`).exec(parts[1] ?? "");
  if (!match?.[1]) throw new Error(`Expected shell block after ${name}`);
  return match[1];
}

function fencedBlock(page: string, language: string, title: string): string {
  const languages =
    language === "text"
      ? ["text", "ansi"]
      : language === "hcl" && title.endsWith(".rf.hcl")
        ? ["hcl", "rf"]
        : [language];
  const blocks = languages.flatMap((candidate) => {
    const opening = `${fence}${candidate} title="${title}"\n`;
    const parts = page.split(opening);
    return parts.length === 2 ? [parts[1]?.split(`\n${fence}`)[0]] : [];
  });
  if (blocks.length !== 1) throw new Error(`Expected one ${language} block: ${title}`);
  const body = blocks[0];
  if (!body) throw new Error(`Empty ${language} block: ${title}`);
  return `${body.replace(ansiSgr, "")}\n`;
}

export function configuration(page: string, title: string): string {
  return fencedBlock(page, "hcl", title);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs example: ${message}`);
}

export function assertHelpUsage(path: string, exported: string, help: string): void {
  const actual = /^Usage:\n\s+([^\n]+)/mu.exec(help)?.[1];
  assert(
    actual === exported,
    `${path} usage differs from public export: help ${JSON.stringify(actual)}, export ${JSON.stringify(exported)}`,
  );
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
    assertHelpUsage(cmd.path, cmd.usage, help);
    const flagsStart = help.indexOf("\nFlags:\n");
    assert(flagsStart >= 0, `${cmd.path} help has no flag section`);
    const actual = [...help.slice(flagsStart).matchAll(/^\s+(?:-\w,\s+)?--([a-z][a-z0-9-]*)\b/gmu)]
      .map((match) => match[1])
      .sort();
    const expected = [...(cmd.flags ?? []), ...(cmd.inherited_flags ?? [])]
      .map((flag) => flag.name)
      .sort();
    assert(JSON.stringify(actual) === JSON.stringify(expected), `${cmd.path} flags differ`);
    for (const flag of [...(cmd.flags ?? []), ...(cmd.inherited_flags ?? [])]) {
      if (["", "false", "[]"].includes(flag.default)) continue;
      const line = help
        .slice(flagsStart)
        .split("\n")
        .find((candidate) => new RegExp(`\\s--${flag.name}(?:\\s|$)`, "u").test(candidate));
      const value = flag.type === "string" ? JSON.stringify(flag.default) : flag.default;
      assert(line?.includes(`(default ${value})`), `${cmd.path} --${flag.name} default differs`);
    }
  }
  checks.push(
    `all ${commands.length} command help surfaces match usages, flags, and nonempty defaults`,
  );

  const dialectPage = page("concepts/dialects.md");
  const dialectList = command("concepts/dialects.md", "concept-dialect-list").trim();
  assert(
    dialectList === fencedBlock(dialectPage, "text", "AWS Dialect summary").trim(),
    "displayed AWS Dialect summary differs from command",
  );
  const dialectRule = command("concepts/dialects.md", "concept-dialect-show-rule").trim();
  assert(
    dialectRule === fencedBlock(dialectPage, "text", "Subnet Rule summary").trim(),
    "displayed subnet Rule summary differs from command",
  );
  checks.push("Dialect list and Rule inspection match displayed outputs");

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
  command("reference/cli/explain/architecture.md", "cli-explain-architecture");
  command("reference/cli/explain/semantics.md", "cli-explain-semantics");
  const semanticRule = JSON.parse(
    run(["explain", "semantics", "aws.rule.subnet", "--format", "json"]).stdout,
  );
  assert(
    semanticRule.rule?.id === "aws.rule.subnet" &&
      semanticRule.produced?.some(
        (entry: { declaration?: string }) => entry.declaration === "aws_subnet.application",
      ),
    "CLI semantics example did not explain the documented subnet",
  );

  const policyPage = page("guides/check-architecture.md");
  const pack = configuration(policyPage, "policies/pack.rf.hcl");
  const policySource = configuration(policyPage, "policies/subnet-network-context.rf.hcl");
  const instancePolicySource = configuration(
    policyPage,
    "policies/instance-explicit-subnet-context.rf.hcl",
  );
  const instancesSource = configuration(policyPage, "instances.tf");
  const unresolvedInstanceSource = configuration(policyPage, "unresolved-instance.tf");
  const noSubnetSource = configuration(policyPage, "no-subnet/main.tf");
  function ciCheck(label: string, expected: number, project = workspace, pack = true) {
    const output = join(workspace, `ci-${label}`);
    const result = Bun.spawnSync(["sh", join(root, "docs/integrations/ci/rootform-ci.sh")], {
      cwd: workspace,
      env: {
        ...env,
        ROOTFORM_BIN: binary,
        ROOTFORM_CHECK: "1",
        ROOTFORM_OUTPUT_DIR: output,
        ROOTFORM_PROJECT: project,
        ...(pack ? { ROOTFORM_POLICY_PACK: join(workspace, "policies") } : {}),
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    assert(
      result.exitCode === expected,
      `CI ${label}: exit ${result.exitCode}, expected ${expected}`,
    );
    assert(
      existsSync(join(output, "check.status")),
      `CI ${label} stopped before check: ${existsSync(join(output, "build.stderr")) ? readFileSync(join(output, "build.stderr"), "utf8") : result.stderr.toString()}`,
    );
    assert(
      readFileSync(join(output, "check.status"), "utf8") === `${expected}\n` &&
        existsSync(join(output, "architecture.json")) &&
        existsSync(join(output, "check.json")) &&
        existsSync(join(output, "check.stderr")),
      `CI ${label} did not preserve its reports and exact status`,
    );
    return JSON.parse(readFileSync(join(output, "check.json"), "utf8")) as Record<string, unknown>;
  }
  mkdirSync(join(workspace, "policies"));
  writeFileSync(join(workspace, "policies/pack.rf.hcl"), pack);
  writeFileSync(join(workspace, "policies/subnet-network-context.rf.hcl"), policySource);

  const passed = command("guides/check-architecture.md", "policy-local").trim();
  command("reference/cli/check.md", "cli-check");
  command("reference/cli/show/policy.md", "cli-show-policy");
  command("reference/cli/show/policy-pack.md", "cli-show-policy-pack");
  assert(
    fencedBlock(policyPage, "text", "Passed check").trim() === passed,
    "displayed compliant result differs from command",
  );
  command("guides/check-architecture.md", "policy-architecture");

  writeFileSync(
    join(workspace, "policies/instance-explicit-subnet-context.rf.hcl"),
    instancePolicySource,
  );
  writeFileSync(join(workspace, "instances.tf"), instancesSource);
  const violated = command("guides/check-architecture.md", "policy-violation", 1).trim();
  assert(ciCheck("violation", 1).status === "violated", "CI violation result changed");
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
  assert(!existsSync(join(workspace, "instances.tf")), "violation scenario was not restored");

  writeFileSync(join(workspace, "unresolved-instance.tf"), unresolvedInstanceSource);
  const indeterminate = command("guides/check-architecture.md", "policy-indeterminate", 3).trim();
  const unresolvedBuildOutput = join(workspace, "ci-unresolved-build");
  const unresolvedBuild = Bun.spawnSync(["sh", join(root, "docs/integrations/ci/rootform-ci.sh")], {
    cwd: workspace,
    env: {
      ...env,
      ROOTFORM_BIN: binary,
      ROOTFORM_CHECK: "1",
      ROOTFORM_OUTPUT_DIR: unresolvedBuildOutput,
      ROOTFORM_POLICY_PACK: join(workspace, "policies"),
      ROOTFORM_PROJECT: workspace,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  assert(
    unresolvedBuild.exitCode === 3 &&
      !existsSync(join(unresolvedBuildOutput, "check.status")) &&
      readFileSync(join(unresolvedBuildOutput, "build.stderr"), "utf8").includes(
        "TRAVERSAL_UNRESOLVED",
      ),
    "CI indeterminate build was mislabeled as a Policy verdict",
  );
  assert(
    indeterminate.startsWith(fencedBlock(policyPage, "text", "Mixed indeterminate check").trim()),
    "displayed indeterminate summary differs from command",
  );
  command("guides/check-architecture.md", "policy-remove-indeterminate");
  assert(
    !existsSync(join(workspace, "unresolved-instance.tf")) &&
      !existsSync(join(workspace, "policies/instance-explicit-subnet-context.rf.hcl")),
    "indeterminate scenario was not restored",
  );

  const noneSelected = command("guides/check-architecture.md", "policy-none", 3).trim();
  assert(
    ciCheck("no-selection", 3, workspace, false).status === "not_evaluated",
    "CI empty selection changed",
  );
  assert(
    fencedBlock(policyPage, "text", "No Policy Pack selected").trim() === noneSelected,
    "displayed no-selection result differs from command",
  );

  mkdirSync(join(workspace, "no-subnet"));
  writeFileSync(join(workspace, "no-subnet/main.tf"), noSubnetSource);
  const noTarget = command("guides/check-architecture.md", "policy-no-target", 3).trim();
  assert(
    ciCheck("no-target", 3, join(workspace, "no-subnet")).status === "not_evaluated",
    "CI no-target result changed",
  );
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
  checks.push(
    "resolved, omitted, and unresolved instance subnet evidence produce pass, violation, and indeterminate outcomes",
  );

  const ciPolicy = ciCheck("compliant", 0);
  assert(
    (ciPolicy.summary as Record<string, unknown>)?.policies === 1 &&
      (ciPolicy.summary as Record<string, unknown>)?.passed === 1,
    "CI example lost selected local Policy Pack coverage",
  );
  checks.push(
    "portable CI script preserves pass, violation, zero-selection, no-target, and indeterminate build results",
  );

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
