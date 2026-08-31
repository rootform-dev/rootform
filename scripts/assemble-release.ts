#!/usr/bin/env bun

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { createTarGz, createZip, readTarGz, readZip } from "./release/archive.ts";
import {
  normalizeVersion,
  RELEASE_TARGETS,
  type ReleaseTarget,
  releaseAssetName,
} from "./release/contract.ts";
import { checksumFile, parseChecksumFile, sha256 } from "./release/digest.ts";
import {
  type NativeVersionVerifier,
  type VerifiedHandoff,
  verifyHandoffDirectory,
  verifyNativeVersion,
} from "./release/handoff.ts";
import {
  createReleaseManifest,
  type FinalArtifactRecord,
  readDialectPin,
  releaseArchiveEntries,
} from "./release/metadata.ts";

type AssembleOptions = {
  check: boolean;
  githubAssets: string;
  handoff: string;
  output: string;
  version: string;
};

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

export function parseAssembleArguments(arguments_: string[], cwd = process.cwd()): AssembleOptions {
  const values = new Map<string, string>();
  let check = false;
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    if (argument === "--check") {
      if (check) throw new Error("duplicate assembly argument: --check");
      check = true;
      continue;
    }
    const name = ["version", "handoff", "github-assets", "output"].find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown assembly argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate assembly argument: --${name}`);
    const inline = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++index];
    if (!inline || inline.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, inline);
  }
  for (const required of ["version", "handoff", "github-assets", "output"]) {
    if (!values.get(required)) throw new Error(`--${required} is required`);
  }
  return {
    check,
    githubAssets: absolute(values.get("github-assets") as string, cwd),
    handoff: absolute(values.get("handoff") as string, cwd),
    output: absolute(values.get("output") as string, cwd),
    version: normalizeVersion(values.get("version") as string),
  };
}

function requireRegularFile(path: string, label: string, maximum = 16 * 1024 * 1024): Buffer {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink())
    throw new Error(`${label} must be a regular file`);
  const body = readFileSync(path);
  if (body.byteLength === 0 || body.byteLength > maximum) {
    throw new Error(`${label} has invalid size`);
  }
  return body;
}

function prepareEmptyDirectory(path: string): void {
  if (existsSync(path)) {
    const status = lstatSync(path);
    if (!status.isDirectory() || status.isSymbolicLink()) {
      throw new Error("release output must be a regular directory");
    }
    if (readdirSync(path).length !== 0) throw new Error("release output must be empty");
  } else {
    mkdirSync(path, { recursive: true });
  }
}

function directoryFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .map((entry) => {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error(`release output contains non-file entry: ${entry.name}`);
      }
      return entry.name;
    })
    .sort((left, right) => left.localeCompare(right, "en"));
}

function finalNames(version: string): string[] {
  return [
    ...RELEASE_TARGETS.map((target) => releaseAssetName(version, target)),
    "ROOTFORM-BINARY-LICENSE.txt",
    "SHA256SUMS",
    "THIRD_PARTY_NOTICES.txt",
    `rootform_${version}_manifest.json`,
    `rootform_${version}_sbom.spdx.json`,
  ].sort((left, right) => left.localeCompare(right, "en"));
}

function distributionInputs(root: string): { license: Buffer; notices: Buffer; schema: Buffer } {
  const license = requireRegularFile(
    join(root, "LICENSES", "ROOTFORM-BINARY-LICENSE-REVIEW.md"),
    "binary license input",
  );
  if (!license.toString("utf8").toLowerCase().includes("not approved for public distribution")) {
    throw new Error("private candidate requires explicit binary-license review marker");
  }
  return {
    license,
    notices: requireRegularFile(join(root, "THIRD_PARTY_NOTICES.md"), "third-party notices"),
    schema: requireRegularFile(
      join(root, "schemas", "architecture-ir.schema.json"),
      "Architecture IR schema",
    ),
  };
}

function archiveContents(
  archive: Buffer,
  target: ReleaseTarget,
): Map<string, { body: Uint8Array; mode: 0o644 | 0o755; name: string }> {
  return target.archiveFormat === "zip" ? readZip(archive) : readTarGz(archive);
}

function artifactRecord(
  archive: Buffer,
  binarySha256: string,
  target: ReleaseTarget,
  version: string,
): FinalArtifactRecord {
  return {
    archive_format: target.archiveFormat,
    architecture: target.architecture,
    asset: releaseAssetName(version, target),
    bytes: archive.byteLength,
    executable: target.executable,
    operating_system: target.operatingSystem,
    proof: "raw-byte-identity",
    raw_executable_sha256: binarySha256,
    sha256: sha256(archive),
  };
}

function expectedManifest(options: {
  artifacts: FinalArtifactRecord[];
  dialectCommit: string;
  distributionCommit: string;
  handoff: VerifiedHandoff;
  license: Buffer;
  notices: Buffer;
  schema: Buffer;
}): string {
  return createReleaseManifest({
    artifacts: options.artifacts,
    binaryLicense: options.license,
    dialectCommit: options.dialectCommit,
    distributionCommit: options.distributionCommit,
    handoffBundleSha256: options.handoff.bundleSha256,
    notices: options.notices,
    producerManifestSha256: options.handoff.producerManifestSha256,
    sbom: options.handoff.sbom,
    schema: options.schema,
    version: options.handoff.version,
  });
}

function verifyArchive(
  archive: Buffer,
  binary: Buffer,
  target: ReleaseTarget,
  version: string,
  license: Buffer,
  notices: Buffer,
  sbom: Buffer,
): void {
  const entries = archiveContents(archive, target);
  const sbomName = `rootform_${version}_sbom.spdx.json`;
  const expectedNames = [
    target.executable,
    "ROOTFORM-BINARY-LICENSE.txt",
    "SHA256SUMS",
    "THIRD_PARTY_NOTICES.txt",
    sbomName,
  ].sort((left, right) => left.localeCompare(right, "en"));
  const actualNames = [...entries.keys()].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`final archive inventory drifted: ${releaseAssetName(version, target)}`);
  }
  if (
    !Buffer.from(entries.get(target.executable)?.body ?? []).equals(binary) ||
    entries.get(target.executable)?.mode !== 0o755
  ) {
    throw new Error(`final executable bytes drifted: ${target.handoffFile}`);
  }
  for (const [name, expected] of [
    ["ROOTFORM-BINARY-LICENSE.txt", license],
    ["THIRD_PARTY_NOTICES.txt", notices],
    [sbomName, sbom],
  ] as const) {
    const entry = entries.get(name);
    if (entry?.mode !== 0o644) {
      throw new Error(`final archive entry drifted: ${name}`);
    }
    if (!Buffer.from(entry.body).equals(expected)) {
      throw new Error(`final archive entry drifted: ${name}`);
    }
  }
  const local = Buffer.from(entries.get("SHA256SUMS")?.body ?? []).toString("utf8");
  const checksummed = [...entries.entries()]
    .filter(([name]) => name !== "SHA256SUMS")
    .map(([name, entry]) => ({ body: entry.body, name }));
  if (
    entries.get("SHA256SUMS")?.mode !== 0o644 ||
    parseChecksumFile(local).size !== checksummed.length ||
    local !== checksumFile(checksummed)
  ) {
    throw new Error(`final archive checksums drifted: ${releaseAssetName(version, target)}`);
  }
}

export function verifyFinalDirectory(options: {
  distributionCommit: string;
  githubAssets: string;
  handoffDirectory: string;
  nativeVerifier?: NativeVersionVerifier;
  output: string;
  root: string;
  version: string;
}): VerifiedHandoff {
  const version = normalizeVersion(options.version);
  const names = directoryFiles(options.output);
  if (JSON.stringify(names) !== JSON.stringify(finalNames(version))) {
    throw new Error(`final release inventory drifted: ${names.join(", ")}`);
  }
  const handoff = verifyHandoffDirectory(
    options.root,
    options.handoffDirectory,
    options.githubAssets,
    version,
    options.nativeVerifier ?? verifyNativeVersion,
  );
  const inputs = distributionInputs(options.root);
  if (!inputs.schema.equals(handoff.schema)) throw new Error("distribution schema drifted");
  const dialectCommit = readDialectPin(options.root).commit;
  const artifacts = handoff.binaries.map(({ body, sha256: binarySha256, target }) => {
    const name = releaseAssetName(version, target);
    const archive = requireRegularFile(join(options.output, name), name, 512 * 1024 * 1024);
    verifyArchive(archive, body, target, version, inputs.license, inputs.notices, handoff.sbom);
    const expectedEntries = releaseArchiveEntries({
      binary: body,
      license: inputs.license,
      notices: inputs.notices,
      sbom: handoff.sbom,
      target,
      version,
    });
    const expectedArchive =
      target.archiveFormat === "zip" ? createZip(expectedEntries) : createTarGz(expectedEntries);
    if (!archive.equals(expectedArchive))
      throw new Error(`final archive is not deterministic: ${name}`);
    return artifactRecord(archive, binarySha256, target, version);
  });
  const sbomName = `rootform_${version}_sbom.spdx.json`;
  const manifestName = `rootform_${version}_manifest.json`;
  for (const [name, expected] of [
    ["ROOTFORM-BINARY-LICENSE.txt", inputs.license],
    ["THIRD_PARTY_NOTICES.txt", inputs.notices],
    [sbomName, handoff.sbom],
  ] as const) {
    if (!requireRegularFile(join(options.output, name), name).equals(expected)) {
      throw new Error(`standalone final asset drifted: ${name}`);
    }
  }
  const manifest = expectedManifest({
    artifacts,
    dialectCommit,
    distributionCommit: options.distributionCommit,
    handoff,
    license: inputs.license,
    notices: inputs.notices,
    schema: inputs.schema,
  });
  if (
    requireRegularFile(join(options.output, manifestName), manifestName).toString("utf8") !==
    manifest
  ) {
    throw new Error("final release manifest drifted");
  }
  const checksummed = names
    .filter((name) => name !== "SHA256SUMS")
    .map((name) => ({ body: readFileSync(join(options.output, name)), name }));
  const outer = requireRegularFile(join(options.output, "SHA256SUMS"), "final checksums").toString(
    "utf8",
  );
  if (parseChecksumFile(outer).size !== checksummed.length || outer !== checksumFile(checksummed)) {
    throw new Error("final release checksums drifted");
  }
  return handoff;
}

export function assembleRelease(options: {
  distributionCommit: string;
  githubAssets: string;
  handoffDirectory: string;
  nativeVerifier?: NativeVersionVerifier;
  output: string;
  root: string;
  version: string;
}): void {
  const version = normalizeVersion(options.version);
  prepareEmptyDirectory(options.output);
  const handoff = verifyHandoffDirectory(
    options.root,
    options.handoffDirectory,
    options.githubAssets,
    version,
    options.nativeVerifier ?? verifyNativeVersion,
  );
  const inputs = distributionInputs(options.root);
  if (!inputs.schema.equals(handoff.schema)) throw new Error("distribution schema drifted");
  const artifacts: FinalArtifactRecord[] = [];
  for (const { body, sha256: binarySha256, target } of handoff.binaries) {
    const entries = releaseArchiveEntries({
      binary: body,
      license: inputs.license,
      notices: inputs.notices,
      sbom: handoff.sbom,
      target,
      version,
    });
    const archive = target.archiveFormat === "zip" ? createZip(entries) : createTarGz(entries);
    const name = releaseAssetName(version, target);
    writeFileSync(join(options.output, name), archive, { flag: "wx" });
    artifacts.push(artifactRecord(archive, binarySha256, target, version));
  }
  const sbomName = `rootform_${version}_sbom.spdx.json`;
  const manifestName = `rootform_${version}_manifest.json`;
  writeFileSync(join(options.output, "ROOTFORM-BINARY-LICENSE.txt"), inputs.license, {
    flag: "wx",
  });
  writeFileSync(join(options.output, "THIRD_PARTY_NOTICES.txt"), inputs.notices, {
    flag: "wx",
  });
  writeFileSync(join(options.output, sbomName), handoff.sbom, { flag: "wx" });
  writeFileSync(
    join(options.output, manifestName),
    expectedManifest({
      artifacts,
      dialectCommit: readDialectPin(options.root).commit,
      distributionCommit: options.distributionCommit,
      handoff,
      license: inputs.license,
      notices: inputs.notices,
      schema: inputs.schema,
    }),
    { flag: "wx" },
  );
  const checksummed = directoryFiles(options.output).map((name) => ({
    body: readFileSync(join(options.output, name)),
    name,
  }));
  writeFileSync(join(options.output, "SHA256SUMS"), checksumFile(checksummed), { flag: "wx" });
  verifyFinalDirectory({ ...options, version });
}

function runGit(arguments_: string[], root: string): string {
  const result = Bun.spawnSync({
    cmd: ["git", ...arguments_],
    cwd: root,
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || "git failed");
  return result.stdout.toString().trim();
}

function exactCleanCommit(root: string): string {
  const commit = runGit(["rev-parse", "HEAD"], root);
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error("distribution HEAD is not exact");
  if (runGit(["status", "--porcelain=v1", "--untracked-files=all"], root)) {
    throw new Error("release assembly requires a clean committed distribution tree");
  }
  return commit;
}

async function main(): Promise<void> {
  const options = parseAssembleArguments(process.argv.slice(2));
  const root = join(import.meta.dir, "..");
  const distributionCommit = exactCleanCommit(root);
  const common = {
    distributionCommit,
    githubAssets: options.githubAssets,
    handoffDirectory: options.handoff,
    output: options.output,
    root,
    version: options.version,
  };
  if (options.check) {
    verifyFinalDirectory(common);
    console.log(`Verified Rootform ${options.version} release in ${basename(options.output)}.`);
    return;
  }
  assembleRelease(common);
  console.log(`Assembled Rootform ${options.version} release in ${basename(options.output)}.`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
