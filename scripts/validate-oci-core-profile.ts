#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

const required = [
  "rootform-oci-core-v1",
  "application/vnd.rootform.dialect.v1",
  "application/vnd.rootform.dialect.manifest.v1+json",
  "application/vnd.rootform.dialect.layer.v1.tar+gzip",
  "application/vnd.rootform.dialect-index.v1",
  "application/vnd.rootform.dialect-index.config.v1+json",
  "application/vnd.rootform.dialect-index.v1+json",
  "manifest resolution by tag or digest",
  "blob fetch by digest",
  "two-step monolithic blob upload",
  "manifest and tag creation with `PUT`",
  "host-specific `credHelpers`",
  "Basic credentials and Bearer challenge",
  "equal digest is idempotent",
  "Referrers API",
  "registry catalog",
  "manifest or blob deletion",
  "chunked `PATCH` blob uploads",
  "signatures, attestations",
  "SBOM storage",
  "VCS access",
] as const;

const forbiddenRequirements = [
  /(?:requires?|must implement)[^\n]*(?:Referrers|catalog|deletion|PATCH|signatures?|SBOM|VCS)/iu,
  /(?:Referrers|catalog|deletion|PATCH|signatures?|SBOM|VCS)[^\n]*(?:is required|are required)/iu,
] as const;

export function validateOCICoreProfile(body: string): void {
  const normalized = body.replace(/\s+/gu, " ");
  for (const value of required) {
    if (!normalized.includes(value)) throw new Error(`OCI Core Profile omits: ${value}`);
  }
  for (const pattern of forbiddenRequirements) {
    if (pattern.test(body))
      throw new Error("OCI Core Profile requires an excluded registry feature");
  }
  if (!body.includes("Profile does not require:")) {
    throw new Error("OCI Core Profile has no explicit exclusion boundary");
  }
}

if (import.meta.main) {
  try {
    const root = join(import.meta.dir, "..");
    validateOCICoreProfile(
      readFileSync(join(root, "contracts", "rootform-oci-core-profile.md"), "utf8"),
    );
    console.log("Rootform OCI Core Profile valid.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
