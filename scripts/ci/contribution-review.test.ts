import { expect, test } from "bun:test";
import { classifyChanges } from "./impact.ts";

test("a removed prose page retains docs checks without runtime qualification", () => {
  const plan = classifyChanges([{ path: "docs/removed.md", before: "Old prose", after: null }]);
  expect(plan.lanes.docs && plan.preview).toBe(true);
  expect(plan.lanes.cli || plan.scenarios || plan.core || plan.registry).toBe(false);
});
