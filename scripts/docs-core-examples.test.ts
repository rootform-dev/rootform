import { expect, test } from "bun:test";
import { assertHelpUsage, configuration, markedCommand } from "./docs-core-examples.ts";

test("executable documentation markers bind one exact adjacent shell block", () => {
  const page = "<!-- docs-check:run -->\n```sh\nrootform run plan.json --locked --no-serve\n```\n";
  expect(markedCommand(page, "run")).toBe("rootform run plan.json --locked --no-serve");
  expect(() => markedCommand(page + page, "run")).toThrow("Expected one");
  expect(() => markedCommand(page.replace("```sh", "```text"), "run")).toThrow("Expected shell");
});

test("configuration blocks require a unique filename", () => {
  const page = '```hcl title="main.tf"\nresource "example" "one" {}\n```\n';
  expect(configuration(page, "main.tf")).toBe('resource "example" "one" {}\n');
  expect(() => configuration(page, "other.tf")).toThrow("Expected one");
  expect(() => configuration(page + page, "main.tf")).toThrow("Expected one");
});

test("Rootform configuration accepts either fence tag but requires exactly one block", () => {
  const hcl = '```hcl title="policies/pack.rf.hcl"\npolicy_pack "sample" {}\n```\n';
  const rf = hcl.replace("```hcl", "```rf");
  expect(configuration(hcl, "policies/pack.rf.hcl")).toBe('policy_pack "sample" {}\n');
  expect(configuration(rf, "policies/pack.rf.hcl")).toBe('policy_pack "sample" {}\n');
  expect(() => configuration(hcl + rf, "policies/pack.rf.hcl")).toThrow("Expected one");
  expect(() => configuration(rf, "main.tf")).toThrow("Expected one");
  expect(() => configuration(hcl.replace("```hcl", "```json"), "policies/pack.rf.hcl")).toThrow(
    "Expected one",
  );
});

test("root usage mismatch fails rather than skipping the public export", () => {
  const help = "Usage:\n  rootform [command]\n\nFlags:\n";
  expect(() => assertHelpUsage("rootform", "rootform [command]", help)).not.toThrow();
  expect(() => assertHelpUsage("rootform", "rootform [flags]", help)).toThrow(
    'rootform usage differs from public export: help "rootform [command]", export "rootform [flags]"',
  );
});
