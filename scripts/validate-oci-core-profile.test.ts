import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateOCICoreProfile } from "./validate-oci-core-profile.ts";

const profile = readFileSync(
  join(import.meta.dir, "..", "contracts", "rootform-oci-core-profile.md"),
  "utf8",
);

test("OCI Core Profile names exact used capabilities and exclusions", () => {
  expect(() => validateOCICoreProfile(profile)).not.toThrow();
  for (const required of [
    "manifest resolution by tag or digest",
    "application/vnd.rootform.policy-pack.v1",
    "Policy Pack V0 defines no index artifact",
  ]) {
    expect(() => validateOCICoreProfile(profile.replace(required, ""))).toThrow(
      "OCI Core Profile omits",
    );
  }
});

test("OCI Core Profile cannot make an excluded feature mandatory", () => {
  for (const requirement of [
    "Registry must implement Referrers for dialect pulls.",
    "Registry must implement PATCH for dialect blob uploads.",
  ]) {
    expect(() => validateOCICoreProfile(`${profile}\n${requirement}\n`)).toThrow(
      "requires an excluded registry feature",
    );
  }
});
