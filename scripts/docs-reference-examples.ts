import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { browserStub, configuration, markedCommand } from "./docs-core-examples.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs reference example: ${message}`);
}

type Result = { stdout: string; stderr: string };

export async function verifyReferenceExamples(
  binary: string,
  root: string,
  workspace: string,
  home: string,
): Promise<string[]> {
  const suite = join(workspace, "reference-examples");
  const noBrowser = browserStub(join(workspace, "reference-no-browser"));
  const environment = {
    ...process.env,
    ROOTFORM_HOME: home,
    ROOTFORM_INPUT: "0",
    DOCKER_CONFIG: join(home, "docker"),
    PATH: `${noBrowser}:${dirname(binary)}:${process.env.PATH ?? ""}`,
  };
  mkdirSync(suite, { recursive: true });
  mkdirSync(join(home, "docker"), { recursive: true });
  writeFileSync(join(home, "docker/config.json"), "{}\n");

  const page = (path: string) => readFileSync(join(root, "docs", path), "utf8");
  const source = readFileSync(join(root, "examples/aws-vpc/main.tf"));
  const database = configuration(page("guides/compare-architectures.md"), "database.tf");
  const run = (command: string[], cwd: string, expected = 0): Result => {
    const result = Bun.spawnSync(command, {
      cwd,
      env: environment,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    assert(
      result.exitCode === expected,
      `${command.join(" ")}: exit ${result.exitCode}, expected ${expected}\n${result.stderr}`,
    );
    return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  };
  const rootform = (cwd: string, ...args: string[]) => run([binary, ...args], cwd);
  const marked = (path: string, marker: string, cwd: string) =>
    run(["sh", "-eu", "-c", markedCommand(page(path), marker)], cwd);
  const project = (name: string) => {
    const directory = join(suite, name);
    mkdirSync(directory);
    writeFileSync(join(directory, "main.tf"), source);
    return directory;
  };
  const lock = (cwd: string) => readFileSync(join(cwd, "rootform.lock"));
  const checkLock = (cwd: string, original: Buffer) =>
    assert(lock(cwd).equals(original), `${cwd}: documented command changed rootform.lock`);
  const architecture = (path: string) => JSON.parse(readFileSync(path, "utf8"));
  const hasAddress = (
    document: { source?: { declarations?: Array<{ address?: string }> } },
    address: string,
  ) => document.source?.declarations?.some((entry) => entry.address === address) === true;

  function writeTutorialPack(cwd: string): void {
    mkdirSync(join(cwd, "policies"));
    const guide = page("guides/check-architecture.md");
    for (const file of ["pack.rf.hcl", "subnet-network-context.rf.hcl"]) {
      writeFileSync(join(cwd, "policies", file), configuration(guide, `policies/${file}`));
    }
  }

  function writePaymentsDialect(cwd: string): void {
    const destination = join(cwd, "dialects/payments");
    mkdirSync(destination, { recursive: true });
    cpSync(
      join(root, "dialects/secrets/presentation.json"),
      join(destination, "presentation.json"),
    );
    const declaration = readFileSync(join(root, "dialects/secrets/dialect.rf.hcl"), "utf8");
    assert(declaration.includes('dialect "secrets"'), "secrets Dialect declaration moved");
    writeFileSync(
      join(destination, "dialect.rf.hcl"),
      declaration.replace('dialect "secrets"', 'dialect "payments"'),
    );
  }

  const plain = project("embedded");
  writeTutorialPack(plain);
  const cliOne = marked("cli.md", "docs-cli-1", plain);
  assert(
    cliOne.stdout.includes("tutorial") &&
      cliOne.stdout.includes("subnet-network-context") &&
      cliOne.stdout.includes("Policies compliant") &&
      !existsSync(join(plain, "rootform.lock")),
    "explicit Policy Pack listing or check did not match the guide",
  );

  const selected = project("selected");
  writeTutorialPack(selected);
  writePaymentsDialect(selected);
  rootform(selected, "add", "policy-packs", "./policies");
  rootform(selected, "add", "dialects", "./dialects/payments");
  const selectedLock = lock(selected);
  const cliTwo = marked("cli.md", "docs-cli-2", selected);
  assert(
    cliTwo.stdout.includes("payments") &&
      cliTwo.stdout.includes("tutorial") &&
      cliTwo.stdout.includes("subnet-network-context"),
    "project selection listings omitted selected content",
  );
  checkLock(selected, selectedLock);

  const plans = project("plans");
  writeFileSync(join(plans, "database.tf"), database);
  copyFileSync(join(root, "scripts/fixtures/aws-vpc-plan.json"), join(plans, "tfplan.json"));
  const planned = marked("inputs/plans.md", "plan-build", plans);
  assert(planned.stderr.includes("Architecture built"), "plan build did not report success");
  const plannedArchitecture = architecture(join(plans, "planned.json"));
  assert(
    hasAddress(plannedArchitecture, "aws_subnet.database"),
    "planned architecture omitted database subnet",
  );
  const planText = marked("inputs/plans.md", "plan-diff-text", plans);
  assert(
    planText.stdout.includes("Architecture changed") &&
      planText.stdout.includes("+ aws_subnet.database"),
    "plan text Diff omitted added database subnet",
  );
  marked("inputs/plans.md", "plan-diff-json", plans);
  const delta = architecture(join(plans, "delta.json"));
  assert(
    delta.summary?.representations?.added === 1 &&
      delta.summary?.contexts?.added === 1 &&
      delta.undetermined?.length === 0,
    "plan JSON Diff summary did not describe added subnet and context",
  );

  const buildJson = marked("reference/cli/build.md", "docs-reference-cli-build-1", plain);
  assert(
    buildJson.stderr.includes("Architecture built"),
    "reference JSON build did not report success",
  );
  assert(
    hasAddress(architecture(join(plain, "architecture.json")), "aws_vpc.main") &&
      hasAddress(architecture(join(plain, "architecture.json")), "aws_subnet.application"),
    "reference JSON build omitted example resources",
  );
  marked("reference/cli/build.md", "docs-reference-cli-build-2", plain);
  assert(
    readFileSync(join(plain, "architecture.html"), "utf8").startsWith("<!doctype html>"),
    "reference HTML build did not save a self-contained page",
  );
  marked("reference/cli/build.md", "docs-reference-cli-build-3", plans);
  assert(
    hasAddress(architecture(join(plans, "planned.json")), "aws_subnet.database"),
    "reference plan build omitted the planned subnet",
  );

  const infra = join(suite, "infra");
  mkdirSync(infra);
  writeFileSync(join(infra, "main.tf"), source);
  writeFileSync(
    join(infra, "rootform.lock"),
    `${JSON.stringify({ format_version: "1", dialects: [], policy_packs: [], excluded_owners: [], replacements: [] }, null, 2)}\n`,
  );
  const infraLock = lock(infra);
  const init = marked("reference/cli/init.md", "cli-init", suite);
  assert(
    init.stdout.includes("Project ready") && init.stdout.includes('"prepared": true'),
    "init did not prepare the project in text and JSON",
  );
  checkLock(infra, infraLock);

  const dialects = marked("reference/cli/list/dialects.md", "cli-list-dialect-owners", selected);
  assert(
    dialects.stdout.includes("aws") &&
      dialects.stdout.includes("google") &&
      dialects.stdout.includes("payments") &&
      dialects.stdout.includes("embedded"),
    "Dialect listings omitted active owners or origin",
  );
  const policies = marked("reference/cli/list/policies.md", "cli-list-policies", selected);
  assert(policies.stdout.includes("subnet-network-context"), "Policy listings omitted tutorial");
  const packs = marked("reference/cli/list/policy-packs.md", "cli-list-packs", selected);
  assert(packs.stdout.includes("tutorial"), "Policy Pack listings omitted tutorial");
  const lists = marked("reference/cli/list.md", "cli-list-selection", selected);
  assert(
    lists.stdout.includes("aws") &&
      lists.stdout.includes("tutorial") &&
      lists.stdout.includes("subnet-network-context"),
    "selection listing omitted selected content",
  );
  checkLock(selected, selectedLock);

  async function serve(line: string, cwd: string, watching: boolean): Promise<void> {
    const child = Bun.spawn(["sh", "-eu", "-c", line], {
      cwd,
      env: environment,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    let output = "";
    const stdout = (async () => {
      for await (const chunk of child.stdout) output += new TextDecoder().decode(chunk);
    })();
    const stderr = new Response(child.stderr).text();
    try {
      const deadline = Date.now() + 15_000;
      let ready = false;
      while (Date.now() < deadline && child.exitCode === null) {
        const origin = /http:\/\/127\.0\.0\.1:\d+/u.exec(output)?.[0];
        if (origin) {
          const response = await fetch(`${origin}/api/v1/architecture`, {
            signal: AbortSignal.timeout(3_000),
          }).catch(() => null);
          if (response?.ok) {
            ready = true;
            break;
          }
        }
        await Bun.sleep(50);
      }
      assert(ready, `server did not announce a ready loopback URL: ${line}`);
    } finally {
      child.kill("SIGINT");
      const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
      const exit = await child.exited;
      clearTimeout(force);
      await stdout;
      const diagnostics = await stderr;
      assert(
        new RegExp(`Watch\\s+${watching ? "enabled" : "disabled"}`, "u").test(diagnostics),
        `server watch state differed: ${line}`,
      );
      assert(exit === 0, `server did not stop cleanly after SIGINT: ${line} (${exit})`);
    }
  }

  const runProject = join(suite, "run");
  mkdirSync(runProject);
  const runInfra = join(runProject, "infra");
  mkdirSync(runInfra);
  writeFileSync(join(runInfra, "main.tf"), source);
  copyFileSync(join(plain, "architecture.json"), join(runProject, "architecture.json"));
  copyFileSync(join(plans, "tfplan.json"), join(runProject, "tfplan.json"));
  const runLines = markedCommand(page("reference/cli/run.md"), "docs-reference-cli-run-1").split(
    "\n",
  );
  assert(runLines.length === 3, "reference run example changed line count");
  for (const [index, line] of runLines.entries()) await serve(line, runProject, index === 0);

  const vendor = project("vendor");
  writeTutorialPack(vendor);
  writePaymentsDialect(vendor);
  rootform(vendor, "add", "policy-packs", "./policies");
  rootform(vendor, "add", "dialects", "./dialects/payments");
  const vendorLock = lock(vendor);
  const vendorPacks = marked(
    "reference/cli/vendor/policy-packs.md",
    "docs-reference-cli-vendor-policy-packs-1",
    vendor,
  );
  assert(
    vendorPacks.stdout.includes("tutorial") &&
      existsSync(join(vendor, ".rootform/policy-packs/tutorial/.rootform-vendor.json")) &&
      existsSync(join(vendor, "offline/policy-packs/tutorial/.rootform-vendor.json")),
    "Policy Pack vendor example did not copy both destinations",
  );
  checkLock(vendor, vendorLock);
  marked("reference/cli/vendor.md", "cli-vendor", vendor);
  assert(
    existsSync(join(vendor, ".rootform/dialects/payments/.rootform-vendor.json")) &&
      existsSync(join(vendor, ".rootform/policy-packs/tutorial/.rootform-vendor.json")),
    "vendor example omitted selected Dialect or Policy Pack",
  );
  checkLock(vendor, vendorLock);

  const trouble = "troubleshooting/index.md";
  const identity = marked(trouble, "docs-troubleshooting-index-1", plain);
  assert(
    identity.stdout.includes(binary) && identity.stdout.includes("rootform 0.1.0"),
    "version troubleshooting did not identify the intended executable",
  );
  await serve(markedCommand(page(trouble), "docs-troubleshooting-index-2"), plain, true);
  const explanation = marked(trouble, "docs-troubleshooting-index-3", plain);
  assert(
    explanation.stdout.includes("aws_vpc.main") && explanation.stdout.includes("aws.rule.vpc"),
    "explain troubleshooting omitted source address or applied Rule",
  );
  const prepared = marked(trouble, "docs-troubleshooting-index-4", vendor);
  assert(
    prepared.stdout.includes("Project ready") || prepared.stdout.includes("Project prepared"),
    "locked preparation did not succeed",
  );
  checkLock(vendor, vendorLock);
  const vendoredDialect = join(vendor, ".rootform/dialects/payments/dialect.rf.hcl");
  const vendoredPack = join(vendor, ".rootform/policy-packs/tutorial/pack.rf.hcl");
  const dialectBytes = readFileSync(vendoredDialect);
  const packBytes = readFileSync(vendoredPack);
  writeFileSync(
    vendoredDialect,
    dialectBytes.toString().replace('dialect "payments"', 'dialect "altered"'),
  );
  writeFileSync(
    vendoredPack,
    packBytes.toString().replace('policy_pack "tutorial"', 'policy_pack "altered"'),
  );
  const broken = run([binary, "init", ".", "--locked", "--offline", "--no-input"], vendor, 3);
  assert(
    broken.stderr.includes("selected dialect payments differs from rootform.lock"),
    "altered vendored Dialect was not rejected",
  );
  const repaired = marked(trouble, "docs-troubleshooting-index-5", vendor);
  assert(
    repaired.stdout.includes("payments") &&
      repaired.stdout.includes("tutorial") &&
      readFileSync(vendoredDialect).equals(dialectBytes) &&
      readFileSync(vendoredPack).equals(packBytes),
    "vendor troubleshooting did not repair both altered families",
  );
  checkLock(vendor, vendorLock);

  const before = join(suite, "before");
  const after = join(suite, "after");
  mkdirSync(before);
  mkdirSync(after);
  writeFileSync(join(before, "main.tf"), source);
  writeFileSync(join(after, "main.tf"), source);
  writeFileSync(join(after, "database.tf"), database);
  const builds = marked(trouble, "docs-troubleshooting-index-7", suite);
  assert(builds.stderr.includes("Architecture built"), "directory troubleshooting builds failed");
  assert(
    existsSync(join(suite, "before.json")) && existsSync(join(suite, "after.json")),
    "directory troubleshooting did not save both architectures",
  );
  const validates = marked(trouble, "docs-troubleshooting-index-6", suite);
  assert(
    validates.stdout
      .trim()
      .split("\n")
      .filter((line) => line === "Architecture valid").length === 2,
    `architecture troubleshooting did not validate both files: ${validates.stdout} ${validates.stderr}`,
  );
  assert(
    !hasAddress(architecture(join(suite, "before.json")), "aws_subnet.database") &&
      hasAddress(architecture(join(suite, "after.json")), "aws_subnet.database"),
    "troubleshooting roots did not produce before and after architectures",
  );

  return [
    "CLI project and explicit Policy Pack examples listed and evaluated local content",
    "plan examples built and compared the planned database subnet in text and JSON",
    "CLI reference build, init, list, run, and vendor examples passed",
    "troubleshooting examples identified, served, explained, repaired, built, and validated",
  ];
}
