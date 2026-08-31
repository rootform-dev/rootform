import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ArchiveEntry } from "./archive.ts";
import {
  normalizeVersion,
  RELEASE_TARGETS,
  type ReleaseTarget,
  releaseAssetName,
} from "./contract.ts";
import { checksumFile, sha256 } from "./digest.ts";

export type FinalArtifactRecord = {
  archive_format: "tar.gz" | "zip";
  architecture: "amd64" | "arm64";
  asset: string;
  bytes: number;
  executable: "rootform" | "rootform.exe";
  operating_system: "darwin" | "linux" | "windows";
  proof: "raw-byte-identity";
  raw_executable_sha256: string;
  sha256: string;
};

export type DialectPin = {
  commit: string;
  format_version: string;
  repository: string;
};

export function readDialectPin(root: string): DialectPin {
  const pin = JSON.parse(
    readFileSync(join(root, "dependencies", "dialects.json"), "utf8"),
  ) as DialectPin;
  if (
    pin.format_version !== "1" ||
    pin.repository !== "rootform-dev/dialects" ||
    !/^[0-9a-f]{40}$/u.test(pin.commit)
  ) {
    throw new Error("dependencies/dialects.json must pin one exact official commit");
  }
  return pin;
}

export function releaseArchiveEntries(options: {
  binary: Uint8Array;
  license: Uint8Array;
  notices: Uint8Array;
  sbom: Uint8Array;
  target: ReleaseTarget;
  version: string;
}): ArchiveEntry[] {
  const version = normalizeVersion(options.version);
  const sbomName = `rootform_${version}_sbom.spdx.json`;
  const payload: ArchiveEntry[] = [
    { body: options.binary, mode: 0o755, name: options.target.executable },
    { body: options.license, mode: 0o644, name: "ROOTFORM-BINARY-LICENSE.txt" },
    { body: options.notices, mode: 0o644, name: "THIRD_PARTY_NOTICES.txt" },
    { body: options.sbom, mode: 0o644, name: sbomName },
  ];
  return [
    ...payload,
    {
      body: Buffer.from(checksumFile(payload.map(({ body, name }) => ({ body, name })))),
      mode: 0o644,
      name: "SHA256SUMS",
    },
  ];
}

export function createReleaseManifest(options: {
  artifacts: FinalArtifactRecord[];
  binaryLicense: Uint8Array;
  dialectCommit: string;
  distributionCommit: string;
  handoffBundleSha256: string;
  notices: Uint8Array;
  producerManifestSha256: string;
  sbom: Uint8Array;
  schema: Uint8Array;
  version: string;
}): string {
  const version = normalizeVersion(options.version);
  for (const [label, value] of [
    ["Dialects commit", options.dialectCommit],
    ["distribution commit", options.distributionCommit],
  ] as const) {
    if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error(`${label} is invalid`);
  }
  for (const [label, value] of [
    ["handoff bundle", options.handoffBundleSha256],
    ["producer manifest", options.producerManifestSha256],
  ] as const) {
    if (!/^[0-9a-f]{64}$/u.test(value)) throw new Error(`${label} digest is invalid`);
  }
  const artifacts = [...options.artifacts].sort((left, right) =>
    left.asset.localeCompare(right.asset, "en"),
  );
  const expectedAssets = RELEASE_TARGETS.map((target) => releaseAssetName(version, target)).sort(
    (left, right) => left.localeCompare(right, "en"),
  );
  if (
    artifacts.length !== RELEASE_TARGETS.length ||
    JSON.stringify(artifacts.map(({ asset }) => asset)) !== JSON.stringify(expectedAssets)
  ) {
    throw new Error("final release target set is incomplete");
  }
  for (const artifact of artifacts) {
    const target = RELEASE_TARGETS.find(
      ({ architecture, operatingSystem }) =>
        architecture === artifact.architecture && operatingSystem === artifact.operating_system,
    );
    if (
      !target ||
      artifact.asset !== releaseAssetName(version, target) ||
      artifact.archive_format !== target.archiveFormat ||
      artifact.executable !== target.executable ||
      artifact.proof !== "raw-byte-identity" ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes < 1 ||
      !/^[0-9a-f]{64}$/u.test(artifact.sha256) ||
      !/^[0-9a-f]{64}$/u.test(artifact.raw_executable_sha256)
    ) {
      throw new Error(`final release artifact is invalid: ${artifact.asset}`);
    }
  }

  return `${JSON.stringify(
    {
      artifacts,
      attestations: {
        artifact: {
          status: "not-generated-for-private-candidate",
        },
        release: {
          provider: "github-immutable-release",
          verification: "required-after-publication",
        },
      },
      compatibility: {
        dialects: {
          commit: options.dialectCommit,
          repository: "rootform-dev/dialects",
          scope: "complete-official-matrix",
        },
      },
      distribution: {
        commit: options.distributionCommit,
        repository: "rootform-dev/rootform",
      },
      format_version: "1",
      handoff: {
        bundle_sha256: options.handoffBundleSha256,
        producer_manifest_sha256: options.producerManifestSha256,
      },
      license: {
        binary: {
          file: "ROOTFORM-BINARY-LICENSE.txt",
          public_release_allowed: false,
          sha256: sha256(options.binaryLicense),
          status: "private-review-only",
        },
        third_party_notices: {
          file: "THIRD_PARTY_NOTICES.txt",
          sha256: sha256(options.notices),
        },
      },
      product: {
        name: "rootform",
        tag: `v${version}`,
        version,
      },
      sbom: {
        file: `rootform_${version}_sbom.spdx.json`,
        format: "SPDX-2.3-json",
        sha256: sha256(options.sbom),
      },
      schema: {
        file: "schemas/architecture-ir.schema.json",
        sha256: sha256(options.schema),
      },
    },
    null,
    2,
  )}\n`;
}
