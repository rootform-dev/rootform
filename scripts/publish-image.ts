#!/usr/bin/env bun

import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { IMAGE_REFERENCE, imageBuildEnvironment, imagePublishArguments } from "./build-image.ts";
import { normalizeVersion } from "./release/contract.ts";
import { sha256 } from "./release/digest.ts";

const OCI_INDEX_TYPE = "application/vnd.oci.image.index.v1+json";
const OCI_MANIFEST_TYPE = "application/vnd.oci.image.manifest.v1+json";
const ATTESTATION_TYPE = "attestation-manifest";
const REFERENCE_DIGEST = "vnd.docker.reference.digest";
const REFERENCE_TYPE = "vnd.docker.reference.type";
const PREDICATE_TYPE = "in-toto.io/predicate-type";
const SPDX_PREDICATE = "https://spdx.dev/Document";

type JsonObject = Record<string, unknown>;

type PublishOptions = {
  context: string;
  evidence: string;
  imageManifest: string;
  metadata: string;
  revision: string;
  version: string;
};

type Descriptor = {
  annotations?: Record<string, string>;
  digest: string;
  mediaType: string;
  platform?: { architecture: string; os: string };
  size: number;
};

export type PublishedImageEvidence = {
  attestations: string[];
  digest: string;
  format_version: "1";
  license: "Elastic-2.0";
  platforms: Array<{ architecture: string; digest: string; os: "linux" }>;
  reference: string;
};

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

export function parseImagePublishArguments(
  arguments_: string[],
  cwd = process.cwd(),
): PublishOptions {
  const names = ["context", "evidence", "image-manifest", "metadata", "revision", "version"];
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    const name = names.find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown image publication argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate image publication argument: --${name}`);
    const value = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  for (const name of names) {
    if (!values.get(name)) throw new Error(`--${name} is required`);
  }
  const revision = values.get("revision") as string;
  if (!/^[0-9a-f]{40}$/u.test(revision)) throw new Error("--revision must be one exact commit");
  return {
    context: absolute(values.get("context") as string, cwd),
    evidence: absolute(values.get("evidence") as string, cwd),
    imageManifest: absolute(values.get("image-manifest") as string, cwd),
    metadata: absolute(values.get("metadata") as string, cwd),
    revision,
    version: normalizeVersion(values.get("version") as string),
  };
}

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function parseJson(body: Uint8Array | string, label: string): JsonObject {
  try {
    return object(JSON.parse(Buffer.from(body).toString("utf8")), label);
  } catch {
    throw new Error(`${label} is invalid JSON`);
  }
}

function descriptor(value: unknown, label: string): Descriptor {
  const item = object(value, label);
  if (
    typeof item.digest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(item.digest) ||
    typeof item.mediaType !== "string" ||
    !Number.isSafeInteger(item.size) ||
    Number(item.size) < 1
  ) {
    throw new Error(`${label} is invalid`);
  }
  let annotations: Record<string, string> | undefined;
  if (item.annotations !== undefined) {
    const raw = object(item.annotations, `${label} annotations`);
    annotations = {};
    for (const [name, value] of Object.entries(raw)) {
      if (typeof value !== "string") throw new Error(`${label} annotations are invalid`);
      annotations[name] = value;
    }
  }
  let platform: { architecture: string; os: string } | undefined;
  if (item.platform !== undefined) {
    const raw = object(item.platform, `${label} platform`);
    if (typeof raw.architecture !== "string" || typeof raw.os !== "string") {
      throw new Error(`${label} platform is invalid`);
    }
    platform = { architecture: raw.architecture, os: raw.os };
  }
  return {
    annotations,
    digest: item.digest,
    mediaType: item.mediaType,
    platform,
    size: Number(item.size),
  };
}

function digestSet(values: string[], label: string): Set<string> {
  const result = new Set(values);
  if (
    result.size !== values.length ||
    values.some((value) => !/^sha256:[0-9a-f]{64}$/u.test(value))
  ) {
    throw new Error(`${label} digest inventory is invalid`);
  }
  return result;
}

export function verifyPublishedImage(options: {
  attestationManifests: Map<string, Uint8Array>;
  index: Uint8Array;
  localPlatforms: Array<{ architecture: string; digest: string; os: string }>;
  version: string;
}): Omit<PublishedImageEvidence, "digest"> {
  const index = parseJson(options.index, "published image index");
  if (
    index.schemaVersion !== 2 ||
    index.mediaType !== OCI_INDEX_TYPE ||
    !Array.isArray(index.manifests) ||
    index.manifests.length !== 4
  ) {
    throw new Error("published image index shape drifted");
  }
  const manifests = index.manifests.map((value, position) =>
    descriptor(value, `published image descriptor ${position + 1}`),
  );
  const platforms = manifests
    .filter(({ platform }) => platform?.os === "linux" && platform.architecture !== "unknown")
    .map(({ digest, platform }) => ({
      architecture: platform?.architecture ?? "",
      digest,
      os: "linux" as const,
    }))
    .sort((left, right) => left.architecture.localeCompare(right.architecture, "en"));
  if (
    JSON.stringify(platforms.map(({ architecture }) => architecture)) !==
    JSON.stringify(["amd64", "arm64"])
  ) {
    throw new Error("published image platform set drifted");
  }
  const local = [...options.localPlatforms]
    .map(({ architecture, digest, os }) => ({ architecture, digest, os }))
    .sort((left, right) => left.architecture.localeCompare(right.architecture, "en"));
  if (JSON.stringify(platforms) !== JSON.stringify(local)) {
    throw new Error("published platform manifests differ from offline audit");
  }
  const platformDigests = digestSet(
    platforms.map(({ digest }) => digest),
    "published platform",
  );
  const attestations = manifests.filter(
    ({ annotations, platform }) =>
      platform?.architecture === "unknown" &&
      platform.os === "unknown" &&
      annotations?.[REFERENCE_TYPE] === ATTESTATION_TYPE,
  );
  if (
    attestations.length !== 2 ||
    attestations.some(
      ({ annotations }) => !platformDigests.has(annotations?.[REFERENCE_DIGEST] ?? ""),
    )
  ) {
    throw new Error("published image attestation set drifted");
  }
  const predicates = new Set<string>();
  for (const attestation of attestations) {
    const body = options.attestationManifests.get(attestation.digest);
    if (!body) throw new Error("published attestation manifest is unavailable");
    const manifest = parseJson(body, "published attestation manifest");
    if (
      manifest.schemaVersion !== 2 ||
      manifest.mediaType !== OCI_MANIFEST_TYPE ||
      !Array.isArray(manifest.layers) ||
      manifest.layers.length < 2
    ) {
      throw new Error("published attestation manifest shape drifted");
    }
    for (const [position, value] of manifest.layers.entries()) {
      const layer = descriptor(value, `published attestation layer ${position + 1}`);
      const predicate = layer.annotations?.[PREDICATE_TYPE];
      if (predicate) predicates.add(predicate);
    }
  }
  if (
    !predicates.has(SPDX_PREDICATE) ||
    ![...predicates].some((value) => value.startsWith("https://slsa.dev/provenance/"))
  ) {
    throw new Error("published image lacks SBOM or provenance attestation");
  }
  return {
    attestations: [...predicates].sort((left, right) => left.localeCompare(right, "en")),
    format_version: "1",
    license: "Elastic-2.0",
    platforms,
    reference: `${IMAGE_REFERENCE}:${normalizeVersion(options.version)}`,
  };
}

function requireRegularFile(path: string, label: string): Buffer {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink() || status.size < 1) {
    throw new Error(`${label} must be a regular file`);
  }
  return readFileSync(path);
}

function requireDirectory(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular directory`);
  }
}

