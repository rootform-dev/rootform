import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { parseImagePublishArguments, verifyPublishedImage } from "./publish-image.ts";

const digest = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const amd64 = digest("amd64");
const arm64 = digest("arm64");
const amd64Attestation = digest("amd64-attestation");
const arm64Attestation = digest("arm64-attestation");
const revision = "a".repeat(40);

function attestation(reference: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      layers: [
        {
          annotations: { "in-toto.io/predicate-type": "https://spdx.dev/Document" },
          digest: digest(`${reference}-sbom`),
          mediaType: "application/vnd.in-toto+json",
          size: 10,
        },
        {
          annotations: {
            "in-toto.io/predicate-type": "https://slsa.dev/provenance/v0.2",
          },
          digest: digest(`${reference}-provenance`),
          mediaType: "application/vnd.in-toto+json",
          size: 10,
        },
      ],
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      schemaVersion: 2,
    }),
  );
}

function index(): Buffer {
  return Buffer.from(
    JSON.stringify({
      manifests: [
        {
          digest: amd64,
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          platform: { architecture: "amd64", os: "linux" },
          size: 100,
        },
        {
          annotations: {
            "vnd.docker.reference.digest": amd64,
            "vnd.docker.reference.type": "attestation-manifest",
          },
          digest: amd64Attestation,
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          platform: { architecture: "unknown", os: "unknown" },
          size: 100,
        },
        {
          digest: arm64,
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          platform: { architecture: "arm64", os: "linux" },
          size: 100,
        },
        {
          annotations: {
            "vnd.docker.reference.digest": arm64,
            "vnd.docker.reference.type": "attestation-manifest",
          },
          digest: arm64Attestation,
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          platform: { architecture: "unknown", os: "unknown" },
          size: 100,
        },
      ],
      mediaType: "application/vnd.oci.image.index.v1+json",
      schemaVersion: 2,
    }),
  );
}

test("verifies exact platforms plus SPDX and provenance attestations", () => {
  expect(
    verifyPublishedImage({
      attestationManifests: new Map([
        [amd64Attestation, attestation("amd64")],
        [arm64Attestation, attestation("arm64")],
      ]),
      index: index(),
      localPlatforms: [
        { architecture: "amd64", digest: amd64, os: "linux" },
        { architecture: "arm64", digest: arm64, os: "linux" },
      ],
      version: "0.1.0",
    }),
  ).toEqual({
    attestations: ["https://slsa.dev/provenance/v0.2", "https://spdx.dev/Document"],
    format_version: "1",
    license: "Elastic-2.0",
    platforms: [
      { architecture: "amd64", digest: amd64, os: "linux" },
      { architecture: "arm64", digest: arm64, os: "linux" },
    ],
    reference: "ghcr.io/rootform-dev/rootform:0.1.0",
  });
});

test("rejects platform drift and missing provenance", () => {
  expect(() =>
    verifyPublishedImage({
      attestationManifests: new Map([
        [amd64Attestation, attestation("amd64")],
        [arm64Attestation, attestation("arm64")],
      ]),
      index: index(),
      localPlatforms: [{ architecture: "amd64", digest: amd64, os: "linux" }],
      version: "0.1.0",
    }),
  ).toThrow("published platform manifests differ");
  const sbomOnly = Buffer.from(
    JSON.stringify({
      layers: [
        {
          annotations: { "in-toto.io/predicate-type": "https://spdx.dev/Document" },
          digest: digest("sbom-only"),
          mediaType: "application/vnd.in-toto+json",
          size: 10,
        },
        {
          digest: digest("without-predicate"),
          mediaType: "application/vnd.in-toto+json",
          size: 10,
        },
      ],
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      schemaVersion: 2,
    }),
  );
  expect(() =>
    verifyPublishedImage({
      attestationManifests: new Map([
        [amd64Attestation, sbomOnly],
        [arm64Attestation, sbomOnly],
      ]),
      index: index(),
      localPlatforms: [
        { architecture: "amd64", digest: amd64, os: "linux" },
        { architecture: "arm64", digest: arm64, os: "linux" },
      ],
      version: "0.1.0",
    }),
  ).toThrow("lacks SBOM or provenance");
});

test("image publication CLI requires exact explicit inputs", () => {
  expect(
    parseImagePublishArguments(
      [
        "--context=context",
        "--evidence=evidence.json",
        "--image-manifest=image.json",
        "--metadata=metadata.json",
        `--revision=${revision}`,
        "--version=0.1.0",
      ],
      "/workspace",
    ),
  ).toEqual({
    context: "/workspace/context",
    evidence: "/workspace/evidence.json",
    imageManifest: "/workspace/image.json",
    metadata: "/workspace/metadata.json",
    revision,
    version: "0.1.0",
  });
  expect(() => parseImagePublishArguments(["--version=0.1.0"])).toThrow("--context is required");
});
