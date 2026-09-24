import { expect, test } from "bun:test";
import { fenced } from "./docs-language-examples.ts";

test(".rf.hcl examples accept either tag and still require exact count", () => {
  const hcl = '```hcl title="dialect.rf.hcl"\ndialect "sample" {}\n```\n';
  const rf = hcl.replace("```hcl", "```rf");
  expect(fenced(hcl, "hcl", "dialect.rf.hcl")).toBe('dialect "sample" {}\n');
  expect(fenced(rf, "hcl", "dialect.rf.hcl")).toBe('dialect "sample" {}\n');
  expect(() => fenced(hcl + rf, "hcl", "dialect.rf.hcl")).toThrow("expected 1");
  expect(() => fenced(rf, "hcl", "other.rf.hcl")).toThrow("expected 1");
  expect(() => fenced(rf, "hcl", "main.tf")).toThrow("expected 1");
});
