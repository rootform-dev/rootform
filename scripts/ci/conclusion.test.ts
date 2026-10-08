import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyChanges, fullImpact } from "./impact.ts";

// Exercise the actual workflow conclusion, rather than a duplicate test model.
const workflow = Bun.YAML.parse(
  readFileSync(join(import.meta.dir, "../../.github/workflows/ci.yml"), "utf8"),
) as {
  jobs: { quality: { if: string; steps: Array<{ run: string }> } };
};
const script = workflow.jobs.quality.steps[0]?.run.match(/<<'PYTHON'\n([\s\S]*?)\nPYTHON/u)?.[1];
if (!script) throw new Error("Required conclusion script missing");
test("required check always runs and refuses missing, failed or cancelled selected lanes", () => {
  expect(workflow.jobs.quality.if).toBe("always()");
  const plan = fullImpact("test");
  for (const broken of ["success", "failure", "cancelled", "skipped"]) {
    const results = Object.fromEntries(
      ["impact", "boundary", "docs", "cli", "content", "generated", "distribution", "tooling"].map(
        (name) => [name, { result: name === "cli" ? broken : "success" }],
      ),
    );
    const run = Bun.spawnSync(["python3", "-c", script], {
      env: {
        PATH: process.env.PATH,
        PLAN: JSON.stringify(plan),
        RESULTS: JSON.stringify(results),
        GITHUB_STEP_SUMMARY: join(tmpdir(), "rootform-conclusion-test.md"),
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(run.exitCode === 0).toBe(broken === "success");
  }
});
test("prose skips runtime lanes but cannot hide a failed safety or impact check", () => {
  const plan = classifyChanges([{ path: "docs/index.md", before: "Old", after: "New" }]);
  for (const broken of ["none", "impact", "boundary"]) {
    const results = Object.fromEntries(
      ["impact", "boundary", "docs", "cli", "content", "generated", "distribution", "tooling"].map(
        (name) => [
          name,
          {
            result:
              name === broken
                ? "failure"
                : ["impact", "boundary", "docs"].includes(name)
                  ? "success"
                  : "skipped",
          },
        ],
      ),
    );
    const run = Bun.spawnSync(["python3", "-c", script], {
      env: {
        PATH: process.env.PATH,
        PLAN: JSON.stringify(plan),
        RESULTS: JSON.stringify(results),
        GITHUB_STEP_SUMMARY: join(tmpdir(), "rootform-conclusion-test.md"),
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(run.exitCode === 0).toBe(broken === "none");
  }
});
