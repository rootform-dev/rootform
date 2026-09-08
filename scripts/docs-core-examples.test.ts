import { expect, test } from "bun:test";
import { configuration, markedCommand } from "./docs-core-examples.ts";

test("executable documentation markers bind one exact adjacent shell block", () => {
  const page = "<!-- docs-check:build -->\n```sh\nrootform build . --offline\n```\n";
  expect(markedCommand(page, "build")).toBe("rootform build . --offline");
  expect(() => markedCommand(page + page, "build")).toThrow("Expected one");
  expect(() => markedCommand(page.replace("```sh", "```text"), "build")).toThrow("Expected shell");
});

test("configuration blocks require a unique filename", () => {
  const page = '```hcl title="main.tf"\nresource "example" "one" {}\n```\n';
  expect(configuration(page, "main.tf")).toBe('resource "example" "one" {}\n');
  expect(() => configuration(page, "other.tf")).toThrow("Expected one");
  expect(() => configuration(page + page, "main.tf")).toThrow("Expected one");
});
