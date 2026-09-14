import { expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const examples = join(root, "docs", "integrations", "ci");
const lifecycle = join(examples, "rootform-ci.sh");

test("all CI examples support locked and supplied-only projects", () => {
  const shared = readFileSync(lifecycle, "utf8");
  expect(shared).toContain('if [ -f "$project/rootform.lock" ]');
  expect(shared).toContain('"$rootform_bin" init "$project" --locked --no-input');
  expect(shared).toContain('"$rootform_bin" build "$project" --locked --format json');
  expect(shared).toContain('"$rootform_bin" check "$project" --locked --format json');
  expect(shared).toContain('"$rootform_bin" build "$project" --format json');
  expect(shared).toContain(
    '"$rootform_bin" check "$project" --policy-pack "$policy_pack" --format json',
  );
  expect(shared).not.toMatch(/(?:--upgrade|vendor dialects|latest)/u);

  const github = readFileSync(join(examples, "github-actions.yml"), "utf8");
  expect(github).toContain("rootform-dev/action/setup@71eef759bff5e73b27489b1f7de818a4a76dc2e9");
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

test("shared CI lifecycle branches on rootform.lock without eval", () => {
  const temporary = mkdtempSync(join(tmpdir(), "rootform-ci-example-"));
  try {
    const binary = join(temporary, "rootform");
    writeFileSync(
      binary,
      `#!/bin/sh
set -eu
printf '%s\\n' "$*" >>"$ROOTFORM_TEST_LOG"
printf '{"format_version":"1"}\\n'
if [ "\${1:-}" = "check" ] && [ -n "\${ROOTFORM_TEST_CHECK_STATUS:-}" ]; then
  exit "$ROOTFORM_TEST_CHECK_STATUS"
fi
`,
      { mode: 0o755 },
    );
    chmodSync(binary, 0o755);

    const unlocked = join(temporary, "unlocked");
    const unlockedLog = join(temporary, "unlocked.calls");
    const unlockedOutput = join(temporary, "unlocked-output");
    mkdirSync(unlocked);
    const unlockedResult = Bun.spawnSync({
      cmd: ["/bin/sh", lifecycle],
      env: {
        ...process.env,
        ROOTFORM_BIN: binary,
        ROOTFORM_OFFLINE: "1",
        ROOTFORM_OUTPUT_DIR: unlockedOutput,
        ROOTFORM_PROJECT: unlocked,
        ROOTFORM_TEST_LOG: unlockedLog,
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(unlockedResult.exitCode).toBe(0);
    expect(readFileSync(unlockedLog, "utf8").trim().split("\n")).toEqual([
      `build ${unlocked} --format json`,
    ]);
    expect(readFileSync(join(unlockedOutput, "architecture.json"), "utf8")).toContain(
      '"format_version":"1"',
    );
    expect(existsSync(join(unlockedOutput, "check.status"))).toBe(false);

    const localPackLog = join(temporary, "local-pack.calls");
    const localPackOutput = join(temporary, "local-pack-output");
    const localPackResult = Bun.spawnSync({
      cmd: ["/bin/sh", lifecycle],
      env: {
        ...process.env,
        ROOTFORM_BIN: binary,
        ROOTFORM_OUTPUT_DIR: localPackOutput,
        ROOTFORM_POLICY_PACK: "./policies",
        ROOTFORM_PROJECT: unlocked,
        ROOTFORM_TEST_LOG: localPackLog,
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(localPackResult.exitCode).toBe(0);
    expect(readFileSync(localPackLog, "utf8").trim().split("\n")).toEqual([
      `build ${unlocked} --format json`,
      `check ${unlocked} --policy-pack ./policies --format json`,
    ]);
    expect(readFileSync(join(localPackOutput, "check.status"), "utf8")).toBe("0\n");

    const indeterminateLog = join(temporary, "indeterminate.calls");
    const indeterminateOutput = join(temporary, "indeterminate-output");
    const indeterminateResult = Bun.spawnSync({
      cmd: ["/bin/sh", lifecycle],
      env: {
        ...process.env,
        ROOTFORM_BIN: binary,
        ROOTFORM_OUTPUT_DIR: indeterminateOutput,
        ROOTFORM_POLICY_PACK: "./policies",
        ROOTFORM_PROJECT: unlocked,
        ROOTFORM_TEST_CHECK_STATUS: "3",
        ROOTFORM_TEST_LOG: indeterminateLog,
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(indeterminateResult.exitCode).toBe(3);
    expect(readFileSync(join(indeterminateOutput, "check.status"), "utf8")).toBe("3\n");

    const locked = join(temporary, "locked");
    const lockedLog = join(temporary, "locked.calls");
    const lockedOutput = join(temporary, "locked-output");
    mkdirSync(locked);
    writeFileSync(join(locked, "rootform.lock"), "{}\n");
    const lockedResult = Bun.spawnSync({
      cmd: ["/bin/sh", lifecycle],
      env: {
        ...process.env,
        ROOTFORM_BIN: binary,
        ROOTFORM_OFFLINE: "1",
        ROOTFORM_OUTPUT_DIR: lockedOutput,
        ROOTFORM_PROJECT: locked,
        ROOTFORM_TEST_LOG: lockedLog,
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(lockedResult.exitCode).toBe(0);
    expect(readFileSync(lockedLog, "utf8").trim().split("\n")).toEqual([
      `init ${locked} --locked --no-input --offline --format json`,
      `build ${locked} --locked --format json`,
      `check ${locked} --locked --format json`,
    ]);
    expect(readFileSync(join(lockedOutput, "init.json"), "utf8")).toContain('"format_version":"1"');
    expect(readFileSync(lifecycle, "utf8")).not.toMatch(/\beval\b/u);
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
});
