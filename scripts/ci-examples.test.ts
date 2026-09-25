import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const examples = join(root, "docs", "integrations", "ci");
const lifecycle = join(examples, "rootform-ci.sh");

test("CI recipes keep exact installation and failure artifacts", () => {
  const github = readFileSync(join(examples, "github-actions.yml"), "utf8");
  expect(github).toContain("rootform-dev/action/setup@71eef759bff5e73b27489b1f7de818a4a76dc2e9");
  expect(github).toContain("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a");
  expect(github).toContain(`if: \${{ !cancelled() }}`);
  expect(github).toContain("persist-credentials: false");
  const runId = "$" + "{{ github.run_id }}";
  const attempt = "$" + "{{ github.run_attempt }}";
  const output = "$" + "{{ env.ROOTFORM_OUTPUT_DIR }}";
  expect(github).toContain(`ROOTFORM_OUTPUT_DIR: .rootform-ci-${runId}-${attempt}`);
  expect(github).toContain(`${output}/check.status`);
  for (const name of ["diff.json", "diff.md", "diff.stderr"]) {
    expect(github).toContain(`${output}/${name}`);
  }
  expect(github).not.toContain("foreign.txt");
  expect(github).not.toContain("pull_request_target");

  const planRecipe = readFileSync(join(examples, "github-actions-plan.yml"), "utf8");
  expect(planRecipe).toContain(
    "hashicorp/setup-terraform@dfe3c3f87815947d99a8997f908cb6525fc44e9e",
  );
  expect(planRecipe).toContain("terraform_wrapper: false");
  expect(planRecipe).toContain("terraform show -json");
  expect(planRecipe).toContain(`ROOTFORM_PLAN: ${"$" + "{{ runner.temp }}"}/tfplan.json`);
  expect(planRecipe).toContain("persist-credentials: false");
  expect(planRecipe).toContain(`if: \${{ !cancelled() }}`);
  const uploadPaths = planRecipe
    .split("          path: |\n")[1]
    ?.split("          if-no-files-found:")[0];
  expect(uploadPaths).toBeDefined();
  expect(uploadPaths).not.toContain("tfplan");
  expect(planRecipe).not.toContain("pull_request_target");

  const gitlab = readFileSync(join(examples, "gitlab-ci.yml"), "utf8");
  expect(gitlab).toContain('test -w "$CI_PROJECT_DIR"');
  expect(gitlab).toContain("when: always");
  expect(gitlab).toContain("ROOTFORM_OUTPUT_DIR: .rootform-ci-" + "$" + "{CI_JOB_ID}");
  expect(gitlab).toContain("$ROOTFORM_OUTPUT_DIR/check.status");
  for (const name of ["diff.json", "diff.md", "diff.stderr"]) {
    expect(gitlab).toContain(`$ROOTFORM_OUTPUT_DIR/${name}`);
  }
  expect(gitlab).not.toContain("foreign.txt");

  const azure = readFileSync(join(examples, "azure-pipelines.yml"), "utf8");
  expect(azure).toContain("ghcr.io/rootform-dev/rootform:0.1.0");
  expect(azure).toContain('--user "$(id -u):$(id -g)"');
  expect(azure).not.toContain("container:");
  expect(azure).toContain("condition: succeededOrFailed()");
  expect(azure).toContain("--env ROOTFORM_OUTPUT_DIR=/workspace/.rootform-ci-$(Build.BuildId)");
  expect(azure).toContain(
    "for file in init.json init.stderr architecture.json build.stderr diff.json diff.md diff.stderr check.json check.stderr check.status",
  );
  expect(azure).toContain('tar -cf "$archive" -C "$results" "$@"');
  expect(azure).toContain("targetPath: $(rootformArtifactPath)");
  expect(azure).not.toContain("foreign.txt");

  const generic = readFileSync(join(examples, "generic-ci.sh"), "utf8");
  expect(generic).toContain("exec sh ./ci/rootform-ci.sh");
  expect(generic).toContain(`ROOTFORM_PROJECT=\${ROOTFORM_PROJECT:-./infra}`);
});

