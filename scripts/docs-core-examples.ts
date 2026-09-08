import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

export function configuration(page: string, title: string): string {
  const opening = `${fence}hcl title="${title}"\n`;
  const parts = page.split(opening);
  if (parts.length !== 2) throw new Error(`Expected one configuration block: ${title}`);
  const body = parts[1]?.split(`\n${fence}`)[0];
  if (!body) throw new Error(`Empty configuration block: ${title}`);
  return `${body}\n`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs example: ${message}`);
}

// Synthetic instances follow the public show -json plan shape. No raw plan is stored.
export function createPlan() {
  const provider = "registry.terraform.io/hashicorp/aws";
  const resources = [
    {
      address: "aws_vpc.main",
      type: "aws_vpc",
      name: "main",
      values: { cidr_block: "10.20.0.0/16" },
    },
    {
      address: "aws_subnet.application",
      type: "aws_subnet",
      name: "application",
      values: { cidr_block: "10.20.1.0/24" },
    },
  ];
  return {
    format_version: "1.2",
    terraform_version: "1.12.2",
    planned_values: {
      root_module: {
        resources: resources.map((resource) => ({
          ...resource,
          mode: "managed",
          provider_name: provider,
          schema_version: 1,
          sensitive_values: {},
        })),
      },
    },
    resource_changes: resources.map(({ values, ...resource }) => ({
      ...resource,
      mode: "managed",
      provider_name: provider,
      change: {
        actions: ["create"],
        before: null,
        after: values,
        after_unknown: { id: true },
        before_sensitive: false,
        after_sensitive: {},
      },
    })),
    configuration: {
      provider_config: {
        aws: { name: "aws", full_name: provider, version_constraint: "= 6.62.0" },
      },
      root_module: {
        resources: resources.map(({ values, ...resource }) => ({
          ...resource,
          mode: "managed",
          provider_config_key: "aws",
          schema_version: 1,
          expressions: {
            cidr_block: { constant_value: values.cidr_block },
            ...(resource.type === "aws_subnet"
              ? {
                  vpc_id: { references: ["aws_vpc.main.id", "aws_vpc.main"] },
                }
              : {}),
          },
        })),
      },
    },
  };
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
  const lock = read("rootform.lock");
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
  function run(args: string[], expected = 0, input?: string) {
    const result = Bun.spawnSync([binary, ...args], {
      cwd: workspace,
      env,
      stdin: input === undefined ? "ignore" : Buffer.from(input),
      stdout: "pipe",
      stderr: "pipe",
    });
    assert(
      result.exitCode === expected,
      args.join(" ") +
        ": exit " +
        result.exitCode +
        ", expected " +
        expected +
        "\n" +
        result.stderr,
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
  const metadata = JSON.parse(readFileSync(join(root, "reference/verification.json"), "utf8"));
  assert(
    metadata.cli_reference_sha256 ===
      createHash("sha256")
        .update(readFileSync(join(root, "reference/cli.json")))
        .digest("hex"),
    "verification metadata refers to another CLI export",
  );
  assert(
    run(["version"]).stdout.trim() === `rootform ${metadata.binary.version}`,
    "binary version differs from reference verification edition",
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
    assert(
      JSON.stringify(actual) === JSON.stringify(expected),
      `${cmd.path} binary flags differ from generated reference`,
    );
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
      explanation.stdout.includes("aws/subnet"),
    "saved-document explanation lost source or rule",
  );
  checks.push("saved architecture explains subnet source and rule");

  const policyPage = page("guides/check-architecture.md");
  const pack = configuration(policyPage, "policies/pack.rf");
  mkdirSync(join(workspace, "policies"));
  writeFileSync(join(workspace, "policies/pack.rf"), pack);
  const passed =
    command("guides/check-architecture.md", "policy-local").trim().split("\n")[0] ?? "";
  assert(
    policyPage.includes(`${fence}text\n${passed}\n${fence}`),
    `displayed policy result differs from observed stdout: ${JSON.stringify(passed)}`,
  );
  command("guides/check-architecture.md", "policy-show");
  command("guides/check-architecture.md", "policy-json");
  const policy = JSON.parse(read("policy-result.json").toString());
  assert(
    policy.summary.evaluations === 1 &&
      policy.summary.passed === 1 &&
      policy.summary.violated === 0 &&
      policy.summary.indeterminate === 0,
    "tutorial policy did not evaluate and pass once",
  );
  assert(
    policy.evaluations[0]?.policy === "tutorial/subnet-network-context" &&
      policy.evaluations[0]?.target === "scope:aws_subnet.application",
    "policy identity or target changed",
  );
  const noPack = JSON.parse(run(["check", "architecture.json", "--format", "json"]).stdout);
  const noPackText = run(["check", "architecture.json"]).stdout.trim().split("\n")[0];
  assert(
    page("concepts/policies.md").includes(`${fence}text\n${noPackText}\n${fence}`),
    "displayed zero-policy result differs from the real command",
  );
  assert(
    noPack.summary.policies === 0 && noPack.summary.evaluations === 0,
    "no-pack check no longer has explicit zero scope",
  );
  writeFileSync(
    join(workspace, "policies/pack.rf"),
    pack.replace("target = concept.core.subnet", "target = concept.core.managed-database"),
  );
  const noTarget = JSON.parse(
    run(["check", ".", "--policy-pack", "./policies", "--format", "json"]).stdout,
  );
  assert(
    noTarget.summary.policies === 1 && noTarget.summary.evaluations === 0,
    "selected policy without a target must remain distinct from no policies",
  );
  writeFileSync(
    join(workspace, "policies/pack.rf"),
    pack.replace(/assert = [^\n]+/u, "assert = false"),
  );
  const violation = JSON.parse(
    run(["check", ".", "--policy-pack", "./policies", "--format", "json"], 1).stdout,
  );
  assert(
    violation.summary.violated === 1 && violation.violations[0]?.path === "pack.rf",
    "violation must identify pack assertion and target",
  );
  const sarif = JSON.parse(
    run(["check", ".", "--policy-pack", "./policies", "--format", "sarif"], 1).stdout,
  );
  assert(sarif.runs[0]?.results[0]?.level === "error", "SARIF violation severity changed");
  writeFileSync(
    join(workspace, "policies/pack.rf"),
    pack.replace('core = "0.1.0"', 'core = "9.9.9"'),
  );
  const unavailable = JSON.parse(
    run(["check", ".", "--policy-pack", "./policies", "--format", "json"], 3).stdout,
  );
  assert(
    unavailable.diagnostics.length > 0,
    "incompatible policy requirement cannot silently pass",
  );
  writeFileSync(join(workspace, "policies/pack.rf"), pack);
  checks.push(
    "policy violation/indeterminate exits, assertion location and both zero-evaluation cases",
  );

  command("guides/compare-architectures.md", "diff-base");
  writeFileSync(
    join(workspace, "database.tf"),
    configuration(page("guides/compare-architectures.md"), "database.tf"),
  );
  command("guides/compare-architectures.md", "diff-head");
  const delta = command("guides/compare-architectures.md", "diff-text").trim();
  assert(
    page("guides/compare-architectures.md").includes(`${fence}text\n${delta}\n${fence}`),
    "displayed Diff differs from actual stdout",
  );
  assert(
    command("guides/compare-architectures.md", "diff-exit", 1).trim() === delta,
    "difference status changed the report",
  );
  assert(
    command("guides/compare-architectures.md", "diff-identical").trim() ===
      "no architectural change",
    "identical architecture comparison changed",
  );
  command("guides/compare-architectures.md", "diff-json");
  const firstDelta = read("delta.json");
  const diff = JSON.parse(firstDelta.toString());
  assert(
    diff.summary.representations.added === 1 &&
      diff.summary.contexts.added === 1 &&
      diff.undetermined.length === 0,
    "new subnet no longer adds exactly one representation and context",
  );
  run(["diff", "before.json", "after.json", "--format", "json", "--output", "delta.json"]);
  assert(firstDelta.equals(read("delta.json")), "Diff JSON is not deterministic");
  rmSync(join(workspace, "database.tf"));
  assert(read("main.tf").equals(original), "example mutated original Terraform source");

  const plan = JSON.stringify(createPlan());
  writeFileSync(join(workspace, "tfplan.json"), plan);
  command("inputs/plans.md", "plan-build");
  const planned = read("planned.json");
  command("inputs/plans.md", "plan-html");
  assert(
    read("planned.html").toString().toLowerCase().includes("<!doctype html>") &&
      !read("planned.html").includes("10.20."),
    "planned HTML lost its export shell or leaked plan values",
  );
  const planPolicy = JSON.parse(
    run(["check", "--plan", "tfplan.json", "--policy-pack", "./policies", "--format", "json"])
      .stdout,
  );
  assert(
    planPolicy.summary.evaluations === 1 && planPolicy.summary.passed === 1,
    "plan policy did not evaluate the planned subnet",
  );
  assert(!planned.includes("10.20."), "plan values leaked into architecture");
  assert(
    run(["diff", "architecture.json", "planned.json", "--exit-code"]).stdout.trim() ===
      "no architectural change",
    "plan and tutorial source no longer establish the same architecture",
  );
  run(["build", "--plan", "tfplan.json", "--output", "planned.json"]);
  assert(planned.equals(read("planned.json")), "plan architecture is not deterministic");
  const planText = command("inputs/plans.md", "plan-diff-text");
  command("inputs/plans.md", "plan-diff-json");
  assert(
    run(["diff", "--plan", "-", "--exit-code"], 1, plan).stdout === planText,
    "stdin plan or difference status changed comparison",
  );
  const planDiff = JSON.parse(run(["diff", "--plan", "tfplan.json", "--format", "json"]).stdout);
  assert(
    planDiff.summary.representations.added === 2 &&
      planDiff.summary.contexts.added === 1 &&
      planDiff.undetermined.length === 0,
    "create plan must compare empty before to two scopes and one context",
  );
  const create = createPlan();
  const update = {
    ...create,
    prior_state: { format_version: "1.0", values: create.planned_values },
    resource_changes: create.resource_changes.map((resource, index) => ({
      ...resource,
      change: {
        ...resource.change,
        actions: [index === 0 ? "no-op" : "update"],
        before: resource.change.after,
      },
    })),
  };
  const updateJSON = run(
    ["diff", "--plan", "-", "--format", "json"],
    0,
    JSON.stringify(update),
  ).stdout;
  const updateDiff = JSON.parse(updateJSON);
  assert(
    updateDiff.undetermined.length > 0 && updateDiff.summary.contexts.undetermined > 0,
    "unreconstructable before context must stay undetermined",
  );
  assert(
    updateDiff.changes.length === 0,
    "unavailable before evidence must not invent a determined addition or removal",
  );
  assert(
    run(["diff", "--plan", "-", "--format", "json", "--exit-code"], 1, JSON.stringify(update))
      .stdout === updateJSON,
    "undetermined facts are a nonempty comparison with difference status",
  );
  const refusals = [
    ["PK\u0003\u0004synthetic", "a saved plan, which is binary"],
    [
      '{"@level":"info","type":"planned_change"}\n{"@level":"info","type":"change_summary"}',
      "a machine event stream",
    ],
    ['{"format_version":"1.0","values":{"root_module":{"resources":[]}}}', "a state document"],
    ["{", "not JSON"],
    ['{"example":true}', "not a plan"],
  ] as const;
  for (const [input, expected] of refusals) {
    assert(
      run(["diff", "--plan", "-"], 3, input).stderr.includes(expected),
      "plan refusal lost input classification",
    );
  }
  assert(
    run(["diff", "--plan", "absent-plan.json"], 3).stderr.includes("the plan could not be read"),
    "missing plan failure changed",
  );
  run(["diff", "--plan", "tfplan.json", "architecture.json"], 2);
  checks.push(
    "synthetic show-JSON plan: source parity, value suppression, deterministic create Diff, stdin, exits, six refusal cases",
  );

  command("guides/reproduce-build.md", "baseline");
  assert(
    command("guides/reproduce-build.md", "offline").trim() === "no architectural change",
    "offline repetition changed architecture",
  );
  assert(read("before.json").equals(read("after.json")), "offline architecture bytes changed");
  command("guides/reproduce-build.md", "vendor");
  assert(
    command("guides/reproduce-build.md", "empty-home").trim() === "no architectural change",
    "vendor cannot reproduce from empty home",
  );
  assert(read("before.json").equals(read("vendored.json")), "vendor architecture bytes changed");
  const vendorDialect = ".rootform/dialects/aws/dialect.rf";
  const good = read(vendorDialect);
  writeFileSync(
    join(workspace, vendorDialect),
    good.toString().replace('version = "0.1.0"', 'version = "9.9.9"'),
  );
  run(["build", ".", "--locked", "--offline", "--no-input"], 3);
  run(["vendor", "dialects", "--offline"]);
  assert(read(vendorDialect).equals(good), "explicit vendor repair did not restore exact source");
  assert(read("rootform.lock").equals(lock), "core examples changed the project lock");
  checks.push(
    "vendor is exclusive, damage fails closed, explicit offline repair restores content and preserves lock",
  );
  return checks;
}
