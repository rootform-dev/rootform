#!/usr/bin/env bun

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { readTarGz } from "./release/archive.ts";
import {
  normalizeVersion,
  RELEASE_TARGETS,
  type ReleaseTarget,
  releaseAssetName,
} from "./release/contract.ts";
import { checksumFile, parseChecksumFile, sha256 } from "./release/digest.ts";
import { BINARY_LICENSE_FILE, BINARY_LICENSE_SPDX } from "./release/license.ts";
import { type ImageArchive, readImageArchive } from "./release/oci.ts";

const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const IMAGE_REFERENCE = "ghcr.io/rootform-dev/rootform";
const IMAGE_WORKDIR = "/workspace";
const IMAGE_HOME = "/var/cache/rootform";
const IMAGE_BINARY = "/usr/local/bin/rootform";
const IMAGE_SHARE = "/usr/local/share/rootform";

/**
 * Rootform images are reproducible: the same release payload must always yield
 * the same layers. BuildKit only rewrites file timestamps inside layers when
 * SOURCE_DATE_EPOCH is set *and* the exporter is asked for it, so both are
 * pinned here instead of inheriting a wall clock.
 */
export const IMAGE_SOURCE_DATE_EPOCH = "0";
export const IMAGE_CREATED = "1970-01-01T00:00:00Z";

export const IMAGE_PLATFORMS = ["amd64", "arm64"] as const;

export type ImageArchitecture = (typeof IMAGE_PLATFORMS)[number];

export type ImageOptions = {
  output: string;
  release: string;
  revision: string;
  version: string;
};

export type StagedBinary = {
  architecture: ImageArchitecture;
  sha256: string;
  size: number;
};

export type StagedContext = {
  binaries: StagedBinary[];
  shared: Array<{ name: string; sha256: string }>;
};

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

export function parseImageArguments(arguments_: string[], cwd = process.cwd()): ImageOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    const name = ["version", "release", "revision", "output"].find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown image build argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate image build argument: --${name}`);
    const inline = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++index];
    if (!inline || inline.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, inline);
  }
  for (const required of ["version", "release", "revision", "output"]) {
    if (!values.get(required)) throw new Error(`--${required} is required`);
  }
  const revision = values.get("revision") as string;
  if (!/^[0-9a-f]{40}$/u.test(revision)) throw new Error("--revision must be one exact commit");
  return {
    output: absolute(values.get("output") as string, cwd),
    release: absolute(values.get("release") as string, cwd),
    revision,
    version: normalizeVersion(values.get("version") as string),
  };
}

function requireRegularFile(path: string, label: string, maximum = 16 * 1024 * 1024): Buffer {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`);
  }
  if (status.size < 1 || status.size > maximum) throw new Error(`${label} has invalid size`);
  return readFileSync(path);
}

function linuxTarget(architecture: ImageArchitecture): ReleaseTarget {
  const target = RELEASE_TARGETS.find(
    (candidate) => candidate.operatingSystem === "linux" && candidate.architecture === architecture,
  );
  if (!target) throw new Error(`release contract has no linux target: ${architecture}`);
  return target;
}

/**
 * Reads one published Linux archive and returns the executable bytes only after
 * the release checksum file and the archive's own inner checksums both agree.
 * The image therefore never carries a binary that the archives did not ship.
 */
export function releaseExecutable(options: {
  architecture: ImageArchitecture;
  release: string;
  version: string;
}): Buffer {
  const version = normalizeVersion(options.version);
  const target = linuxTarget(options.architecture);
  const asset = releaseAssetName(version, target);
  const outer = parseChecksumFile(
    requireRegularFile(join(options.release, "SHA256SUMS"), "release checksums", 65536).toString(
      "utf8",
    ),
  );
  const archive = requireRegularFile(
    join(options.release, asset),
    `release archive: ${asset}`,
    MAX_ARCHIVE_BYTES,
  );
  if (outer.get(asset) !== sha256(archive)) {
    throw new Error(`release archive digest is not published: ${asset}`);
  }
  const entries = readTarGz(archive);
  const inner = Buffer.from(entries.get("SHA256SUMS")?.body ?? []).toString("utf8");
  const checksummed = [...entries.entries()]
    .filter(([name]) => name !== "SHA256SUMS")
    .map(([name, entry]) => ({ body: entry.body, name }));
  if (inner !== checksumFile(checksummed)) {
    throw new Error(`release archive checksums drifted: ${asset}`);
  }
  const executable = entries.get(target.executable);
  if (executable?.mode !== 0o755) {
    throw new Error(`release archive has no executable: ${asset}`);
  }
  return Buffer.from(executable.body);
}

