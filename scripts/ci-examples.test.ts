import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const examples = join(root, "docs", "integrations", "ci");
const lifecycle = join(examples, "rootform-ci.sh");

test("all CI examples use one exact locked lifecycle", () => {
  const shared = readFileSync(lifecycle, "utf8");
  for (const command of ["init", "build", "check"]) {
    expect(shared).toContain(
      `run_rootform ${command} "$project" --locked --no-input --format json`,
    );
  }
  expect(shared).not.toMatch(/(?:--upgrade|vendor dialects|latest)/u);

  const github = readFileSync(join(examples, "github-actions.yml"), "utf8");
  expect(github).toContain("rootform-dev/action/setup@1fb6fadcc6356a769d4a1dee34f9563639df60c8");
  expect(github).toContain("version: 0.1.0");
  expect(github).toContain("./ci/rootform-ci.sh");

  for (const name of ["gitlab-ci.yml", "azure-pipelines.yml"]) {
    const body = readFileSync(join(examples, name), "utf8");
    expect(body).toContain("ghcr.io/rootform-dev/rootform:0.1.0");
    expect(body).toContain("./ci/rootform-ci.sh");
    expect(body).not.toContain(":latest");
  }
  expect(readFileSync(join(examples, "generic-ci.sh"), "utf8")).toContain(
    "exec ./ci/rootform-ci.sh",
  );
});

test("shared CI lifecycle passes literal project and offline flags without eval", () => {
  const temporary = mkdtempSync(join(tmpdir(), "rootform-ci-example-"));
  try {
    const binary = join(temporary, "rootform");
    const log = join(temporary, "calls");
    const output = join(temporary, "output");
    writeFileSync(
      binary,
      `#!/bin/sh
set -eu
printf '%s\\n' "$*" >>"$ROOTFORM_TEST_LOG"
printf '{"format_version":"1"}\\n'
`,
      { mode: 0o755 },
    );
    chmodSync(binary, 0o755);
    const result = Bun.spawnSync({
      cmd: ["/bin/sh", lifecycle],
      env: {
        ...process.env,
        ROOTFORM_BIN: binary,
        ROOTFORM_OFFLINE: "1",
        ROOTFORM_OUTPUT_DIR: output,
        ROOTFORM_PROJECT: "infra",
        ROOTFORM_TEST_LOG: log,
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(result.exitCode).toBe(0);
    expect(readFileSync(log, "utf8").trim().split("\n")).toEqual([
      "init infra --locked --no-input --format json --offline",
      "build infra --locked --no-input --format json --offline",
      "check infra --locked --no-input --format json --offline",
    ]);
    expect(readFileSync(join(output, "architecture.json"), "utf8")).toContain(
      '"format_version":"1"',
    );
    expect(readFileSync(lifecycle, "utf8")).not.toMatch(/\beval\b/u);
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
});
