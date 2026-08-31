#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { normalizeVersion, RELEASE_TARGETS, releaseAssetName } from "./release/contract.ts";
import { parseChecksumFile } from "./release/digest.ts";

export const DISTRIBUTION_EVIDENCE_MARKER = "<!-- rootform:distribution-evidence -->";

type ArtifactEvidence = {
  architecture: string;
  asset: string;
  bytes: number;
  operatingSystem: string;
  rawSha256: string;
  sha256: string;
};

export type CandidateEvidence = {
  artifacts: ArtifactEvidence[];
  checksums: string;
  componentCount: number;
  dialectCommit: string;
  distributionCommit: string;
  handoffSha256: string;
  licenseSpdx: string;
  releaseUrl: string;
  runUrl: string;
  version: string;
};

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function githubUrl(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is invalid`);
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com" || parsed.username) {
    throw new Error(`${label} must be an authenticated GitHub URL`);
  }
  return value;
}

function short(value: string): string {
  return value.slice(0, 12);
}

function mebibytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function validateEvidence(value: CandidateEvidence): CandidateEvidence {
  const version = normalizeVersion(value.version);
  string(value.distributionCommit, "distribution commit", /^[0-9a-f]{40}$/u);
  string(value.dialectCommit, "Dialects commit", /^[0-9a-f]{40}$/u);
  string(value.handoffSha256, "handoff digest", /^[0-9a-f]{64}$/u);
  if (value.licenseSpdx !== "Elastic-2.0") throw new Error("binary license is invalid");
  if (!Number.isSafeInteger(value.componentCount) || value.componentCount < 1) {
    throw new Error("runtime license component count is invalid");
  }
  githubUrl(value.releaseUrl, "draft release URL");
  githubUrl(value.runUrl, "workflow URL");
  if (value.artifacts.length !== RELEASE_TARGETS.length) {
    throw new Error("final release target set is incomplete");
  }
  const checksums = parseChecksumFile(value.checksums);
  const expectedAssets = RELEASE_TARGETS.map((target) => releaseAssetName(version, target)).sort(
    (left, right) => left.localeCompare(right, "en"),
  );
  const expectedChecksums = [
    ...expectedAssets,
    "ROOTFORM-BINARY-LICENSE.txt",
    "THIRD_PARTY_NOTICES.txt",
    `rootform_${version}_manifest.json`,
    `rootform_${version}_sbom.spdx.json`,
  ].sort((left, right) => left.localeCompare(right, "en"));
  const actualChecksums = [...checksums.keys()].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  if (JSON.stringify(actualChecksums) !== JSON.stringify(expectedChecksums)) {
    throw new Error("final release checksum inventory is invalid");
  }
  const actualAssets = value.artifacts
    .map(({ asset }) => asset)
    .sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
    throw new Error("final release artifact inventory is invalid");
  }
  for (const artifact of value.artifacts) {
    string(artifact.asset, "release asset", /^[A-Za-z0-9._-]+$/u);
    string(artifact.operatingSystem, "target operating system", /^(?:darwin|linux|windows)$/u);
    string(artifact.architecture, "target architecture", /^(?:amd64|arm64)$/u);
    string(artifact.sha256, "archive digest", /^[0-9a-f]{64}$/u);
    string(artifact.rawSha256, "raw executable digest", /^[0-9a-f]{64}$/u);
    if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1) {
      throw new Error(`release artifact size is invalid: ${artifact.asset}`);
    }
    if (checksums.get(artifact.asset) !== artifact.sha256) {
      throw new Error(`release checksum drifted: ${artifact.asset}`);
    }
  }
  return value;
}

export function renderCandidateEvidence(input: CandidateEvidence): string {
  const evidence = validateEvidence(input);
  const artifacts = [...evidence.artifacts].sort((left, right) =>
    `${left.operatingSystem}/${left.architecture}`.localeCompare(
      `${right.operatingSystem}/${right.architecture}`,
      "en",
    ),
  );
  const artifactRows = artifacts
    .map(
      (artifact) =>
        `| ${artifact.operatingSystem} / ${artifact.architecture} | ${mebibytes(artifact.bytes)} | \`${short(artifact.rawSha256)}\` | \`${short(artifact.sha256)}\` |`,
    )
    .join("\n");

  return `${DISTRIBUTION_EVIDENCE_MARKER}
## Distribution candidate evidence

\`handoff:${short(evidence.handoffSha256)} → rootform:${short(evidence.distributionCommit)} → draft:v${evidence.version}\`

**Qualified** · ${artifacts.length}/${artifacts.length} target archives · ${evidence.componentCount} licensed components · ${evidence.licenseSpdx}

| Gate | Evidence |
| :-- | :-- |
| Opaque handoff | Authenticated two-asset input · \`${short(evidence.handoffSha256)}\` |
| Executable integrity | Raw bytes preserved across every archive |
| Product exercises | 5 deterministic Terraform/OpenTofu examples |
| Dialects compatibility | Complete official matrix · \`${short(evidence.dialectCommit)}\` |
| Licensing | ${evidence.licenseSpdx} · ${evidence.componentCount} inventoried components |
| Final assets | Canonical inventory and checksums reverified |

| Target | Archive size | Raw executable | Final archive |
| :-- | --: | :-- | :-- |
${artifactRows}

<details>
<summary>Exact final SHA-256 records</summary>

\`\`\`text
${evidence.checksums.trimEnd()}
\`\`\`
</details>

[Open draft release](${evidence.releaseUrl}) · [Open workflow run](${evidence.runUrl})
`;
}

