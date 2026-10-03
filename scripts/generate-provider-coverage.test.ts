import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { declaredRuleIds } from "./dialects/validate.ts";
import { generateProviderCoverage, ruleCoverage } from "./generate-provider-coverage.ts";

test("coverage preserves shared and owned symbols and the evidence population", () => {
  const source =
    'rule "subnet" {\n match { type = "example_subnet" kind = "data" }\n as = rf.concept.subnet\n context {\n as = context.network\n }\n}';
  expect(ruleCoverage("example", source)).toEqual({
    type: "example_subnet",
    kind: "data",
    symbols: ["example.context.network", "rf.concept.subnet"],
  });
  expect(() => ruleCoverage("example", "rule {}")).toThrow("literal match.type");
});

test("the generated catalog covers every official Rule without claiming complete coverage", () => {
  const content = generateProviderCoverage();
  expect(content).toContain("does not imply complete provider coverage");
  expect(content).toContain("`hashicorp/google-beta`");
  expect(content).toContain("`aws_subnet`");
  expect(content).toContain("`rf.context.network`");
  expect(content).toContain("128 MiB");
  const inventory = JSON.parse(
    readFileSync(join(import.meta.dir, "../dialects/dialects.json"), "utf8"),
  );
  const sourceRules = declaredRuleIds(inventory);
  const documented = [...content.matchAll(/\[`([\w-]+\.rule\.[\w-]+)`\]/gu)].map(
    (match) => match[1],
  );
  expect(new Set(documented)).toEqual(sourceRules);
  expect(documented.length).toBe(sourceRules.size);
});