function sharedAssets(options: {
  release: string;
  version: string;
}): Array<{ body: Buffer; name: string }> {
  const version = normalizeVersion(options.version);
  return [BINARY_LICENSE_FILE, "THIRD_PARTY_NOTICES.txt", `rootform_${version}_sbom.spdx.json`].map(
    (name) => ({
      body: requireRegularFile(join(options.release, name), `release asset: ${name}`),
      name,
    }),
  );
}

function prepareEmptyDirectory(path: string): void {
  if (existsSync(path)) {
    const status = lstatSync(path);
    if (!status.isDirectory() || status.isSymbolicLink()) {
      throw new Error("image context must be a regular directory");
    }
    if (readdirSync(path).length !== 0) throw new Error("image context must be empty");
    return;
  }
  mkdirSync(path, { recursive: true });
}

/**
 * Materializes the container build context. The context contains only verified
 * release payload, so the image build itself needs no compiler, no producer
 * source, and no network access.
 */
export function stageImageContext(options: {
  context: string;
  dockerfile: Buffer;
  release: string;
  version: string;
}): StagedContext {
  const version = normalizeVersion(options.version);
  prepareEmptyDirectory(options.context);
  writeFileSync(join(options.context, "Dockerfile"), options.dockerfile, { flag: "wx" });
  const binaries = IMAGE_PLATFORMS.map((architecture) => {
    const body = releaseExecutable({ architecture, release: options.release, version });
    const directory = join(options.context, "binaries", architecture);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "rootform"), body, { flag: "wx", mode: 0o755 });
    return { architecture, sha256: sha256(body), size: body.byteLength };
  });
  const share = join(options.context, "share");
  mkdirSync(share, { recursive: true });
  const shared = sharedAssets({ release: options.release, version }).map(({ body, name }) => {
    writeFileSync(join(share, name), body, { flag: "wx", mode: 0o644 });
    return { name, sha256: sha256(body) };
  });
  return { binaries, shared };
}

export function imageBuildArguments(options: {
  context: string;
  output: string;
  revision: string;
  version: string;
}): string[] {
  const version = normalizeVersion(options.version);
  return [
    "docker",
    "buildx",
    "build",
    "--platform",
    IMAGE_PLATFORMS.map((architecture) => `linux/${architecture}`).join(","),
    "--build-arg",
    `ROOTFORM_CREATED=${IMAGE_CREATED}`,
    "--build-arg",
    `ROOTFORM_REVISION=${options.revision}`,
    "--build-arg",
    `ROOTFORM_VERSION=${version}`,
    "--label",
    `org.opencontainers.image.version=${version}`,
    // Provenance and SBOM attestations are generated by the publication chain
    // when the image is pushed to a registry. A locally exported OCI layout
    // carries neither, so the audit below can compare layers byte for byte.
    "--provenance",
    "false",
    "--sbom",
    "false",
    "--output",
    `type=oci,dest=${options.output},name=${IMAGE_REFERENCE}:${version},rewrite-timestamp=true`,
    options.context,
  ];
}

export function imageBuildEnvironment(): Record<string, string> {
  return { SOURCE_DATE_EPOCH: IMAGE_SOURCE_DATE_EPOCH };
}

function expectedOverlay(options: {
  binarySha256: string;
  shared: Array<{ name: string; sha256: string }>;
}): Map<string, string> {
  const files = new Map<string, string>([[IMAGE_BINARY, options.binarySha256]]);
  for (const asset of options.shared) files.set(`${IMAGE_SHARE}/${asset.name}`, asset.sha256);
  return files;
}

const FORBIDDEN_PAYLOAD =
  /(?:^\/[^/]*(?:terraform|tofu)|\.rootform\/|dialect\.rf$|\.tfstate$|(?:^|\/)id_rsa$|\.pem$)/u;

/**
 * Audits a built image archive against the release evidence. This runs offline
 * on the OCI layout produced by the build and never contacts a registry.
 */
