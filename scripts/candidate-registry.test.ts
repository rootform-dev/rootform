import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Job = {
  needs?: string | string[];
  permissions?: Record<string, string>;
  steps?: { name?: string; run?: string; env?: Record<string, string> }[];
};

const workflow = Bun.YAML.parse(
  readFileSync(join(import.meta.dir, "..", ".github", "workflows", "candidate.yml"), "utf8"),
) as { jobs: Record<string, Job> };
const registry = workflow.jobs.registry;
const consume = registry?.steps?.find(
  (step) => step.name === "Verify the proof draft and exact binary binding",
);
if (!consume?.run) throw new Error("candidate registry evidence consumer is missing");

for (const count of [0, 2]) {
  test(`candidate refuses ${count} registry receipts before reading executable evidence`, () => {
    // No receipt is consumed when the release lookup is absent or ambiguous.
    const script = `gh() { printf '[]\\n'; }\njq() { cat >/dev/null; printf '${count}\\n'; }\n${consume.run}`;
    const result = Bun.spawnSync(["/bin/bash", "-c", script], {
      env: {
        GITHUB_REPOSITORY: "rootform-dev/rootform",
        PATH: "/usr/bin:/bin",
        RELEASE_ID: "42",
        VERSION: "0.2.0-rc.1",
      },
      timeout: 2000,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stdout.toString()).toBe(
      "::error::Registry qualification evidence is unavailable for this draft.\n",
    );
    expect(result.stderr.toString()).toBe("");
  });
}

test("registry failure blocks the qualification record and public success report", () => {
  expect(workflow.jobs.record?.needs).toContain("registry");
  expect(workflow.jobs.evidence?.needs).toContain("registry");
  const evidence = workflow.jobs.evidence?.steps?.find((step) => step.env?.QUALIFY_RESULT);
  expect(evidence?.env?.QUALIFY_RESULT).toContain("needs.registry.result == 'success'");
  expect(consume.env?.RELEASE_ID).toMatch(/^\$\{\{ needs\.qualify\.outputs\.release_id \}\}$/u);
  expect(consume.env?.HANDOFF_RELEASE_ID).toMatch(
    /^\$\{\{ needs\.qualify\.outputs\.handoff_release_id \}\}$/u,
  );
});

test("public candidate jobs have no registry publication permission or credential", () => {
  for (const job of Object.values(workflow.jobs)) {
    expect(job.permissions?.packages).not.toBe("write");
    for (const step of job.steps ?? []) {
      expect(step.env?.ROOTFORM_REGISTRY_PASSWORD).toBeUndefined();
      expect(step.run ?? "").not.toContain("ROOTFORM_OCI_QUALIFICATION_REPOSITORY");
    }
  }
});