function readEvidence(options: {
  release: string;
  releaseUrl: string;
  runUrl: string;
  version: string;
}): CandidateEvidence {
  const version = normalizeVersion(options.version);
  const manifest = object(
    JSON.parse(readFileSync(join(options.release, `rootform_${version}_manifest.json`), "utf8")),
    "release manifest",
  );
  const product = object(manifest.product, "release product");
  if (product.version !== version || product.tag !== `v${version}`) {
    throw new Error("release product identity drifted");
  }
  const distribution = object(manifest.distribution, "release distribution");
  const handoff = object(manifest.handoff, "release handoff");
  const compatibility = object(manifest.compatibility, "release compatibility");
  const dialects = object(compatibility.dialects, "release Dialects compatibility");
  const license = object(manifest.license, "release license");
  const binary = object(license.binary, "release binary license");
  const notices = object(license.third_party_notices, "release third-party notices");
  if (
    distribution.repository !== "rootform-dev/rootform" ||
    dialects.repository !== "rootform-dev/dialects" ||
    dialects.scope !== "complete-official-matrix" ||
    binary.status !== "licensed" ||
    binary.public_release_allowed !== true
  ) {
    throw new Error("release qualification metadata drifted");
  }
  if (!Array.isArray(manifest.artifacts)) throw new Error("release artifacts are invalid");
  const artifacts = manifest.artifacts.map((value, index): ArtifactEvidence => {
    const artifact = object(value, `release artifact ${index}`);
    if (artifact.proof !== "raw-byte-identity") {
      throw new Error(`release artifact proof drifted: ${String(artifact.asset ?? "")}`);
    }
    return {
      architecture: String(artifact.architecture ?? ""),
      asset: String(artifact.asset ?? ""),
      bytes: Number(artifact.bytes),
      operatingSystem: String(artifact.operating_system ?? ""),
      rawSha256: String(artifact.raw_executable_sha256 ?? ""),
      sha256: String(artifact.sha256 ?? ""),
    };
  });
  return validateEvidence({
    artifacts,
    checksums: readFileSync(join(options.release, "SHA256SUMS"), "utf8"),
    componentCount: Number(notices.component_count),
    dialectCommit: String(dialects.commit ?? ""),
    distributionCommit: String(distribution.commit ?? ""),
    handoffSha256: String(handoff.bundle_sha256 ?? ""),
    licenseSpdx: String(binary.spdx ?? ""),
    releaseUrl: options.releaseUrl,
    runUrl: options.runUrl,
    version,
  });
}

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function argumentsFrom(
  values: string[],
  cwd = process.cwd(),
): {
  output: string;
  release: string;
  releaseUrl: string;
  runUrl: string;
  version: string;
} {
  const options = new Map<string, string>();
  for (let index = 0; index < values.length; index++) {
    const argument = values[index] ?? "";
    const name = ["output", "release", "release-url", "run-url", "version"].find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name || options.has(name)) throw new Error(`invalid report argument: ${argument}`);
    const value = argument.startsWith(`--${name}=`)
      ? argument.slice(name.length + 3)
      : values[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    options.set(name, value);
  }
  for (const name of ["output", "release", "release-url", "run-url", "version"]) {
    if (!options.has(name)) throw new Error(`--${name} is required`);
  }
  return {
    output: absolute(options.get("output") as string, cwd),
    release: absolute(options.get("release") as string, cwd),
    releaseUrl: options.get("release-url") as string,
    runUrl: options.get("run-url") as string,
    version: normalizeVersion(options.get("version") as string),
  };
}

function main(): void {
  const options = argumentsFrom(process.argv.slice(2));
  if (existsSync(options.output)) throw new Error("candidate report output already exists");
  const body = renderCandidateEvidence(readEvidence(options));
  if (/rootform-dev\/engine|\/(?:Users|home)\//u.test(body)) {
    throw new Error("candidate report crossed public information boundary");
  }
  mkdirSync(dirname(options.output), { recursive: true });
  writeFileSync(options.output, body, { flag: "wx", mode: 0o644 });
  console.log(`Rendered distribution candidate evidence in ${options.output}.`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