function run(command: string[], environment: Record<string, string> = {}): string {
  const result = Bun.spawnSync({
    cmd: command,
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command[0] ?? "command"} exited ${result.exitCode}`);
  }
  return result.stdout.toString();
}

export function publishImage(options: PublishOptions): PublishedImageEvidence {
  requireDirectory(options.context, "image build context");
  const localManifest = parseJson(
    requireRegularFile(options.imageManifest, "offline image manifest"),
    "offline image manifest",
  );
  if (existsSync(options.metadata)) throw new Error("image build metadata already exists");
  if (existsSync(options.evidence)) throw new Error("image publication evidence already exists");
  mkdirSync(dirname(options.metadata), { recursive: true });
  mkdirSync(dirname(options.evidence), { recursive: true });
  run(
    imagePublishArguments({
      context: options.context,
      metadata: options.metadata,
      revision: options.revision,
      version: options.version,
    }),
    imageBuildEnvironment(),
  );
  const metadata = parseJson(
    requireRegularFile(options.metadata, "image build metadata"),
    "image build metadata",
  );
  const digest = metadata["containerimage.digest"];
  if (typeof digest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(digest)) {
    throw new Error("image build metadata has no published digest");
  }
  const reference = `${IMAGE_REFERENCE}:${options.version}@${digest}`;
  const index = Buffer.from(run(["docker", "buildx", "imagetools", "inspect", reference, "--raw"]));
  if (`sha256:${sha256(index)}` !== digest) {
    throw new Error("published image index digest differs from build metadata");
  }
  const decodedIndex = parseJson(index, "published image index");
  if (!Array.isArray(decodedIndex.manifests))
    throw new Error("published image index is incomplete");
  const attestationManifests = new Map<string, Uint8Array>();
  for (const [position, value] of decodedIndex.manifests.entries()) {
    const item = descriptor(value, `published image descriptor ${position + 1}`);
    if (item.annotations?.[REFERENCE_TYPE] === ATTESTATION_TYPE) {
      attestationManifests.set(
        item.digest,
        Buffer.from(
          run([
            "docker",
            "buildx",
            "imagetools",
            "inspect",
            `${IMAGE_REFERENCE}@${item.digest}`,
            "--raw",
          ]),
        ),
      );
    }
  }
  const image = object(localManifest.image, "offline image identity");
  if (!Array.isArray(image.manifests)) throw new Error("offline image platform set is missing");
  const localPlatforms = image.manifests.map((value, position) => {
    const item = object(value, `offline image platform ${position + 1}`);
    if (
      typeof item.architecture !== "string" ||
      typeof item.digest !== "string" ||
      typeof item.os !== "string"
    ) {
      throw new Error("offline image platform is invalid");
    }
    return { architecture: item.architecture, digest: item.digest, os: item.os };
  });
  const verified = verifyPublishedImage({
    attestationManifests,
    index,
    localPlatforms,
    version: options.version,
  });
  const evidence: PublishedImageEvidence = { digest, ...verified };
  writeFileSync(options.evidence, `${JSON.stringify(evidence, null, 2)}\n`, {
    flag: "wx",
    mode: 0o644,
  });
  return evidence;
}

if (import.meta.main) {
  try {
    const options = parseImagePublishArguments(process.argv.slice(2));
    const evidence = publishImage(options);
    console.log(`Published ${evidence.reference}@${evidence.digest}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
