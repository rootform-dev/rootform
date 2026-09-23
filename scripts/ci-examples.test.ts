import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  expect(github).toContain(".rootform-ci/check.status");
  expect(github).not.toContain("pull_request_target");

  const gitlab = readFileSync(join(examples, "gitlab-ci.yml"), "utf8");
  expect(gitlab).toContain('test -w "$CI_PROJECT_DIR"');
  expect(gitlab).toContain("when: always");
  expect(gitlab).toContain(".rootform-ci/check.status");

  const azure = readFileSync(join(examples, "azure-pipelines.yml"), "utf8");
  expect(azure).toContain("ghcr.io/rootform-dev/rootform:0.1.0");
  expect(azure).toContain('--user "$(id -u):$(id -g)"');
  expect(azure).not.toContain("container:");
  expect(azure).toContain("condition: succeededOrFailed()");

  const generic = readFileSync(join(examples, "generic-ci.sh"), "utf8");
  expect(generic).toContain("exec sh ./ci/rootform-ci.sh");
  expect(generic).toContain(`ROOTFORM_PROJECT=\${ROOTFORM_PROJECT:-./infra}`);
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
printf '{"stage":"%s"}\\n' "$1"
printf '%s\\n' "$1 diagnostic" >&2
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
    const log = join(temporary, "calls");
    const invoke = (extra: Record<string, string> = {}) => {
      rmSync(output, { force: true, recursive: true });
      rmSync(log, { force: true });
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
    expect(readFileSync(join(output, "build.stderr"), "utf8")).toContain("build diagnostic");
    expect(existsSync(join(output, "check.status"))).toBe(false);

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
    expect(readFileSync(join(output, "check.stderr"), "utf8")).toContain("check diagnostic");

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
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
});
