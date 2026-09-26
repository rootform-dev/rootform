import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
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
printf '%s\\n' "$*" > "$ROOTFORM_TEST_ARGS"
for arg do
  case "$previous" in
    -o) printf 'artifact\\n' > "$arg" ;;
  esac
  previous=$arg
done
printf 'summary\\n'
printf 'diagnostic\\n' >&2
exit "\${ROOTFORM_TEST_STATUS:-0}"
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
test("CI recipe runs one analysis with verified plan and keeps current artifacts", () => {
  const f = fixture();
  const result = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: f.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
  const args = readFileSync(f.args, "utf8");
  const canonical = realpathSync(f.root);
  expect(args).toContain(`run ${join(canonical, "plan.json")}`);
  expect(args).toContain(`--project ${f.project}`);
  expect(args).toContain(`--plan-file ${join(canonical, "plan.tfplan")} --require-enrichment`);
  expect(args).toContain(`--policy-pack ${join(canonical, "policies")}`);
  for (const name of [
    "analysis.json",
    "report.md",
    "results.sarif",
    "summary.txt",
    "run.stderr",
    "run.status",
  ]) {
    expect(readFileSync(join(f.output, name), "utf8")).not.toBe("");
  }
  expect(readFileSync(join(f.output, "run.status"), "utf8")).toBe("0\n");
});
test("CI recipe preserves a policy failure and rejects reused output", () => {
  const f = fixture();
  const first = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: { ...f.env, ROOTFORM_TEST_STATUS: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(first.exitCode).toBe(1);
  expect(readFileSync(join(f.output, "run.status"), "utf8")).toBe("1\n");
  const second = Bun.spawnSync(["/bin/sh", script], {
    cwd: f.root,
    env: f.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(second.exitCode).toBe(2);
  expect(second.stderr.toString()).toContain("fresh directory");
});