export function verifyImageArchive(options: {
  archive: Uint8Array;
  binaries: StagedBinary[];
  revision: string;
  shared: Array<{ name: string; sha256: string }>;
  version: string;
}): ImageArchive {
  const version = normalizeVersion(options.version);
  const image = readImageArchive(options.archive);
  const architectures = image.variants.map(({ platform }) => platform.architecture);
  if (JSON.stringify(architectures) !== JSON.stringify([...IMAGE_PLATFORMS])) {
    throw new Error(`image platform set drifted: ${architectures.join(", ")}`);
  }
  for (const variant of image.variants) {
    const expected = options.binaries.find(
      ({ architecture }) => architecture === variant.platform.architecture,
    );
    if (!expected) throw new Error(`image carries an unexpected platform: ${variant.digest}`);
    if (variant.configuration.entrypoint.length !== 0) {
      throw new Error("image must not define an entrypoint");
    }
    if (variant.configuration.workingDirectory !== IMAGE_WORKDIR) {
      throw new Error("image working directory drifted");
    }
    if (variant.configuration.user !== "" && variant.configuration.user !== "root") {
      throw new Error("image default user drifted");
    }
    if (!variant.configuration.environment.includes(`ROOTFORM_HOME=${IMAGE_HOME}`)) {
      throw new Error("image ROOTFORM_HOME drifted");
    }
    const labels = variant.configuration.labels;
    for (const [label, value] of [
      ["org.opencontainers.image.licenses", BINARY_LICENSE_SPDX],
      ["org.opencontainers.image.revision", options.revision],
      ["org.opencontainers.image.source", `https://github.com/${"rootform-dev/rootform"}`],
      ["org.opencontainers.image.title", "Rootform"],
      ["org.opencontainers.image.version", version],
    ] as const) {
      if (labels[label] !== value) throw new Error(`image label drifted: ${label}`);
    }
    const overlay = expectedOverlay({
      binarySha256: expected.sha256,
      shared: options.shared,
    });
    const observed = new Map(
      variant.overlayFiles
        .filter(({ size }) => size > 0)
        .map(({ path, sha256: digest }) => [path, digest]),
    );
    for (const [path, digest] of overlay) {
      if (observed.get(path) !== digest) throw new Error(`image payload drifted: ${path}`);
    }
    for (const path of observed.keys()) {
      if (!overlay.has(path)) throw new Error(`image carries an unexpected file: ${path}`);
    }
    for (const file of variant.files) {
      if (FORBIDDEN_PAYLOAD.test(file.path)) {
        throw new Error(`image carries forbidden payload: ${file.path}`);
      }
    }
  }
  return image;
}

export function imageManifest(options: {
  binaries: StagedBinary[];
  image: ImageArchive;
  revision: string;
  shared: Array<{ name: string; sha256: string }>;
  version: string;
}): string {
  const version = normalizeVersion(options.version);
  return `${JSON.stringify(
    {
      binary: {
        license: { file: BINARY_LICENSE_FILE, spdx: BINARY_LICENSE_SPDX },
        path: IMAGE_BINARY,
        platforms: [...options.binaries]
          .sort((left, right) => left.architecture.localeCompare(right.architecture, "en"))
          .map(({ architecture, sha256: digest, size }) => ({
            architecture,
            bytes: size,
            proof: "release-archive-byte-identity",
            sha256: digest,
          })),
      },
      distribution: { commit: options.revision, repository: "rootform-dev/rootform" },
      format_version: "1",
      image: {
        digest: options.image.digest,
        manifests: options.image.variants.map(({ digest, platform }) => ({
          architecture: platform.architecture,
          digest,
          os: platform.os,
        })),
        reference: `${IMAGE_REFERENCE}:${version}`,
      },
      product: { name: "rootform", version },
      share: {
        directory: IMAGE_SHARE,
        files: [...options.shared].sort((left, right) => left.name.localeCompare(right.name, "en")),
      },
    },
    null,
    2,
  )}\n`;
}

function run(command: string[], environment: Record<string, string>): void {
  const result = Bun.spawnSync({
    cmd: command,
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`${command[0]} exited ${result.exitCode}`);
  }
}

export function buildImage(options: ImageOptions & { root: string }): void {
  const version = normalizeVersion(options.version);
  const context = join(options.output, "context");
  const archivePath = join(options.output, `rootform_${version}_image.oci.tar`);
  prepareEmptyDirectory(options.output);
  const dockerfile = requireRegularFile(
    join(options.root, "oci", "Dockerfile"),
    "image definition",
    65536,
  );
  const staged = stageImageContext({ context, dockerfile, release: options.release, version });
  run(
    imageBuildArguments({
      context,
      output: archivePath,
      revision: options.revision,
      version,
    }),
    imageBuildEnvironment(),
  );
  const image = verifyImageArchive({
    archive: requireRegularFile(archivePath, "image archive", MAX_ARCHIVE_BYTES),
    binaries: staged.binaries,
    revision: options.revision,
    shared: staged.shared,
    version,
  });
  writeFileSync(
    join(options.output, `rootform_${version}_image.json`),
    imageManifest({
      binaries: staged.binaries,
      image,
      revision: options.revision,
      shared: staged.shared,
      version,
    }),
    { flag: "wx" },
  );
}

if (import.meta.main) {
  try {
    const options = parseImageArguments(process.argv.slice(2));
    buildImage({ ...options, root: join(import.meta.dir, "..") });
    console.log("Rootform image build verified.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
