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
    "Policy Packs define no index artifact in V0",
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

test("OCI qualification claims stay within the maintained registry paths", () => {
  const qualifier = readFileSync(join(import.meta.dir, "qualify-image.ts"), "utf8");
  const distributionRun = qualifier.match(
    /docker\(\[\s*"run",\s*"--detach",[\s\S]*?REGISTRY_IMAGE,\s*\]\)/u,
  )?.[0];
  expect(distributionRun).toContain("REGISTRY_HTTP_TLS_CERTIFICATE=");
  expect(distributionRun).toContain("REGISTRY_HTTP_TLS_KEY=");
  expect(distributionRun).not.toMatch(/REGISTRY_AUTH|htpasswd|DOCKER_CONFIG/u);

  for (const changed of [
    profile.replace("anonymous TLS.", "anonymous TLS and private Basic."),
    profile.replace("are\nnot qualified by this path.", "are\nqualified by this path."),
    profile.replace("It does not separately prove", "It proves"),
    profile.replace(
      "Qualification content is synthetic",
      "Private Basic also passed qualification. Qualification content is synthetic",
    ),
  ]) {
    expect(changed).not.toBe(profile);
    expect(() => validateOCICoreProfile(changed)).toThrow(
      "qualification paths differ from tested paths",
    );
  }
});
