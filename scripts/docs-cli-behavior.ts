import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CLI documentation behavior: ${message}`);
}

type Result = { stdout: string; stderr: string };

export async function verifyCliBehavior(
  binary: string,
  workspace: string,
  home: string,
): Promise<string[]> {
  const env = {
    ...process.env,
    ROOTFORM_HOME: home,
    ROOTFORM_INPUT: "0",
    DOCKER_CONFIG: join(home, "docker"),
  };
  const run = (args: string[], exitCode = 0, cwd = workspace, input?: Buffer): Result => {
    const result = Bun.spawnSync([binary, ...args], {
      cwd,
      env,
      stdin: input ?? "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    assert(
      result.exitCode === exitCode,
      `${args.join(" ")}: exit ${result.exitCode}, expected ${exitCode}\n${result.stderr}`,
    );
    return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  };
  const resultPath = (name: string) => join(workspace, `cli-${name}`);

  const built = run(["build", "."]);
  assert(
    JSON.parse(built.stdout).architecture?.representations?.length > 0 &&
      built.stderr.includes("Resources"),
    "directory build lost JSON stdout or diagnostic stderr",
  );
  const jsonPath = resultPath("architecture.json");
  assert(
    run(["build", ".", "--output", jsonPath]).stdout === "" && existsSync(jsonPath),
    "build --output did not move JSON to the file",
  );
  const htmlPath = resultPath("architecture.html");
  assert(
    run(["build", ".", "--format", "html", "--output", htmlPath]).stdout === "" &&
      readFileSync(htmlPath, "utf8").toLowerCase().startsWith("<!doctype html>"),
    "HTML build did not create a self-contained architecture document",
  );
  run(["build", ".", "--format", "markdown"], 2);
  run(["build", "missing-directory"], 3);

  const planPath = resultPath("plan.json");
  const plan = {
    format_version: "1.2",
    terraform_version: "1.12.2",
    planned_values: { root_module: { resources: [] } },
    prior_state: { values: { root_module: { resources: [] } } },
    resource_changes: [],
    configuration: { root_module: { resources: [] } },
    complete: true,
    applyable: false,
    errored: false,
  };
  writeFileSync(planPath, `${JSON.stringify(plan)}\n`);
  assert(
    JSON.parse(run(["build", "--plan", planPath]).stdout).source?.language === "terraform",
    "plan build did not produce architecture JSON",
  );

  const pack = join(workspace, "policies");
  for (const format of ["text", "json", "markdown", "sarif"]) {
    const report = run(["check", "architecture.json", "--policy-pack", pack, "--format", format]);
    assert(report.stdout.length > 0, `check ${format} report missing`);
    if (format === "json")
      assert(JSON.parse(report.stdout).status === "compliant", "check JSON status drifted");
  }
  const checkPath = resultPath("check.json");
  assert(
    run(["check", ".", "--policy-pack", pack, "--format", "json", "--output", checkPath]).stdout ===
      "" && JSON.parse(readFileSync(checkPath, "utf8")).status === "compliant",
    "check --output lost report or compliance",
  );
  assert(
    JSON.parse(run(["check", "architecture.json", "--format", "json"], 3).stdout).status ===
      "not_evaluated",
    "empty project selection became compliant",
  );
  run(["check", ".", "--policy-pack", pack, "--locked"], 2);
  run(["check", ".", "--policy-pack", pack, "--format", "html"], 2);

  const before = readFileSync(join(workspace, "before.json"));
  const after = "after.json";
  for (const format of ["text", "json", "markdown"]) {
    assert(
      run(["diff", "before.json", after, "--format", format]).stdout.length > 0,
      `diff ${format} report missing`,
    );
  }
  run(["diff", "before.json", after, "--exit-code"], 1);
  assert(
    JSON.parse(run(["diff", "-", after, "--format", "json"], 0, workspace, before).stdout)
      .summary !== undefined,
    "diff refused one architecture on stdin",
  );
  run(["diff", "-", "-"], 2);
  run(["diff", "--plan", planPath, "before.json", after], 2);
  run(["diff", "before.json", after, "--format", "sarif"], 2);
  const comparisonHtml = resultPath("comparison.html");
  assert(
    run(["diff", "before.json", after, "--format", "html", "--output", comparisonHtml]).stdout ===
      "" && readFileSync(comparisonHtml, "utf8").toLowerCase().startsWith("<!doctype html>"),
    "HTML diff did not create a self-contained comparison page",
  );
  assert(
    run(["diff", "before.json", after, "--format", "html"])
      .stdout.toLowerCase()
      .startsWith("<!doctype html>"),
    "HTML diff did not go to standard output",
  );
  const serveFlags = ["--serve", "--no-browser", "--port", "0"];
  run(["diff", "before.json", after, ...serveFlags, "--format", "json"], 2);
  run(["diff", "before.json", after, ...serveFlags, "--output", comparisonHtml], 2);
  run(["diff", "before.json", after, ...serveFlags, "--exit-code"], 2);
  run(["diff", "missing.json", after, ...serveFlags], 3);
  run(["diff", "missing.json", after], 3);
  assert(run(["diff", "--plan", planPath]).stdout.length > 0, "plan comparison missing");
  const invalidArchitecture = resultPath("invalid-architecture.json");
  writeFileSync(invalidArchitecture, '{"format_version":"invalid"}\n');
  run(["diff", invalidArchitecture, after], 3);
  run(["validate", "architecture", invalidArchitecture], 1);
  const invalidDirectory = resultPath("invalid-directory");
  mkdirSync(invalidDirectory);
  writeFileSync(join(invalidDirectory, "main.tf"), "resource {\n");
  run(["diff", invalidDirectory, "."], 3);
  run(["build", invalidDirectory], 3);
  const invalidPlan = resultPath("invalid-plan.json");
  writeFileSync(invalidPlan, "{}\n");
  run(["diff", "--plan", invalidPlan], 3);
  run(["build", "--plan", invalidPlan], 3);
  const diffPath = resultPath("diff.md");
  assert(
    run(["diff", "before.json", after, "--format", "markdown", "--output", diffPath]).stdout ===
      "" && readFileSync(diffPath, "utf8").startsWith("## Rootform diff"),
    "diff --output lost Markdown report",
  );

  const initProject = resultPath("init-project");
  mkdirSync(initProject);
  writeFileSync(join(initProject, "main.tf"), readFileSync(join(workspace, "main.tf")));
  run(["init", ".", "--no-input", "--offline", "--format", "json"], 0, initProject);
  assert(!existsSync(join(initProject, "rootform.lock")), "init created an unrequested lock");
  run(["init", ".", "--locked", "--offline", "--no-input"], 3, initProject);
  const lock = `${JSON.stringify({ format_version: "1", dialects: [], policy_packs: [], excluded_owners: [], replacements: [] }, null, 2)}\n`;
  writeFileSync(join(initProject, "rootform.lock"), lock);
  run(["init", ".", "--locked", "--offline", "--no-input"], 0, initProject);
  assert(
    readFileSync(join(initProject, "rootform.lock"), "utf8") === lock,
    "init changed the lock",
  );
  const dialectCopy = join(initProject, "dialect-copy");
  const policyCopy = join(initProject, "policy-copy");
  run(["vendor", "dialects", "--offline", "--to", dialectCopy], 3, initProject);
  run(["vendor", "policy-packs", "--offline", "--to", policyCopy], 3, initProject);
  assert(
    !existsSync(dialectCopy) && !existsSync(policyCopy),
    "empty selection created vendor results",
  );
  assert(
    readFileSync(join(initProject, "rootform.lock"), "utf8") === lock,
    "empty vendoring changed the lock",
  );

  assert(
    JSON.parse(run(["list", "dialects", "aws", "-o", "json"]).stdout).some(
      (entry: { name?: string }) => entry.name === "aws",
    ),
    "list dialects lost selected AWS definition",
  );
  assert(
    run(["show", "aws.rule.subnet", "-o", "json"]).stdout.includes("aws.rule.subnet"),
    "show stopped inspecting definitions",
  );
  assert(
    run([
      "explain",
      "architecture",
      "aws_subnet.application",
      "--input",
      "architecture.json",
    ]).stdout.includes("aws_subnet.application"),
    "explain architecture stopped resolving saved addresses",
  );
  run(["validate", "architecture", "architecture.json"]);
  run(["validate", "architecture", "architecture.json", "--format", "yaml"], 2);

  const baseOnly = resultPath("base-only");
  mkdirSync(baseOnly);
  writeFileSync(join(baseOnly, "main.tf"), 'resource "acme_unknown_widget" "probe" {}\n');
  const baseOnlyArchitecture = join(baseOnly, "architecture.json");
  run(["build", ".", "--output", baseOnlyArchitecture], 0, baseOnly);
  const baseOnlyDocument = JSON.parse(readFileSync(baseOnlyArchitecture, "utf8"));
  assert(
    baseOnlyDocument.architecture.representations.some(
      (representation: { id?: string; rule?: string }) =>
        representation.id?.includes("acme_unknown_widget.probe") && !representation.rule,
    ),
    "unrecognized resource lost its base Representation",
  );
  const baseOnlyExplanation = run(
    ["explain", "architecture", "acme_unknown_widget.probe", "--input", baseOnlyArchitecture],
    0,
    baseOnly,
  ).stdout;
  assert(
    /Rule\s+none/u.test(baseOnlyExplanation) && /Facts\s+none/u.test(baseOnlyExplanation),
    "explain architecture did not diagnose base-only Representation",
  );

  async function serve(
    args: string[],
    watching: boolean,
    cwd = workspace,
    reload = false,
  ): Promise<void> {
    const child = Bun.spawn([binary, "run", ...args, "--no-browser", "--port", "0"], {
      cwd,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    let stdout = "";
    const reader = (async () => {
      for await (const chunk of child.stdout) stdout += new TextDecoder().decode(chunk);
    })();
    const stderr = new Response(child.stderr).text();
    try {
      const deadline = Date.now() + 15_000;
      let observed = false;
      while (Date.now() < deadline && child.exitCode === null) {
        const origin = stdout.match(/http:\/\/127\.0\.0\.1:\d+/u)?.[0];
        if (origin) {
          const response = await fetch(`${origin}/api/v1/architecture`, {
            signal: AbortSignal.timeout(3_000),
          }).catch(() => null);
          if (!response) {
            await Bun.sleep(50);
            continue;
          }
          assert(response.ok, `run did not serve architecture: ${args.join(" ")}`);
          if (reload) {
            assert(
              !(await response.text()).includes("aws_subnet.database"),
              "watch fixture already contained the added subnet",
            );
            writeFileSync(join(cwd, "database.tf"), readFileSync(join(workspace, "database.tf")));
            const changeDeadline = Date.now() + 10_000;
            let changed = false;
            while (Date.now() < changeDeadline && child.exitCode === null) {
              const updated = await fetch(`${origin}/api/v1/architecture`, {
                signal: AbortSignal.timeout(3_000),
              });
              if ((await updated.text()).includes("aws_subnet.database")) {
                changed = true;
                break;
              }
              await Bun.sleep(100);
            }
            assert(changed, "directory watch did not rebuild after a source change");
          }
          observed = true;
          break;
        }
        await Bun.sleep(50);
      }
      assert(observed, `run did not serve on an allocated loopback port: ${args.join(" ")}`);
    } finally {
      child.kill("SIGINT");
      const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
      const exit = await child.exited;
      clearTimeout(force);
      await reader;
      const diagnostics = await stderr;
      assert(
        new RegExp(`Watch\\s+${watching ? "enabled" : "disabled"}`, "u").test(diagnostics),
        `run watch state drifted: ${args.join(" ")}`,
      );
      assert(exit === 0, `Ctrl+C did not stop run cleanly: ${args.join(" ")} (${exit})`);
    }
  }
  await serve(["."], true, initProject, true);
  await serve([".", "--no-watch"], false, initProject);
  await serve(["architecture.json"], false);
  await serve(["--plan", planPath], false);
  run(["run", "missing.json", "--no-browser", "--port", "0"], 1);
  run(["run", ".", "--no-browser", "--port", "not-a-port"], 2);

  async function serveComparison(args: string[]): Promise<void> {
    const child = Bun.spawn([binary, "diff", ...args, ...serveFlags], {
      cwd: workspace,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    let stdout = "";
    const reader = (async () => {
      for await (const chunk of child.stdout) stdout += new TextDecoder().decode(chunk);
    })();
    const stderr = new Response(child.stderr).text();
    try {
      const deadline = Date.now() + 15_000;
      let observed = false;
      while (Date.now() < deadline && child.exitCode === null) {
        const origin = stdout.match(/http:\/\/127\.0\.0\.1:\d+/u)?.[0];
        if (origin) {
          const response = await fetch(`${origin}/api/v1/comparison`, {
            signal: AbortSignal.timeout(3_000),
          }).catch(() => null);
          if (!response) {
            await Bun.sleep(50);
            continue;
          }
          assert(response.ok, `diff did not serve the comparison: ${args.join(" ")}`);
          const comparison = (await response.json()) as { summary?: unknown };
          assert(comparison.summary !== undefined, "served comparison lost its summary");
          const architecture = await fetch(`${origin}/api/v1/architecture`, {
            signal: AbortSignal.timeout(3_000),
          });
          assert(architecture.ok, "diff --serve did not serve the After architecture");
          observed = true;
          break;
        }
        await Bun.sleep(50);
      }
      assert(observed, `diff did not serve on an allocated loopback port: ${args.join(" ")}`);
    } finally {
      child.kill("SIGINT");
      const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
      const exit = await child.exited;
      clearTimeout(force);
      await reader;
      const diagnostics = await stderr;
      assert(
        diagnostics.includes("Serving comparison"),
        `diff --serve lost its report: ${args.join(" ")}`,
      );
      assert(
        stdout.trim().split("\n").length === 1,
        `diff --serve printed more than the address: ${args.join(" ")}`,
      );
      assert(exit === 0, `Ctrl+C did not stop diff --serve cleanly: ${args.join(" ")} (${exit})`);
    }
  }
  await serveComparison(["before.json", after]);
  await serveComparison(["--plan", planPath]);

  return [
    "CLI build and plan inputs, JSON/HTML, output streams, and usage failures execute",
    "CLI check formats, project selection, override, report files, and statuses execute",
    "CLI diff formats, HTML page, serve, stdin, plan, input-type failures, output files, and exit-code execute",
    "CLI init and both vendor families preserve lock and empty selection",
    "CLI list/show/explain base-only and validate architecture result versus usage execute",
    "CLI run directory, saved architecture, plan, watch state, port 0, and Ctrl+C execute",
  ];
}
