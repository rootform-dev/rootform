import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "../docs/integrations/ci/rootform-ci.sh");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "rf-ci-example-"));
  const project = join(root, "infra");
  mkdirSync(project);
  const input = join(root, "plan.json");
  const saved = join(root, "plan.tfplan");
  const pack = join(root, "policies");
  writeFileSync(input, "{}\n");
  writeFileSync(saved, "saved plan\n");
  mkdirSync(pack);
  const binary = join(root, "rootform");
  writeFileSync(
    binary,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$ROOTFORM_TEST_ARGS"
command=$1
for arg do
  case "$previous" in
    -o) printf 'artifact\\n' > "$arg" ;;
  esac
  previous=$arg
done
printf 'summary\\n'
printf 'diagnostic\\n' >&2
if [ "$command" = run ]; then exit "\${ROOTFORM_RUN_STATUS:-0}"; fi
exit "\${ROOTFORM_CHECK_STATUS:-0}"
`,
    { mode: 0o755 },
  );
  const output = join(root, "results");
  const args = join(root, "args.txt");
  const env = {
    ...process.env,
    ROOTFORM_BIN: binary,
    ROOTFORM_PROJECT: project,
    ROOTFORM_INPUT: input,
    ROOTFORM_PLAN_FILE: saved,
    ROOTFORM_POLICY_PACK: pack,
    ROOTFORM_OUTPUT_DIR: output,
    ROOTFORM_TEST_ARGS: args,
  };
  return { root, project, input, saved, pack, output, args, env };
}
test("CI recipe runs analysis then a requested policy gate and keeps both artifact sets", () => {
  const f = fixture();
  const result = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: f.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
  const invocations = readFileSync(f.args, "utf8").trim().split("\n");
  expect(invocations).toHaveLength(2);
  const [runArgs, checkArgs] = invocations;
  const canonical = realpathSync(f.root);
  expect(runArgs).toContain(`run ${join(canonical, "plan.json")}`);
  expect(runArgs).toContain(`--project ${f.project}`);
  expect(runArgs).toContain(`--plan-file ${join(canonical, "plan.tfplan")} --require-enrichment`);
  expect(runArgs).not.toContain("--policy");
  expect(runArgs).not.toContain(".sarif");
  expect(checkArgs).toContain(`check ${join(canonical, "results", "analysis.json")}`);
  expect(checkArgs).toContain(`--policy-pack ${join(canonical, "policies")}`);
  for (const name of [
    "analysis.json",
    "report.md",
    "summary.txt",
    "run.stderr",
    "run.status",
    "policy.json",
    "policy.md",
    "results.sarif",
    "check.txt",
    "check.stderr",
    "check.status",
  ]) {
    expect(readFileSync(join(f.output, name), "utf8")).not.toBe("");
  }
  expect(readFileSync(join(f.output, "run.status"), "utf8")).toBe("0\n");
  expect(readFileSync(join(f.output, "check.status"), "utf8")).toBe("0\n");
});
test("CI recipe runs analysis alone only when explicitly requested", () => {
  const f = fixture();
  const { ROOTFORM_POLICY_PACK: _pack, ...env } = f.env;
  const result = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: { ...env, ROOTFORM_MODE: "analyze" },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
  expect(readFileSync(f.args, "utf8").trim().split("\n")).toHaveLength(1);
  expect(readFileSync(join(f.output, "run.status"), "utf8")).toBe("0\n");
  expect(existsSync(join(f.output, "check.status"))).toBe(false);
});
test("required checks cannot disappear with the lock or Policy selection", () => {
  const missing = fixture();
  const { ROOTFORM_POLICY_PACK: _pack, ...withoutPack } = missing.env;
  const refused = Bun.spawnSync(["/bin/sh", script], {
    cwd: missing.root,
    env: withoutPack,
  });
  expect(refused.exitCode).toBe(2);
  expect(existsSync(missing.output)).toBe(false);
  expect(existsSync(missing.args)).toBe(false);
  for (const policyPacks of [[], [{}]]) {
    const f = fixture();
    writeFileSync(join(f.project, "rootform.lock"), JSON.stringify({ policy_packs: policyPacks }));
    const { ROOTFORM_POLICY_PACK: _unused, ...env } = f.env;
    const result = Bun.spawnSync(["/bin/sh", script], {
      cwd: f.root,
      env: { ...env, ROOTFORM_CHECK_STATUS: "3" },
    });
    expect(result.exitCode).toBe(3);
    const invocations = readFileSync(f.args, "utf8").trim().split("\n");
    expect(invocations).toHaveLength(2);
    expect(invocations[1]).toContain("--locked");
    expect(readFileSync(join(f.output, "check.status"), "utf8")).toBe("3\n");
    expect(existsSync(join(f.output, "policy.md"))).toBe(true);
  }
});

test("analysis mode rejects Policy settings and required check rejects a missing Pack", () => {
  const f = fixture();
  const analyze = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: { ...f.env, ROOTFORM_MODE: "analyze" },
  });
  expect(analyze.exitCode).toBe(2);
  const absent = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: { ...f.env, ROOTFORM_POLICY_PACK: join(f.root, "absent") },
  });
  expect(absent.exitCode).toBe(2);
  expect(existsSync(f.output)).toBe(false);
});
test("CI recipe preserves run and policy failures and rejects reused output", () => {
  const f = fixture();
  const runFailure = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: { ...f.env, ROOTFORM_RUN_STATUS: "3" },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(runFailure.exitCode).toBe(3);
  expect(readFileSync(join(f.output, "run.status"), "utf8")).toBe("3\n");
  expect(existsSync(join(f.output, "check.status"))).toBe(false);
  const gate = fixture();
  const checkFailure = Bun.spawnSync(["/bin/sh", script], {
    cwd: gate.root,
    env: { ...gate.env, ROOTFORM_CHECK_STATUS: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(checkFailure.exitCode).toBe(1);
  expect(readFileSync(join(gate.output, "run.status"), "utf8")).toBe("0\n");
  expect(readFileSync(join(gate.output, "check.status"), "utf8")).toBe("1\n");
  const second = Bun.spawnSync(["/bin/sh", script], {
    cwd: gate.root,
    env: gate.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(second.exitCode).toBe(2);
  expect(second.stderr.toString()).toContain("fresh directory");
});
test("CI recipe refuses an ad hoc pack for a locked project before writing outputs", () => {
  const f = fixture();
  writeFileSync(join(f.project, "rootform.lock"), "{}\n");
  const result = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: f.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(2);
  expect(result.stderr.toString()).toContain("rootform.lock");
  expect(existsSync(f.output)).toBe(false);
  expect(existsSync(f.args)).toBe(false);
});
test("CI recipe passes locked policy selectors without shell expansion", () => {
  const f = fixture();
  writeFileSync(join(f.project, "rootform.lock"), "{}\n");
  mkdirSync(join(f.root, "tutorial"));
  writeFileSync(join(f.root, "tutorial", "matched"), "");
  const { ROOTFORM_POLICY_PACK: _pack, ...env } = f.env;
  const result = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: { ...env, ROOTFORM_POLICY: "tutorial/* baseline/managed-database-network-context" },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
  const invocations = readFileSync(f.args, "utf8").trim().split("\n");
  expect(invocations).toHaveLength(2);
  expect(invocations[0]).not.toContain("--policy");
  expect(invocations[1]).toContain(
    `check ${join(realpathSync(f.root), "results", "analysis.json")}`,
  );
  expect(invocations[1]).toContain(
    "--policy tutorial/* --policy baseline/managed-database-network-context --locked",
  );
  expect(invocations[1]).not.toContain("--policy-pack");
  expect(invocations[1]).not.toContain("tutorial/matched");
});