test("Azure packages only named results from the current output directory", () => {
  const temporary = mkdtempSync(join(tmpdir(), "rootform-azure-artifacts-"));
  try {
    const azure = readFileSync(join(examples, "azure-pipelines.yml"), "utf8");
    const packageStep = azure.split("  - bash: |\n")[2]?.split("\n    displayName:")[0];
    expect(packageStep).toBeDefined();
    const script = packageStep
      ?.replace(/^ {6}/gmu, "")
      .replaceAll("$(Build.SourcesDirectory)", temporary)
      .replaceAll("$(Build.BuildId)", "123")
      .replaceAll("$(Agent.TempDirectory)", temporary);
    const output = join(temporary, ".rootform-ci-123");
    mkdirSync(output);
    writeFileSync(join(output, "architecture.json"), "current architecture\n");
    writeFileSync(join(output, "check.status"), "1\n");
    writeFileSync(join(output, "foreign.txt"), "must not upload\n");

    const packaged = Bun.spawnSync(["/bin/sh", "-c", script ?? ""], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(packaged.exitCode).toBe(0);
    const archive = packaged.stdout.toString().match(/rootformArtifactPath\](.+)\n/u)?.[1];
    expect(archive).toBeDefined();
    const contents = Bun.spawnSync(["tar", "-tf", archive ?? ""], { stdout: "pipe" });
    expect(contents.exitCode).toBe(0);
    expect(contents.stdout.toString().trim().split("\n")).toEqual([
      "architecture.json",
      "check.status",
    ]);
    expect(readFileSync(join(output, "foreign.txt"), "utf8")).toBe("must not upload\n");

    rmSync(join(output, "architecture.json"));
    rmSync(join(output, "check.status"));
    const empty = Bun.spawnSync(["/bin/sh", "-c", script ?? ""], { stdout: "pipe" });
    expect(empty.exitCode).toBe(0);
    const emptyArchive = empty.stdout.toString().match(/rootformArtifactPath\](.+)\n/u)?.[1];
    const emptyContents = Bun.spawnSync(["tar", "-tf", emptyArchive ?? ""], { stdout: "pipe" });
    expect(emptyContents.exitCode).toBe(0);
    expect(emptyContents.stdout.toString()).toBe("");
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
});

