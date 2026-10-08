import { describe, expect, test } from "bun:test";
import { classifyChanges, executableContent, lanes } from "./impact.ts";

describe("contribution impact", () => {
  test("registry prose stays cheap, changed publication commands require TLS qualification", () => {
    const before =
      "<!-- docs-check:external-add-oci -->\n```sh\nrootform add dialects oci://registry.example/payments\n```\nOld prose";
    const prose = classifyChanges([
      { path: "docs/content.md", before, after: before.replace("Old prose", "New prose") },
    ]);
    expect(prose.registry).toBe(false);
    const executable = classifyChanges([
      { path: "docs/content.md", before, after: before.replace("payments", "billing") },
    ]);
    expect(executable.registry && executable.lanes.examples).toBe(true);
    expect(classifyChanges([{ path: "scripts/ci/run.ts" }]).registry).toBe(true);
  });
  test("prose in source and example directories does not turn into a code change", () => {
    for (const path of [
      "cli/README.md",
      "dialects/README.md",
      "policy-packs/README.md",
      "examples/playground/README.md",
    ]) {
      const plan = classifyChanges([{ path, before: "Old prose", after: "Clear prose" }]);
      expect(Object.values(plan.lanes).some(Boolean)).toBe(false);
      expect(plan.core || plan.scenarios || plan.preview).toBe(false);
    }
  });
  test("actual public model packages trigger consumers of shared wire contracts", () => {
    for (const path of [
      "cli/form/document.go",
      "cli/policyresult/document.go",
      "cli/detect/detect.go",
      "cli/backend/backend.go",
    ]) {
      const plan = classifyChanges([{ path }]);
      expect(
        plan.lanes.cli && plan.lanes.dialects && plan.lanes.policies && plan.lanes.distribution,
      ).toBe(true);
    }
  });
  test("authored paths with generated blocks still validate generated output", () => {
    const marker = "<!-- BEGIN GENERATED ACTION -->";
    const plan = classifyChanges([
      {
        path: "docs/integrations/github-actions/setup.md",
        before: `${marker}\nOld description`,
        after: `${marker}\nChanged description`,
      },
    ]);
    expect(plan.lanes.docs).toBe(true);
    expect(plan.lanes.generated).toBe(true);
    expect(plan.lanes.cli).toBe(false);
    expect(plan.scenarios).toBe(false);
  });
  test("prose, including prose around unchanged code, does not run runtime lanes", () => {
    const plan = classifyChanges([
      {
        path: "docs/index.md",
        before: "Old prose\n```sh\nrootform run plan.json\n```",
        after: "New prose\n```sh\nrootform run plan.json\n```",
      },
    ]);
    expect(plan.preview).toBe(true);
    expect(
      Object.entries(plan.lanes)
        .filter(([, value]) => value)
        .map(([key]) => key),
    ).toEqual(["docs"]);
    expect(plan.core).toBe(false);
    expect(plan.scenarios).toBe(false);
  });
  test("recipes and changed executable fences trigger examples", () => {
    for (const change of [
      { path: "docs/integrations/ci/rootform-ci.sh" },
      {
        path: "docs/run.md",
        before: "```sh\nrootform run a\n```",
        after: "```sh\nrootform run b\n```",
      },
      { path: "docs/run.md", before: "Use `rootform run`.", after: "Use `rootform check`." },
    ])
      expect(classifyChanges([change]).lanes.examples).toBe(true);
  });
  test("generated provenance selects its lane from both reference locations", () => {
    for (const path of ["reference/cli.json", "contracts/reference/cli.json"]) {
      const marker = `<!-- Generated from ${path}. Run bun run generate:cli; do not edit this page. -->`;
      const plan = classifyChanges([
        { path: "docs/reference/cli/run.md", before: `${marker}\nOld`, after: `${marker}\nNew` },
      ]);
      expect(plan.lanes.generated).toBe(true);
    }
  });
  test("renames select old and new ownership, removals retain runtime validation", () => {
    const plan = classifyChanges([
      { path: "examples/dialect.rf.hcl", previousPath: "dialects/aws/dialect.rf.hcl" },
    ]);
    expect(plan.lanes.dialects && plan.lanes.examples).toBe(true);
    expect(
      classifyChanges([{ path: "docs/run.md", before: "```sh\nrootform run a\n```", after: null }])
        .lanes.examples,
    ).toBe(true);
  });
  test("mixed changes union lanes; core, scenarios and docs are separate", () => {
    const plan = classifyChanges([
      { path: "docs/index.md", before: "Old", after: "New" },
      { path: "cli/cmd/run.go" },
    ]);
    expect(plan.lanes.docs && plan.lanes.cli).toBe(true);
    expect(plan.core).toBe(true);
    expect(plan.scenarios).toBe(false);
    const scenario = classifyChanges([{ path: "examples/playground/forms/aws.json" }]);
    expect(scenario.scenarios).toBe(true);
    expect(scenario.core).toBe(false);
  });
  test("tooling, common dependency, contracts, unknown and incomplete diffs fail broad", () => {
    for (const change of [
      { path: "package.json" },
      { path: "scripts/ci/impact.ts" },
      { path: ".github/workflows/ci.yml" },
      { path: "new-tool" },
      { path: "schemas/form.schema.json" },
      { path: "docs/index.md" },
    ]) {
      expect(lanes.every((lane) => classifyChanges([change]).lanes[lane])).toBe(true);
    }
  });
  test("unbalanced Markdown fences are not treated as prose", () => {
    expect(executableContent("~~~sh\nrootform run a")).toBeNull();
    expect(
      classifyChanges([{ path: "docs/run.md", before: "", after: "~~~sh\nrootform run a" }]).lanes
        .examples,
    ).toBe(true);
  });
});
