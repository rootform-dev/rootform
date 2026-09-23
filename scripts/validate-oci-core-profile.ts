#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

const required = [
  "rootform-oci-core-v1",
  "application/vnd.rootform.dialect.v1",
  "application/vnd.rootform.dialect.manifest.v1+json",
  "application/vnd.rootform.dialect.layer.v1.tar+gzip",
  "application/vnd.rootform.policy-pack.v1",
  "application/vnd.rootform.policy-pack.manifest.v1+json",
  "application/vnd.rootform.policy-pack.layer.v1.tar+gzip",
  "Policy Packs define no index artifact in V0",
  "Dialects define no index artifact in V0",
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

const qualifiedPaths = [
  "Local qualification covers CNCF Distribution 3.0 over anonymous TLS.",
  "Private Basic authentication and Docker credential-helper access to Distribution are not qualified by this path.",
  "Candidate qualification against a transient public GHCR package uses a Docker credential helper under GitHub Actions' repository-inherited package visibility.",
  "It does not separately prove the Bearer challenge exchange, anonymous pull, or private-package access.",
].join(" ");

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
  const portability = body.split("\n## Portability test\n")[1]?.split("\n## ")[0];
  const claims = portability?.split("Local qualification")[1]?.split("Qualification content")[0];
  if (!claims || `Local qualification${claims}`.replace(/\s+/gu, " ").trim() !== qualifiedPaths) {
    throw new Error("OCI Core Profile qualification paths differ from tested paths");
  }
  const outsideClaims = portability?.replace(`Local qualification${claims}`, "") ?? "";
  if (
    /private Basic|Bearer challenge exchange|anonymous pull|private-package access/iu.test(
      outsideClaims,
    )
  ) {
    throw new Error("OCI Core Profile qualification paths differ from tested paths");
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