test("portable script separates build, selection, and requested check", () => {
  const temporary = mkdtempSync(join(tmpdir(), "rootform-ci-example-"));
  try {
    const binary = join(temporary, "rootform");
    writeFileSync(
      binary,
      `#!/bin/sh
set -eu
printf '%s\\n' "$*" >>"$ROOTFORM_TEST_LOG"
printf '{"stage":"%s","run":"%s"}\\n' "$1" "$ROOTFORM_TEST_RUN_ID"
printf '%s diagnostic from run %s\\n' "$1" "$ROOTFORM_TEST_RUN_ID" >&2
if [ "\${ROOTFORM_TEST_FAIL_STAGE:-}" = "$1" ]; then
  exit "\${ROOTFORM_TEST_FAIL_STATUS:-2}"
fi
if [ "$1" = check ]; then
  exit "\${ROOTFORM_TEST_CHECK_STATUS:-0}"
fi
`,
      { mode: 0o755 },
    );

    const cwd = join(temporary, "repository with spaces");
    const project = join(cwd, "root module");
    const output = join(cwd, "reports with spaces");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "main.tf"), "fixture\n");
    const log = join(temporary, "calls");
    let invocation = 0;
    const invoke = (extra: Record<string, string> = {}) => {
      rmSync(log, { force: true });
      invocation += 1;
      const result = Bun.spawnSync({
        cmd: ["/bin/sh", lifecycle],
        cwd,
        env: {
          ...process.env,
          ROOTFORM_BIN: binary,
          ROOTFORM_CHECK: "0",
          ROOTFORM_OUTPUT_DIR: "./reports with spaces",
          ROOTFORM_PROJECT: "./root module",
          ROOTFORM_TEST_LOG: log,
          ROOTFORM_TEST_RUN_ID: String(invocation),
          ...extra,
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      return {
        code: result.exitCode,
        calls: existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [],
      };
    };

    expect(invoke()).toEqual({ code: 0, calls: ["build ./root module --format json"] });
    expect(readFileSync(join(output, "architecture.json"), "utf8")).toContain('"stage":"build"');
    expect(readFileSync(join(output, "architecture.json"), "utf8")).toContain('"run":"1"');
    expect(readFileSync(join(output, "build.stderr"), "utf8")).toContain("run 1");
    expect(existsSync(join(output, "check.status"))).toBe(false);
    writeFileSync(join(output, "foreign.txt"), "keep this file\n");

    writeFileSync(join(project, "rootform.lock"), "dialects-only fixture\n");
    expect(invoke({ ROOTFORM_OFFLINE: "1" })).toEqual({
      code: 0,
      calls: [
        "init ./root module --locked --no-input --offline --format json",
        "build ./root module --locked --format json",
      ],
    });
    expect(existsSync(join(output, "check.status"))).toBe(false);
    expect(readFileSync(join(project, "rootform.lock"), "utf8")).toBe("dialects-only fixture\n");

    expect(invoke({ ROOTFORM_CHECK: "1", ROOTFORM_POLICY_PACK: "./local pack" })).toEqual({
      code: 0,
      calls: [
        "init ./root module --locked --no-input --format json",
        "build ./root module --locked --format json",
        "check ./root module --policy-pack ./local pack --format json",
      ],
    });
    expect(readFileSync(join(output, "check.status"), "utf8")).toBe("0\n");
    expect(readFileSync(join(output, "check.json"), "utf8")).toContain('"run":"3"');
    expect(readFileSync(join(output, "check.stderr"), "utf8")).toContain("run 3");

    expect(invoke()).toEqual({
      code: 0,
      calls: [
        "init ./root module --locked --no-input --format json",
        "build ./root module --locked --format json",
      ],
    });
    expect(existsSync(join(output, "check.json"))).toBe(false);
    expect(existsSync(join(output, "check.status"))).toBe(false);
    expect(existsSync(join(output, "check.stderr"))).toBe(false);
    expect(readFileSync(join(output, "architecture.json"), "utf8")).toContain('"run":"4"');
    expect(readFileSync(join(output, "init.json"), "utf8")).toContain('"run":"4"');

    for (const [status, meaning] of [
      ["1", "violation"],
      ["3", "indeterminate or no evaluation"],
    ] as const) {
      const result = invoke({ ROOTFORM_CHECK: "1", ROOTFORM_TEST_CHECK_STATUS: status });
      expect(result.code, meaning).toBe(Number(status));
      expect(result.calls.at(-1)).toBe("check ./root module --locked --format json");
      expect(readFileSync(join(output, "check.status"), "utf8")).toBe(`${status}\n`);
      expect(readFileSync(join(output, "check.json"), "utf8")).toContain('"stage":"check"');
      expect(existsSync(join(output, "architecture.json"))).toBe(true);
    }

    rmSync(join(project, "rootform.lock"));
    const empty = invoke({ ROOTFORM_CHECK: "1", ROOTFORM_TEST_CHECK_STATUS: "3" });
    expect(empty.calls).toEqual([
      "build ./root module --format json",
      "check ./root module --format json",
    ]);
    expect(empty.code).toBe(3);

    for (const [stage, status] of [
      ["init", "2"],
      ["build", "3"],
    ] as const) {
      if (stage === "init") writeFileSync(join(project, "rootform.lock"), "invalid lock\n");
      const failed = invoke({
        ROOTFORM_CHECK: "1",
        ROOTFORM_TEST_FAIL_STAGE: stage,
        ROOTFORM_TEST_FAIL_STATUS: status,
      });
      expect(failed.code).toBe(Number(status));
      expect(failed.calls.at(-1)?.startsWith(stage)).toBe(true);
      expect(existsSync(join(output, "check.status"))).toBe(false);
      expect(readFileSync(join(output, `${stage}.stderr`), "utf8")).toContain(
        `${stage} diagnostic`,
      );
      rmSync(join(project, "rootform.lock"), { force: true });
    }

    expect(invoke({ ROOTFORM_POLICY_PACK: "./local pack" }).code).toBe(2);
    expect(invoke({ ROOTFORM_CHECK: "yes" }).code).toBe(2);

    writeFileSync(join(project, "rootform.lock"), "reviewed lock\n");
    expect(invoke({ ROOTFORM_CHECK: "1" }).code).toBe(0);
    const oldCheckRun = String(invocation);
    expect(readFileSync(join(output, "check.json"), "utf8")).toContain(`"run":"${oldCheckRun}"`);

    expect(
      invoke({
        ROOTFORM_CHECK: "1",
        ROOTFORM_TEST_FAIL_STAGE: "init",
        ROOTFORM_TEST_FAIL_STATUS: "3",
      }).code,
    ).toBe(3);
    expect(readFileSync(join(output, "init.json"), "utf8")).toContain(`"run":"${invocation}"`);
    expect(readFileSync(join(output, "init.stderr"), "utf8")).toContain(`run ${invocation}`);
    expect(existsSync(join(output, "architecture.json"))).toBe(false);
    expect(existsSync(join(output, "check.json"))).toBe(false);
    expect(existsSync(join(output, "check.stderr"))).toBe(false);
    expect(existsSync(join(output, "check.status"))).toBe(false);
    expect(readFileSync(join(project, "rootform.lock"), "utf8")).toBe("reviewed lock\n");

    expect(invoke({ ROOTFORM_CHECK: "1" }).code).toBe(0);
    expect(
      invoke({
        ROOTFORM_CHECK: "1",
        ROOTFORM_TEST_FAIL_STAGE: "build",
        ROOTFORM_TEST_FAIL_STATUS: "2",
      }).code,
    ).toBe(2);
    expect(readFileSync(join(output, "init.json"), "utf8")).toContain(`"run":"${invocation}"`);
    expect(readFileSync(join(output, "architecture.json"), "utf8")).toContain(
      `"run":"${invocation}"`,
    );
    expect(readFileSync(join(output, "build.stderr"), "utf8")).toContain(`run ${invocation}`);
    expect(existsSync(join(output, "check.json"))).toBe(false);
    expect(existsSync(join(output, "check.status"))).toBe(false);
    expect(readFileSync(join(project, "rootform.lock"), "utf8")).toBe("reviewed lock\n");

    rmSync(join(project, "rootform.lock"));
    expect(invoke().code).toBe(0);
    expect(readFileSync(join(output, "architecture.json"), "utf8")).toContain(
      `"run":"${invocation}"`,
    );
    expect(existsSync(join(output, "init.json"))).toBe(false);
    expect(existsSync(join(output, "init.stderr"))).toBe(false);
    expect(existsSync(join(output, "check.json"))).toBe(false);

    expect(invoke({ ROOTFORM_CHECK: "1", ROOTFORM_POLICY_PACK: "./local pack" }).code).toBe(0);
    expect(invoke({ ROOTFORM_CHECK: "1", ROOTFORM_TEST_CHECK_STATUS: "1" }).code).toBe(1);
    expect(readFileSync(join(output, "check.status"), "utf8")).toBe("1\n");
    expect(readFileSync(join(output, "check.json"), "utf8")).toContain(`"run":"${invocation}"`);
    expect(invoke({ ROOTFORM_CHECK: "1", ROOTFORM_TEST_CHECK_STATUS: "3" }).code).toBe(3);
    expect(readFileSync(join(output, "check.status"), "utf8")).toBe("3\n");
    expect(readFileSync(join(output, "check.json"), "utf8")).toContain(`"run":"${invocation}"`);

    expect(invoke({ ROOTFORM_POLICY_PACK: "./local pack" }).code).toBe(2);
    for (const name of [
      "init.json",
      "init.stderr",
      "architecture.json",
      "build.stderr",
      "check.json",
      "check.stderr",
      "check.status",
    ]) {
      expect(existsSync(join(output, name)), name).toBe(false);
    }
    expect(readFileSync(join(output, "foreign.txt"), "utf8")).toBe("keep this file\n");
    expect(readFileSync(join(project, "main.tf"), "utf8")).toBe("fixture\n");

    const outside = join(temporary, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "check.json"), "outside evidence\n");
    symlinkSync(outside, join(cwd, "linked results"));
    expect(invoke({ ROOTFORM_OUTPUT_DIR: "./linked results" }).code).toBe(2);
    expect(invoke({ ROOTFORM_OUTPUT_DIR: "./linked results/nested" }).code).toBe(2);
    expect(invoke({ ROOTFORM_OUTPUT_DIR: join(cwd, "linked results", "nested") }).code).toBe(2);
    expect(readFileSync(join(outside, "check.json"), "utf8")).toBe("outside evidence\n");
    expect(existsSync(join(outside, "nested"))).toBe(false);
    expect(invoke({ ROOTFORM_OUTPUT_DIR: "." }).code).toBe(2);
    expect(readFileSync(join(project, "main.tf"), "utf8")).toBe("fixture\n");

    symlinkSync(join(outside, "check.json"), join(output, "check.json"));
    expect(invoke().code).toBe(0);
    expect(readFileSync(join(outside, "check.json"), "utf8")).toBe("outside evidence\n");
    expect(existsSync(join(output, "check.json"))).toBe(false);
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
});

test("portable script reviews a completed plan from the project directory", () => {
  const temporary = mkdtempSync(join(tmpdir(), "rootform-ci-plan-"));
  try {
    const binary = join(temporary, "rootform");
    writeFileSync(
      binary,
      `#!/bin/sh
set -eu
printf '%s|%s\\n' "$*" "$(pwd -P)" >>"$ROOTFORM_TEST_LOG"
printf '{"stage":"%s"}\\n' "$1"
printf '%s diagnostic\\n' "$1" >&2
if [ "$1" = check ]; then
  exit "\${ROOTFORM_TEST_CHECK_STATUS:-0}"
fi
`,
      { mode: 0o755 },
    );

    const cwd = join(temporary, "repository with spaces");
    const project = join(cwd, "root module");
    const planDirectory = join(cwd, "plans with spaces");
    const plan = join(planDirectory, "tfplan with spaces.json");
    const pack = join(cwd, "policies with spaces");
    const output = join(cwd, "reports with spaces");
    mkdirSync(project, { recursive: true });
    mkdirSync(planDirectory);
    mkdirSync(pack);
    writeFileSync(plan, "{}\n");
    const absolutePlan = realpathSync(plan);
    const absoluteProject = realpathSync(project);
    const absolutePack = realpathSync(pack);
    const log = join(temporary, "calls");
    const invoke = (extra: Record<string, string> = {}) => {
      rmSync(log, { force: true });
      const result = Bun.spawnSync({
        cmd: ["/bin/sh", lifecycle],
        cwd,
        env: {
          ...process.env,
          ROOTFORM_BIN: binary,
          ROOTFORM_CHECK: "0",
          ROOTFORM_OUTPUT_DIR: "./reports with spaces",
          ROOTFORM_PLAN: "./plans with spaces/tfplan with spaces.json",
          ROOTFORM_PROJECT: "./root module",
          ROOTFORM_TEST_LOG: log,
          ...extra,
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      return {
        code: result.exitCode,
        calls: existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [],
        stderr: result.stderr.toString(),
      };
    };
    const expectedCalls = [
      `build --plan ${absolutePlan} --format json|${absoluteProject}`,
      `diff --plan ${absolutePlan} --format json|${absoluteProject}`,
      `diff --plan ${absolutePlan} --format markdown|${absoluteProject}`,
    ];

    const build = invoke();
    expect(build.code).toBe(0);
    expect(build.calls).toEqual(expectedCalls);
    for (const name of ["architecture.json", "diff.json", "diff.md", "diff.stderr"]) {
      expect(existsSync(join(output, name)), name).toBe(true);
    }
    expect(existsSync(join(output, "check.status"))).toBe(false);

    const checked = invoke({
      ROOTFORM_CHECK: "1",
      ROOTFORM_POLICY_PACK: "./policies with spaces",
      ROOTFORM_TEST_CHECK_STATUS: "1",
    });
    expect(checked.code).toBe(1);
    expect(checked.calls).toEqual([
      ...expectedCalls,
      `check --plan ${absolutePlan} --policy-pack ${absolutePack} --format json|${absoluteProject}`,
    ]);
    expect(readFileSync(join(output, "check.status"), "utf8")).toBe("1\n");

    const projectFile = join(cwd, "project file");
    writeFileSync(projectFile, "fixture\n");
    const invalidCases: { options: Record<string, string>; message: string }[] = [
      {
        options: { ROOTFORM_PLAN: "-" },
        message: "ROOTFORM_PLAN must name a JSON plan file, not standard input\n",
      },
      {
        options: { ROOTFORM_PLAN: "./missing plan.json" },
        message: "ROOTFORM_PLAN is not a file: ./missing plan.json\n",
      },
      {
        options: { ROOTFORM_PROJECT: "./project file" },
        message: "ROOTFORM_PROJECT must be a directory when ROOTFORM_PLAN is set: ./project file\n",
      },
    ];
    const ownedNames = [
      "init.json",
      "init.stderr",
      "architecture.json",
      "build.stderr",
      "diff.json",
      "diff.md",
      "diff.stderr",
      "check.json",
      "check.stderr",
      "check.status",
    ];
    for (const { options, message } of invalidCases) {
      expect(invoke({ ROOTFORM_CHECK: "1" }).code).toBe(0);
      const invalid = invoke(options);
      expect(invalid.code).toBe(2);
      expect(invalid.stderr).toBe(message);
      expect(invalid.calls).toEqual([]);
      for (const name of ownedNames) {
        expect(existsSync(join(output, name)), name).toBe(false);
      }
    }
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
});
