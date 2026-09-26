import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { configuration, markedCommand } from "./docs-core-examples.ts";

const ansiEscape = new RegExp(String.fromCharCode(27) + String.raw`\[[0-9;]*m`, "gu");

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Docs authoring: ${message}`);
}

export async function verifyAuthoringExamples(binary: string, root: string): Promise<string> {
  const base = mkdtempSync(join(tmpdir(), "rootform-docs-authoring-"));
  /* Marked commands call `rootform`; resolve it to the binary under test. */
  const toolDir = join(base, "bin");
  mkdirSync(toolDir, { recursive: true });
  symlinkSync(binary, join(toolDir, "rootform"));
  const read = (path: string) => readFileSync(join(root, "docs", path), "utf8");
  const fresh = (name: string) => {
    const dir = join(base, name);
    const home = join(dir, "home");
    mkdirSync(join(home, "docker"), { recursive: true });
    writeFileSync(join(home, "docker/config.json"), "{}\n");
    return { dir, home };
  };
  const environment = (home: string) => ({
    ...process.env,
    ROOTFORM_HOME: home,
    ROOTFORM_INPUT: "0",
    DOCKER_CONFIG: join(home, "docker"),
    PATH: `${toolDir}:${process.env.PATH ?? ""}`,
  });
  function run(args: string[], cwd: string, home: string, status = 0) {
    const result = Bun.spawnSync(args, {
      cwd,
      env: environment(home),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();
    if (process.env.ROOTFORM_DOCS_EVIDENCE_FILE) {
      appendFileSync(
        process.env.ROOTFORM_DOCS_EVIDENCE_FILE,
        `cwd: ${cwd}\ncommand: ${args.join(" ")}\nexit: ${result.exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}\n\n`,
      );
    }
    assert(
      result.exitCode === status,
      `${args.join(" ")} exited ${result.exitCode}, expected ${status}\n${stdout}${stderr}`,
    );
    return { stdout, stderr };
  }
  function marked(page: string, name: string, cwd: string, home: string, status = 0) {
    const output = run(["sh", "-eu", "-c", markedCommand(read(page), name)], cwd, home, status);
    const marker = `<!-- docs-output:${name} -->`;
    const document = read(page);
    if (document.includes(marker)) {
      const block = new RegExp(
        `${marker}\\s*\`\`\`(?:ansi|text) title="[^"]+"\\n([\\s\\S]*?)\\n\`\`\``,
      ).exec(document)?.[1];
      assert(block, `${page}: output excerpt missing after ${name}`);
      const actual = `${output.stdout}\n${output.stderr}`.replace(ansiEscape, "");
      let cursor = 0;
      for (const line of block.replace(ansiEscape, "").split("\n")) {
        if (!line) continue;
        const next = actual.indexOf(line, cursor);
        assert(next >= 0, `${page}: ${name} excerpt line missing or out of order: ${line}`);
        cursor = next + line.length;
      }
    }
    return output;
  }
  function commerce(dir: string) {
    const target = join(dir, "examples/playground/commerce-platform/head");
    mkdirSync(target, { recursive: true });
    for (const name of ["main.tf", "plan.json", "plan.tfplan", "rootform.lock"]) {
      cpSync(join(root, "examples/playground/commerce-platform/head", name), join(target, name));
    }
    cpSync(join(root, "policy-packs/baseline"), join(dir, "policy-packs/baseline"), {
      recursive: true,
    });
    cpSync(join(target, "plan.json"), join(dir, "plan.json"));
    cpSync(join(target, "plan.tfplan"), join(dir, "plan.tfplan"));
  }
  function payments(dir: string) {
    const target = join(dir, "dialects/payments");
    mkdirSync(target, { recursive: true });
    const source = readFileSync(join(root, "dialects/secrets/dialect.rf.hcl"), "utf8");
    writeFileSync(
      join(target, "dialect.rf.hcl"),
      source.replace('dialect "secrets"', 'dialect "payments"'),
    );
  }
  function policies(dir: string) {
    cpSync(join(root, "policy-packs/baseline"), join(dir, "policies"), { recursive: true });
  }
  function select(dir: string, home: string) {
    payments(dir);
    policies(dir);
    run([binary, "add", "dialects", "./dialects/payments"], dir, home);
    run([binary, "add", "policy-packs", "./policies"], dir, home);
  }

  const authoring = fresh("dialect");
  const dialectPage = read("dialect-authoring.md");
  writeFileSync(
    join(authoring.dir, "dialect.rf.hcl"),
    configuration(dialectPage, "aws/dialect.rf.hcl"),
  );
  mkdirSync(join(authoring.dir, "network"));
  writeFileSync(
    join(authoring.dir, "network/vpc.rf.hcl"),
    configuration(dialectPage, "aws/network/vpc.rf.hcl"),
  );
  marked("dialect-authoring.md", "docs-dialect-authoring-1", authoring.dir, authoring.home);
  const fixture = join(authoring.dir, "fixtures/example/minimal");
  mkdirSync(fixture, { recursive: true });
  for (const name of ["main.tf", "plan.json", "plan.tfplan"]) {
    cpSync(join(root, "examples/playground/commerce-platform/head", name), join(fixture, name));
  }
  marked("dialect-authoring.md", "docs-dialect-authoring-2", authoring.dir, authoring.home);
  assert(existsSync(join(fixture, "analysis.golden")), "Dialect fixture golden missing");
  const vocabulary = fresh("local-vocabulary");
  writeFileSync(
    join(vocabulary.dir, "dialect.rf.hcl"),
    'dialect "example" {\n  version = "0.1.0"\n  provider "hashicorp/aws" {\n    version = "= 6.62.0"\n  }\n}\n',
  );
  writeFileSync(
    join(vocabulary.dir, "vocabulary.rf.hcl"),
    configuration(dialectPage, "vocabulary.rf.hcl"),
  );
  run([binary, "validate", "dialects", vocabulary.dir], vocabulary.dir, vocabulary.home);

  const tour = read("language/tour.md");
  const tourCase = fresh("tour");
  const tourFiles: Array<[string, string]> = [
    ["aws/dialect.rf.hcl", "aws/dialect.rf.hcl"],
    ["aws/network/vpc.rf.hcl", "aws/network/vpc.rf.hcl"],
    ["google/vocabulary.rf.hcl", "google/vocabulary.rf.hcl"],
    [
      "google/load-balancing/application-load-balancer.rf.hcl",
      "google/load-balancing/application-load-balancer.rf.hcl",
    ],
    ["policies/pack.rf.hcl", "policies/pack.rf.hcl"],
    ["policies/subnet-network-context.rf.hcl", "policies/subnet-network-context.rf.hcl"],
  ];
  for (const [title, path] of tourFiles) {
    const dest = join(tourCase.dir, path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, configuration(tour, title));
  }
  writeFileSync(
    join(tourCase.dir, "google/dialect.rf.hcl"),
    'dialect "google" {\n  version = "0.1.0"\n  provider "hashicorp/google" {\n    version = "= 8.0.0"\n  }\n}\n',
  );
  run([binary, "validate", "dialects", "./aws"], tourCase.dir, tourCase.home);
  run([binary, "validate", "dialects", "./google"], tourCase.dir, tourCase.home);
  run([binary, "list", "policies", "--policy-pack", "./policies"], tourCase.dir, tourCase.home);

  const packCase = fresh("policy-pack");
  commerce(packCase.dir);
  for (const name of [
    "pack.rf.hcl",
    "policies/cluster-network-context.rf.hcl",
    "policies/managed-database-network-context.rf.hcl",
  ]) {
    assert(
      readFileSync(join(root, "policy-packs/baseline", name), "utf8") ===
        configuration(read("language/write-policy-pack.md"), `policy-packs/baseline/${name}`),
      `baseline source differs: ${name}`,
    );
  }
  marked(
    "language/write-policy-pack.md",
    "docs-language-write-policy-pack-1",
    packCase.dir,
    packCase.home,
  );
  marked(
    "language/write-policy-pack.md",
    "docs-language-write-policy-pack-2",
    packCase.dir,
    packCase.home,
  );
  assert(existsSync(join(packCase.dir, "baseline.compiled.json")), "compiled Policy Pack missing");
  const undecided = run(
    [
      binary,
      "run",
      "examples/playground/commerce-platform/head/plan.json",
      "--policy-pack",
      "./policy-packs/baseline",
      "--no-serve",
    ],
    packCase.dir,
    packCase.home,
    3,
  );
  assert(
    undecided.stdout.includes("Result     indeterminate"),
    "plan-only indeterminate outcome changed",
  );
  const noDecision = fresh("policy-no-decision");
  const event = join(root, "examples/playground/event-driven-platform/head");
  const noTarget = run(
    [
      binary,
      "run",
      join(event, "plan.json"),
      "--plan-file",
      join(event, "plan.tfplan"),
      "--policy-pack",
      join(root, "policy-packs/baseline"),
      "--no-serve",
    ],
    noDecision.dir,
    noDecision.home,
    3,
  );
  assert(noTarget.stdout.includes("Result     no decision"), "no-decision outcome changed");
  const violation = fresh("policy-violation");
  commerce(violation.dir);
  const violatedPack = join(violation.dir, "violated-pack");
  mkdirSync(violatedPack);
  writeFileSync(
    join(violatedPack, "pack.rf.hcl"),
    'policy_pack "review" {\n  version = "0.1.0"\n}\n',
  );
  writeFileSync(
    join(violatedPack, "require-network.rf.hcl"),
    'policy "require-network" {\n  target {\n    concept = rf.concept.kubernetes-cluster\n  }\n  assert = false\n  message = "Network context required."\n}\n',
  );
  const failed = run(
    [
      binary,
      "run",
      "examples/playground/commerce-platform/head/plan.json",
      "--plan-file",
      "examples/playground/commerce-platform/head/plan.tfplan",
      "--policy-pack",
      "./violated-pack",
      "--no-serve",
    ],
    violation.dir,
    violation.home,
    1,
  );
  assert(failed.stdout.includes("Result     violated"), "violation outcome changed");
  marked(
    "language/write-policy-pack.md",
    "docs-language-write-policy-pack-3",
    packCase.dir,
    packCase.home,
  );

  const packageCase = fresh("dialect-package");
  payments(packageCase.dir);
  marked("dialect-authoring.md", "docs-dialect-authoring-3", packageCase.dir, packageCase.home);

  const concept = fresh("external-concept");
  payments(concept.dir);
  marked("concepts/external-content.md", "external-content-1", concept.dir, concept.home);
  marked("concepts/external-content.md", "external-content-3", concept.dir, concept.home);
  const replacement = fresh("external-replacement");
  cpSync(join(root, "dialects/aws"), join(replacement.dir, "dialects/aws"), { recursive: true });
  marked("concepts/external-content.md", "external-content-4", replacement.dir, replacement.home);
  const filter = fresh("external-filter");
  commerce(filter.dir);
  policies(filter.dir);
  run([binary, "add", "policy-packs", "./policies"], filter.dir, filter.home);
  marked("concepts/external-content.md", "external-content-5", filter.dir, filter.home);

  const guide = fresh("external-guide");
  commerce(guide.dir);
  marked("guides/external-content.md", "external-local-scenario", guide.dir, guide.home);
  const demo = join(guide.dir, "content-demo");
  marked("guides/external-content.md", "external-add-local-pack", demo, guide.home);
  const originalLock = readFileSync(join(demo, "rootform.lock"));
  const policySource = join(demo, "policies/policies/cluster-network-context.rf.hcl");
  writeFileSync(
    policySource,
    readFileSync(policySource, "utf8").replace(
      "Kubernetes clusters must belong",
      "Selected clusters must belong",
    ),
  );
  marked("guides/external-content.md", "external-try-local", demo, guide.home);
  assert(readFileSync(join(demo, "rootform.lock")).equals(originalLock), "override changed lock");
  marked("guides/external-content.md", "external-update-local", demo, guide.home);
  assert(
    !readFileSync(join(demo, "rootform.lock")).equals(originalLock),
    "update did not change lock",
  );
  marked("guides/external-content.md", "external-remove", demo, guide.home);
  const guideDialect = fresh("external-guide-dialect");
  cpSync(join(root, "dialects/aws"), join(guideDialect.dir, "dialects/aws"), { recursive: true });
  for (const name of ["external-replace", "external-restore", "external-exclude"]) {
    marked("guides/external-content.md", name, guideDialect.dir, guideDialect.home);
  }
  const clone = fresh("external-clone");
  commerce(clone.dir);
  policies(clone.dir);
  run([binary, "add", "policy-packs", "./policies"], clone.dir, clone.home);
  marked("guides/external-content.md", "external-init-clone", clone.dir, clone.home);

  const reference = fresh("reference");
  commerce(reference.dir);
  select(reference.dir, reference.home);
  marked("reference/cli/list.md", "cli-list-selection", reference.dir, reference.home);
  marked(
    "reference/cli/list/dialects.md",
    "cli-list-dialect-owners",
    reference.dir,
    reference.home,
  );
  marked("reference/cli/list/policies.md", "cli-list-policies", reference.dir, reference.home);
  marked("reference/cli/list/policy-packs.md", "cli-list-packs", reference.dir, reference.home);
  marked("reference/cli/show.md", "cli-show", reference.dir, reference.home);
  marked("reference/cli/show/policy.md", "cli-show-policy", reference.dir, reference.home);
  marked(
    "reference/cli/show/policy-pack.md",
    "cli-show-policy-pack",
    reference.dir,
    reference.home,
  );
  const infra = join(reference.dir, "infra");
  mkdirSync(infra);
  cpSync(join(reference.dir, "rootform.lock"), join(infra, "rootform.lock"));
  cpSync(join(reference.dir, "dialects"), join(infra, "dialects"), { recursive: true });
  cpSync(join(reference.dir, "policies"), join(infra, "policies"), { recursive: true });
  marked("reference/cli/init.md", "cli-init", reference.dir, reference.home);
  marked("reference/cli/vendor.md", "cli-vendor", reference.dir, reference.home);
  marked(
    "reference/cli/vendor/policy-packs.md",
    "docs-reference-cli-vendor-policy-packs-1",
    reference.dir,
    reference.home,
  );
  const explanationPages: Array<[string, string]> = [
    ["reference/cli/explain/architecture.md", "cli-explain-architecture"],
    ["reference/cli/explain/policy.md", "cli-explain-policy"],
    ["reference/cli/explain/semantics.md", "cli-explain-semantics"],
    ["reference/cli/validate/architecture.md", "cli-validate-architecture"],
  ];
  for (const [page, name] of explanationPages) {
    const caseDir = fresh(name);
    commerce(caseDir.dir);
    marked(page, name, caseDir.dir, caseDir.home);
  }
  return "Authoring examples: Dialect, Policy Pack, tour, external content, and CLI commands verified";
}
