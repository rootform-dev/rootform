import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRendererPresentation } from "./renderer-presentation.ts";

function fixture(conflict: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "rf-presentation-"));
  mkdirSync(join(root, "dialects/alpha"), { recursive: true });
  mkdirSync(join(root, "dialects/beta"), { recursive: true });
  writeFileSync(
    join(root, "dialects/dialects.json"),
    JSON.stringify({
      format_version: "1",
      dialects: [{ name: "alpha" }, { name: "beta" }],
    }),
  );
  writeFileSync(
    join(root, "dialects/alpha/presentation.json"),
    JSON.stringify({
      format_version: "1",
      resources: { "resource/example_widget": "generic/entity" },
      rules: { widget: "generic/entity" },
      concepts: { widget: "generic/entity" },
    }),
  );
  writeFileSync(
    join(root, "dialects/beta/presentation.json"),
    JSON.stringify({
      format_version: "1",
      resources: { "resource/example_widget": conflict ? "generic/network" : "generic/entity" },
      rules: { widget: "generic/compute" },
    }),
  );
  return root;
}
test("merged catalog qualifies Dialect keys and supplies neutral RF concept identities", () => {
  const catalog = JSON.parse(buildRendererPresentation(fixture(false)));
  expect(catalog.rules["alpha.rule.widget"]).toBe("generic/entity");
  expect(catalog.rules["beta.rule.widget"]).toBe("generic/compute");
  expect(catalog.concepts["rf.concept.kubernetes-cluster"]).toBe("kubernetes/cluster");
  expect(catalog.concepts["rf.concept.virtual-network"]).toBe("generic/network");
  expect(catalog.concept_labels["rf.concept.virtual-network"]).toBe("Virtual network");
});
test("conflicting resource presentation identities fail closed", () => {
  expect(() => buildRendererPresentation(fixture(true))).toThrow(
    "Conflicting presentation identity",
  );
});
