import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function verifyRequiredCheckCases(binary: string, root: string): string {
  const script = join(root, "docs/integrations/ci/rootform-ci.sh");
  const emptyLock =
    '{"format_version":"1","dialects":[],"policy_packs":[],"excluded_owners":[],"replacements":[]}\n';
  const scenarios = [
    "missing-lock",
    "last-pack-removed",
    "missing-pack",
    "no-target",
    "pass-and-no-target",
    "lock-removed-after-run",
    "corrupt-lock",
  ] as const;
  for (const scenario of scenarios) {
    const work = mkdtempSync(join(tmpdir(), "rf-ci-required-"));
    try {
      const project = join(work, "project");
      const pack = join(work, "policies");
      const output = join(work, "results");
      mkdirSync(project);
      cpSync(join(root, "policy-packs/baseline"), pack, { recursive: true });
      const env: Record<string, string> = {
        ...process.env,
        ROOTFORM_BIN: binary,
        ROOTFORM_HOME: join(work, "home"),
        ROOTFORM_MODE: "check",
        ROOTFORM_PROJECT: project,
        ROOTFORM_INPUT: join(root, "scripts/fixtures/docs/first-architecture/plan.json"),
        ROOTFORM_PLAN_FILE: join(root, "scripts/fixtures/docs/first-architecture/plan.tfplan"),
        ROOTFORM_OUTPUT_DIR: output,
      };
      delete env.ROOTFORM_POLICY_PACK;
      delete env.ROOTFORM_POLICY;
      if (scenario !== "missing-lock" && scenario !== "pass-and-no-target") {
        writeFileSync(join(project, "rootform.lock"), emptyLock);
      }
      if (scenario === "missing-pack" || scenario === "no-target") {
        const selected = Bun.spawnSync(
          [binary, "add", "policy-packs", pack, "--project", project],
          { env, stdout: "pipe", stderr: "pipe" },
        );
        if (selected.exitCode !== 0) throw new Error(`CI negative setup: ${selected.stderr}`);
        if (scenario === "missing-pack") rmSync(pack, { recursive: true });
      }
      if (scenario === "pass-and-no-target") {
        rmSync(pack, { recursive: true });
        mkdirSync(pack);
        writeFileSync(
          join(pack, "pack.rf.hcl"),
          'policy_pack "required" {\n version = "0.1.0"\n}\npolicy "subnet" {\n target {\n concept = rf.concept.subnet\n }\n assert = true\n message = "A subnet was evaluated."\n}\npolicy "database" {\n target {\n concept = rf.concept.managed-database\n }\n assert = true\n message = "A database was evaluated."\n}\n',
        );
        env.ROOTFORM_POLICY_PACK = pack;
      }
      if (scenario === "corrupt-lock")
        writeFileSync(join(project, "rootform.lock"), "invalid lock\n");
      if (scenario === "lock-removed-after-run") {
        const wrapper = join(work, "rootform-wrapper");
        writeFileSync(
          wrapper,
          '#!/bin/sh\n"$ROOTFORM_REAL_BIN" "$@"\nstatus=$?\nif [ "$1" = run ] && [ "$status" -eq 0 ]; then rm "$ROOTFORM_PROJECT/rootform.lock"; fi\nexit "$status"\n',
          { mode: 0o755 },
        );
        env.ROOTFORM_REAL_BIN = binary;
        env.ROOTFORM_BIN = wrapper;
      }
      const result = Bun.spawnSync(["sh", script], {
        env,
        cwd: work,
        stdout: "pipe",
        stderr: "pipe",
      });
      const expected = scenario === "missing-lock" ? 2 : 3;
      if (result.exitCode !== expected)
        throw new Error(
          `Required CI ${scenario}: exit ${result.exitCode}, expected ${expected}\n${result.stderr}\n${existsSync(join(output, "check.stderr")) ? readFileSync(join(output, "check.stderr"), "utf8") : ""}`,
        );
      if (["last-pack-removed", "no-target", "pass-and-no-target"].includes(scenario)) {
        for (const file of [
          "analysis.json",
          "report.md",
          "policy.json",
          "policy.md",
          "results.sarif",
          "check.status",
        ]) {
          if (!existsSync(join(output, file)))
            throw new Error(`${scenario}: missing retained ${file}`);
        }
        if (readFileSync(join(output, "check.status"), "utf8") !== "3\n")
          throw new Error(`${scenario}: check status lost`);
        const status = JSON.parse(readFileSync(join(output, "policy.json"), "utf8")).status;
        const expectedStatus = scenario === "last-pack-removed" ? "failed" : "no_decision";
        if (status !== expectedStatus)
          throw new Error(`${scenario}: got ${status}, expected ${expectedStatus}`);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  const version = Bun.spawnSync([binary, "version"], { stdout: "pipe" })
    .stdout.toString()
    .trim()
    .replace(/^rootform /u, "");
  for (const kind of ["pass", "no-target"] as const) {
    const work = mkdtempSync(join(tmpdir(), "rf-ci-wrapper-"));
    try {
      mkdirSync(join(work, "ci"));
      mkdirSync(join(work, "project"));
      mkdirSync(join(work, "temporary"));
      for (const file of ["generic-ci.sh", "rootform-ci.sh"])
        cpSync(join(root, "docs/integrations/ci", file), join(work, "ci", file));
      cpSync(join(root, "policy-packs/baseline"), join(work, "policies"), { recursive: true });
      const inputRoot = join(
        root,
        kind === "pass"
          ? "examples/playground/commerce-platform/head"
          : "scripts/fixtures/docs/first-architecture",
      );
      const env: Record<string, string> = {
        ...process.env,
        ROOTFORM_BIN: binary,
        ROOTFORM_VERSION: version,
        ROOTFORM_MODE: "check",
        ROOTFORM_PROJECT: join(work, "project"),
        ROOTFORM_INPUT: join(inputRoot, "plan.json"),
        ROOTFORM_PLAN_FILE: join(inputRoot, "plan.tfplan"),
        ROOTFORM_OUTPUT_DIR: join(work, "results"),
        TMPDIR: join(work, "temporary"),
      };
      delete env.ROOTFORM_HOME;
      delete env.ROOTFORM_POLICY_PACK;
      delete env.ROOTFORM_POLICY;
      const select = Bun.spawnSync([binary, "add", "policy-packs", "../policies"], {
        cwd: join(work, "project"),
        env: { ...env, ROOTFORM_HOME: join(work, "setup-home") },
        stdout: "pipe",
        stderr: "pipe",
      });
      if (select.exitCode !== 0) throw new Error(`Wrapper setup: ${select.stderr}`);
      const result = Bun.spawnSync(["sh", "ci/generic-ci.sh"], {
        cwd: work,
        env,
        stdout: "pipe",
        stderr: "pipe",
      });
      const expected = kind === "pass" ? 0 : 3;
      if (result.exitCode !== expected)
        throw new Error(
          `CI wrapper ${kind}: got ${result.exitCode}, expected ${expected}\n${result.stderr}`,
        );
      if (readFileSync(join(work, "results/check.status"), "utf8") !== `${expected}\n`)
        throw new Error("Wrapper lost check status");
      if (readdirSync(join(work, "temporary")).length !== 0)
        throw new Error("Wrapper left temporary tools or home behind");
      if (!existsSync(join(work, "results/policy.md")))
        throw new Error("Wrapper deleted the failed check report");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  return `Required CI gate: ${scenarios.length} real-binary negative cases passed; wrapper preparation, status and owned cleanup passed for approval and no target.`;
}
