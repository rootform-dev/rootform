import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workflow = Bun.YAML.parse(
  readFileSync(join(import.meta.dir, "..", ".github", "workflows", "candidate.yml"), "utf8"),
) as { jobs: { qualify: { steps: { name?: string; run?: string }[] } } };
const cleanup = workflow.jobs.qualify.steps.find(
  (step) => step.name === "Remove transient registry material",
)?.run;
if (!cleanup) throw new Error("candidate registry cleanup is missing");

for (const scenario of [
  {
    name: "preserves an unclaimed namespace",
    claimed: false,
    attempted: true,
    package: "rootform-oci-qualification-123",
    deleted: false,
  },
  {
    name: "preserves an unattempted namespace",
    claimed: true,
    attempted: false,
    package: "rootform-oci-qualification-123",
    deleted: false,
  },
  {
    name: "deletes its claimed attempted namespace",
    claimed: true,
    attempted: true,
    package: "rootform-oci-qualification-123",
    deleted: true,
  },
  {
    name: "preserves a package outside qualification scope",
    claimed: true,
    attempted: true,
    package: "dialects",
    deleted: false,
  },
]) {
  test(`candidate cleanup ${scenario.name} and removes local credentials`, () => {
    const temporary = mkdtempSync(join(tmpdir(), "rootform-candidate-cleanup-"));
    try {
      const tools = join(temporary, "tools");
      const runner = join(temporary, "runner");
      const config = join(runner, "config");
      const helper = join(runner, "helper");
      const proof = join(runner, "proof");
      const deletes = join(temporary, "deletes.log");
      for (const path of [tools, config, helper]) mkdirSync(path, { recursive: true });
      writeFileSync(proof, "synthetic credential-helper proof\n");
      writeFileSync(
        join(tools, "gh"),
        '#!/bin/sh\nprintf "%s\\n" "$*" >> "$ROOTFORM_DELETE_PROOF"\n',
        { mode: 0o755 },
      );
      const result = Bun.spawnSync(["/bin/bash", "-c", cleanup], {
        env: {
          PATH: `${tools}:/usr/bin:/bin`,
          RUNNER_TEMP: runner,
          DOCKER_CONFIG: config,
          ROOTFORM_CREDENTIAL_HELPER_DIR: helper,
          ROOTFORM_CREDENTIAL_PROOF: proof,
          ROOTFORM_NAMESPACE_CLAIMED: String(scenario.claimed),
          ROOTFORM_PROFILE_ATTEMPTED: String(scenario.attempted),
          ROOTFORM_OCI_QUALIFICATION_PACKAGE: scenario.package,
          GITHUB_REPOSITORY_OWNER: "rootform-dev",
          ROOTFORM_DELETE_PROOF: deletes,
        },
        timeout: 2000,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(result.exitCode).toBe(0);
      expect(existsSync(deletes)).toBe(scenario.deleted);
      if (scenario.deleted) {
        expect(readFileSync(deletes, "utf8")).toBe(
          `api --method DELETE orgs/rootform-dev/packages/container/${scenario.package}\n`,
        );
      }
      for (const path of [config, helper, proof]) expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
}
