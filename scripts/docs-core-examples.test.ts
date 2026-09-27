import { expect, test } from "bun:test";
import {
  assertHelpUsage,
  configuration,
  markedCommand,
  retiredCommand,
} from "./docs-core-examples.ts";

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
  const help = "Understand Terraform.\n\nUsage\n  rootform <command> [options]\n\nGlobal options\n";
  expect(() => assertHelpUsage("rootform", "rootform <command> [options]", help)).not.toThrow();
  expect(() => assertHelpUsage("rootform", "rootform [options]", help)).toThrow(
    'rootform usage differs from public export: help "rootform <command> [options]", export "rootform [options]"',
  );
});

test("renamed commands and retired options are refused in documented commands", () => {
  const fence = "```";
  const code = (command: string) => `${fence}sh\n${command}\n${fence}\n`;
  const refused: Array<[string, string]> = [
    ["rootform explain architecture aws_vpc.main", "explain instance and explain rule"],
    ["rootform explain semantics aws.rule.vpc", "explain instance and explain rule"],
    ["rootform explain instance aws_vpc.main", "--input"],
    ["rootform explain rule aws.rule.vpc --stage planned", "--input"],
    ["rootform explain policy baseline/network", "--result"],
    ["rootform list dialects -o json", "--format"],
    ["rootform show policy baseline/network --output=json", "--format"],
    ["rootform init . -v", "--details"],
    ["rootform init --verbose", "--details"],
    ["rootform run comparison.json --before-side recorded", "reopens alone"],
    ["rootform check comparison.json --after-side planned", "reopens alone"],
  ];
  for (const [command, reason] of refused) {
    expect(retiredCommand(code(command))).toContain(reason);
  }
  expect(retiredCommand("Use `rootform explain semantics` no more.")).toContain("explain rule");
  for (const command of [
    "rootform explain instance aws_vpc.main --input plan.json",
    "rootform explain rule aws.rule.vpc --input=form.json --side after",
    "rootform explain policy baseline/network --result results.json --input plan.json",
    "rootform explain policy --help",
    "rootform explain rule -h",
    "rootform list dialects --format json",
    "rootform show policy baseline/network --format json",
    "rootform init --details",
    "rootform run before.json --diff after.json --no-serve -o comparison.json",
  ]) {
    expect(retiredCommand(code(command))).toBeUndefined();
  }
  expect(retiredCommand("Name a Form with `rootform explain instance`.")).toBeUndefined();
});
