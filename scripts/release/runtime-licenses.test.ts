import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readRuntimeLicensing, validateRuntimeLicensing } from "./runtime-licenses.ts";

const root = join(import.meta.dir, "..", "..");

test("validates complete generated runtime licensing inputs", () => {
  const licensing = readRuntimeLicensing(root);
  expect(licensing.componentCount).toBe(88);
  expect(licensing.inventorySha256).toMatch(/^[0-9a-f]{64}$/);
});

test("rejects notice and inventory drift", () => {
  const inventory = readFileSync(join(root, "dependencies", "runtime-components.json"));
  const notices = readFileSync(join(root, "THIRD_PARTY_NOTICES.txt"));
  expect(() =>
    validateRuntimeLicensing(
      inventory,
      Buffer.from(notices.toString("utf8").replace("MIT License", "MIT Terms")),
    ),
  ).toThrow("digest drifted");
  expect(() =>
    validateRuntimeLicensing(
      Buffer.from(
        inventory
          .toString("utf8")
          .replace('"format_version": "1"', '"format_version": "unsupported"'),
      ),
      notices,
    ),
  ).toThrow("invalid structure");
});
