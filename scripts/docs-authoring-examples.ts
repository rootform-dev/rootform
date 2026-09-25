import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { configuration, markedCommand } from "./docs-core-examples.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs authoring example: ${message}`);
}

export function verifyAuthoringExamples(
  binary: string,
  root: string,
  workspace: string,
  home: string,
): string[] {
  const suite = join(workspace, "authoring");
  mkdirSync(suite, { recursive: true });
  mkdirSync(join(home, "docker"), { recursive: true });
  writeFileSync(join(home, "docker/config.json"), "{}\n");
  const environment = {
    ...process.env,
    ROOTFORM_HOME: home,
    ROOTFORM_INPUT: "0",
    DOCKER_CONFIG: join(home, "docker"),
    PATH: `${dirname(binary)}:${process.env.PATH ?? ""}`,
  };
  const page = (path: string) => readFileSync(join(root, "docs", path), "utf8");
  const main = readFileSync(join(root, "examples/aws-vpc/main.tf"), "utf8");
  const lock = (dir: string) => readFileSync(join(dir, "rootform.lock"));

  function run(command: string[], cwd: string, expected = 0, env = environment) {
    const result = Bun.spawnSync(command, {
      cwd,
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();
    assert(
      result.exitCode === expected,
      `${command.join(" ")} exited ${result.exitCode}, expected ${expected}\n${stdout}${stderr}`,
    );
    return { stdout, stderr };
  }

  function marked(document: string, marker: string, cwd: string, expected = 0, env = environment) {
    return run(["sh", "-eu", "-c", markedCommand(page(document), marker)], cwd, expected, env);
  }

  function project(name: string): string {
    const dir = join(suite, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "main.tf"), main);
    return dir;
  }

  function tutorial(dir: string): void {
    const guide = page("guides/check-architecture.md");
    mkdirSync(join(dir, "policies"), { recursive: true });
    for (const name of ["pack.rf.hcl", "subnet-network-context.rf.hcl"]) {
      writeFileSync(join(dir, "policies", name), configuration(guide, `policies/${name}`));
    }
  }

  function payments(dir: string): void {
    const destination = join(dir, "dialects/payments");
    mkdirSync(destination, { recursive: true });
    cpSync(
      join(root, "dialects/secrets/presentation.json"),
      join(destination, "presentation.json"),
    );
    const declaration = readFileSync(join(root, "dialects/secrets/dialect.rf.hcl"), "utf8");
    assert(declaration.includes('dialect "secrets"'), "payments source fixture changed");
    writeFileSync(
      join(destination, "dialect.rf.hcl"),
      declaration.replace('dialect "secrets"', 'dialect "payments"'),
    );
  }

  // The authoring commands run from the Dialect source root. The selected local
  // owner makes fixture tests exercise that source instead of embedded AWS.
  const authoring = join(suite, "dialect-authoring");
  mkdirSync(join(authoring, "network"), { recursive: true });
  const dialectPage = page("dialect-authoring.md");
  writeFileSync(
    join(authoring, "dialect.rf.hcl"),
    configuration(dialectPage, "aws/dialect.rf.hcl"),
  );
  writeFileSync(
    join(authoring, "network/vpc.rf.hcl"),
    configuration(dialectPage, "aws/network/vpc.rf.hcl"),
  );
  run(["git", "init", "--quiet"], authoring);
  run(["git", "config", "user.name", "Rootform docs"], authoring);
  run(["git", "config", "user.email", "docs@example.invalid"], authoring);
  run([binary, "add", "dialects", ".", "--replace"], authoring);
  const definitions = marked("dialect-authoring.md", "docs-dialect-authoring-1", authoring);
  assert(
    definitions.stdout.includes("aws.rule.subnet") &&
      definitions.stdout.includes("rf.concept.subnet"),
    "Dialect definitions were not inspected",
  );
  const fixture = join(authoring, "fixtures/example/minimal");
  mkdirSync(fixture, { recursive: true });
  writeFileSync(join(fixture, "main.tf"), main);
  run(
    [
      binary,
      "build",
      fixture,
      "--format",
      "json",
      "--output",
      join(fixture, "architecture.golden"),
    ],
    authoring,
  );
  const tests = marked("dialect-authoring.md", "docs-dialect-authoring-2", authoring);
  assert(
    (tests.stdout.match(/Tests passed\n1 case/gu) ?? []).length === 2,
    `Dialect fixture case did not run twice: ${tests.stdout}${tests.stderr}`,
  );
  payments(authoring);
  run(["git", "add", "."], authoring);
  run(["git", "commit", "--quiet", "-m", "reviewed dialect fixture"], authoring);
  const packagedDialect = marked("dialect-authoring.md", "docs-dialect-authoring-3", authoring);
  assert(
    packagedDialect.stdout.includes("payments") && existsSync(join(authoring, "artifacts/oci")),
    "Dialect package was not created locally",
  );

  const policyRoot = join(suite, "policy-authoring");
  mkdirSync(policyRoot);
  const policyPage = page("language/write-policy-pack.md");
  const baseline = join(policyRoot, "baseline");
  cpSync(join(root, "policy-packs/baseline"), baseline, { recursive: true });
  for (const name of [
    "pack.rf.hcl",
    "policies/cluster-network-context.rf.hcl",
    "policies/managed-database-network-context.rf.hcl",
  ]) {
    assert(
      readFileSync(join(baseline, name), "utf8") ===
        configuration(policyPage, `policy-packs/baseline/${name}`),
      `documented baseline source differs: ${name}`,
    );
  }
  const example = join(policyRoot, "example");
  mkdirSync(example);
  writeFileSync(
    join(example, "main.tf"),
    'terraform {\n  required_providers {\n    google = {\n      source  = "hashicorp/google"\n      version = "= 8.0.0"\n    }\n  }\n}\n\nresource "google_compute_network" "main" {\n  name = "main"\n}\n\nresource "google_container_cluster" "example" {\n  name    = "example"\n  network = google_compute_network.main.id\n}\n\nresource "google_sql_database_instance" "example" {\n  name = "example"\n  settings {\n    ip_configuration {\n      private_network = google_compute_network.main.id\n    }\n  }\n}\n',
  );
  const originalLock = existsSync(join(policyRoot, "rootform.lock"));
  const localPolicy = marked(
    "language/write-policy-pack.md",
    "docs-language-write-policy-pack-1",
    policyRoot,
  );
  assert(
    localPolicy.stdout.includes("Policies compliant") &&
      localPolicy.stdout.includes("baseline.policy.cluster-network-context") &&
      !originalLock &&
      !existsSync(join(policyRoot, "rootform.lock")),
    "baseline local override did not evaluate or changed the lock",
  );
  run([binary, "build", "./example", "--output", "architecture.json"], policyRoot);
  const compiled = marked(
    "language/write-policy-pack.md",
    "docs-language-write-policy-pack-2",
    policyRoot,
  );
  assert(
    compiled.stdout.includes("Policies compliant") &&
      existsSync(join(policyRoot, "baseline.compiled.json")),
    "compiled baseline did not evaluate the same architecture",
  );
  run(["git", "init", "--quiet"], policyRoot);
  run(["git", "config", "user.name", "Rootform docs"], policyRoot);
  run(["git", "config", "user.email", "docs@example.invalid"], policyRoot);
  run(["git", "add", "."], policyRoot);
  run(["git", "commit", "--quiet", "-m", "reviewed policy pack"], policyRoot);
  const packagedPack = marked(
    "language/write-policy-pack.md",
    "docs-language-write-policy-pack-3",
    policyRoot,
  );
  assert(
    packagedPack.stdout.includes("baseline") && existsSync(join(policyRoot, "artifacts/policies")),
    "Policy Pack package was not created locally",
  );

  const policyProject = project("check-architecture");
  tutorial(policyProject);
  marked("guides/check-architecture.md", "docs-guides-check-architecture-1", policyProject);
  const report = JSON.parse(readFileSync(join(policyProject, "policy-result.sarif"), "utf8"));
  assert(
    report.version === "2.1.0" &&
      report.runs?.[0]?.tool?.driver?.rules?.[0]?.id === "tutorial.policy.subnet-network-context" &&
      report.runs[0].results?.length === 0,
    "SARIF did not record the passing subnet Policy",
  );
  marked("guides/check-architecture.md", "policy-adopt-pack", policyProject);
  const adopted = JSON.parse(lock(policyProject).toString());
  assert(
    adopted.policy_packs?.[0]?.name === "tutorial" &&
      adopted.policy_packs[0].source?.local?.path === "policies",
    "tutorial pack was not selected in the lock",
  );

  const external = project("external-content");
  payments(external);
  const added = marked("concepts/external-content.md", "external-content-1", external);
  assert(
    added.stdout.includes("dialect payments 0.1.0") &&
      JSON.parse(lock(external).toString()).dialects?.[0]?.source?.local?.path ===
        "dialects/payments",
    "external add did not select local payments",
  );
  const selectedLock = lock(external);
  const initialized = marked("concepts/external-content.md", "external-content-3", external);
  assert(
    initialized.stdout.includes("Project prepared") && lock(external).equals(selectedLock),
    "init changed the selected lock",
  );
  const replacement = project("external-replacement");
  mkdirSync(join(replacement, "dialects"));
  cpSync(join(root, "dialects/aws"), join(replacement, "dialects/aws"), { recursive: true });
  marked("concepts/external-content.md", "external-content-4", replacement);
  assert(
    JSON.parse(lock(replacement).toString()).replacements?.includes("aws"),
    "embedded AWS was not replaced",
  );
  tutorial(external);
  run([binary, "add", "policy-packs", "./policies"], external);
  const fullLock = lock(external);
  const filtered = marked("concepts/external-content.md", "external-content-5", external);
  assert(
    filtered.stdout.includes("Policies compliant") &&
      /Results\s+1 passed/u.test(filtered.stdout) &&
      lock(external).equals(fullLock),
    "filtered tutorial check did not pass or changed the lock",
  );

  const source = project("external-clone-source");
  payments(source);
  run([binary, "add", "dialects", "./dialects/payments"], source);
  run(["git", "init", "--quiet"], source);
  run(["git", "config", "user.name", "Rootform docs"], source);
  run(["git", "config", "user.email", "docs@example.invalid"], source);
  run(["git", "add", "."], source);
  run(["git", "commit", "--quiet", "-m", "selected local dialect"], source);
  const clone = join(suite, "external-clone");
  run(["git", "clone", "--quiet", source, clone], suite);
  const cloneLock = lock(clone);
  const cloneHome = join(suite, "fresh-clone-home");
  mkdirSync(join(cloneHome, "docker"), { recursive: true });
  writeFileSync(join(cloneHome, "docker/config.json"), "{}\n");
  const cloneResult = marked("guides/external-content.md", "external-init-clone", clone, 0, {
    ...environment,
    ROOTFORM_HOME: cloneHome,
    DOCKER_CONFIG: join(cloneHome, "docker"),
  });
  assert(
    cloneResult.stdout.includes("Project prepared") &&
      existsSync(join(clone, "architecture.json")) &&
      lock(clone).equals(cloneLock),
    "fresh clone did not prepare and build without lock mutation",
  );

  const local = project("local-dialect");
  payments(local);
  run([binary, "add", "dialects", "./dialects/payments"], local);
  cpSync(join(root, "dialects/aws"), join(local, "dialects/aws"), { recursive: true });
  marked("guides/local-dialect.md", "local-dialect-4", local);
  assert(
    JSON.parse(lock(local).toString()).replacements?.includes("aws"),
    "local AWS replacement was not recorded",
  );
  const beforeUpdate = JSON.parse(lock(local).toString()).dialects.find(
    (item: { owner: string }) => item.owner === "payments",
  );
  const paymentFile = join(local, "dialects/payments/dialect.rf.hcl");
  writeFileSync(
    paymentFile,
    readFileSync(paymentFile, "utf8").replace('version = "0.1.0"', 'version = "0.1.1"'),
  );
  marked("guides/local-dialect.md", "local-dialect-5", local);
  const afterUpdate = JSON.parse(lock(local).toString()).dialects.find(
    (item: { owner: string }) => item.owner === "payments",
  );
  assert(
    afterUpdate?.version === "0.1.1" &&
      afterUpdate?.content_digest !== beforeUpdate?.content_digest,
    "payments lock did not record edited source",
  );
  marked("guides/local-dialect.md", "local-dialect-7", local);
  assert(
    !JSON.parse(lock(local).toString()).dialects.some(
      (item: { owner: string }) => item.owner === "payments",
    ) && existsSync(paymentFile),
    "remove deleted payments source or kept selection",
  );

  const ci = join(suite, "ci-repository");
  mkdirSync(join(ci, "infra"), { recursive: true });
  mkdirSync(join(ci, "ci"));
  writeFileSync(join(ci, "infra/main.tf"), main);
  cpSync(join(root, "docs/integrations/ci/rootform-ci.sh"), join(ci, "ci/rootform-ci.sh"));
  marked("integrations/ci/README.md", "docs-integrations-ci-readme-1", ci);
  assert(
    existsSync(join(ci, ".rootform-ci/architecture.json")) &&
      existsSync(join(ci, ".rootform-ci/build.stderr")) &&
      !existsSync(join(ci, ".rootform-ci/check.status")),
    "build-only CI did not write architecture evidence",
  );
  tutorial(ci);
  run([binary, "add", "policy-packs", "../policies"], join(ci, "infra"));
  const ciLock = lock(join(ci, "infra"));
  marked("integrations/ci/README.md", "docs-integrations-ci-readme-2", ci);
  assert(
    readFileSync(join(ci, ".rootform-ci/check.status"), "utf8") === "0\n" &&
      JSON.parse(readFileSync(join(ci, ".rootform-ci/check.json"), "utf8")).summary?.passed === 1 &&
      lock(join(ci, "infra")).equals(ciLock),
    "locked CI Policy gate did not pass or changed lock",
  );
  marked("integrations/ci/README.md", "docs-integrations-ci-readme-4", ci);
  assert(
    existsSync(join(ci, ".rootform-ci/init.json")) &&
      existsSync(join(ci, ".rootform-ci/architecture.json")) &&
      !existsSync(join(ci, ".rootform-ci/check.status")) &&
      lock(join(ci, "infra")).equals(ciLock),
    "offline CI build changed lock or retained stale Policy status",
  );
  const ciOverride = join(suite, "ci-override");
  mkdirSync(join(ciOverride, "infra"), { recursive: true });
  mkdirSync(join(ciOverride, "ci"));
  writeFileSync(join(ciOverride, "infra/main.tf"), main);
  cpSync(join(ci, "ci/rootform-ci.sh"), join(ciOverride, "ci/rootform-ci.sh"));
  tutorial(ciOverride);
  marked("integrations/ci/README.md", "docs-integrations-ci-readme-3", ciOverride);
  assert(
    readFileSync(join(ciOverride, ".rootform-ci/check.status"), "utf8") === "0\n" &&
      JSON.parse(readFileSync(join(ciOverride, ".rootform-ci/check.json"), "utf8")).summary
        ?.passed === 1 &&
      !existsSync(join(ciOverride, "infra/rootform.lock")),
    "CI local pack override did not pass without a lock",
  );

  return [
    "Dialect definitions, fixture tests, and local package verified",
    "baseline Policy Pack override, compiled check, and local package verified",
    "tutorial SARIF and project selection verified",
    "external selection, init, replacement, filtered check, and fresh clone verified",
    "local Dialect replacement, update, and removal verified",
    "CI build, locked check, local override, and offline preparation verified",
  ];
}
