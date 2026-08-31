#!/usr/bin/env bun

import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { readTarGz, readZip } from "./release/archive.ts";
import {
  normalizeVersion,
  RELEASE_TARGETS,
  type ReleaseTarget,
  releaseAssetName,
} from "./release/contract.ts";
import { checksumFile, parseChecksumFile } from "./release/digest.ts";

const maximumArchiveBytes = 512 * 1024 * 1024;

type ExtractOptions = {
  output: string;
  release: string;
  target: string;
  version: string;
};

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

export function parseExtractArguments(arguments_: string[], cwd = process.cwd()): ExtractOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    const name = ["version", "release", "target", "output"].find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown release extraction argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate release extraction argument: --${name}`);
    const inline = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++index];
    if (!inline || inline.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, inline);
  }
  for (const required of ["version", "release", "target", "output"]) {
    if (!values.get(required)) throw new Error(`--${required} is required`);
  }
  return {
    output: absolute(values.get("output") as string, cwd),
    release: absolute(values.get("release") as string, cwd),
    target: values.get("target") as string,
    version: normalizeVersion(values.get("version") as string),
  };
}

function targetFor(name: string): ReleaseTarget {
  const target = RELEASE_TARGETS.find(
    ({ architecture, operatingSystem }) => `${operatingSystem}-${architecture}` === name,
  );
  if (!target) throw new Error(`unsupported release extraction target: ${name}`);
  return target;
}

function requireRegularFile(path: string, label: string): Buffer {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`);
  }
  if (status.size < 1 || status.size > maximumArchiveBytes) {
    throw new Error(`${label} has invalid size`);
  }
  return readFileSync(path);
}

export function extractReleaseBinary(options: ExtractOptions): void {
  const version = normalizeVersion(options.version);
  const target = targetFor(options.target);
  if (existsSync(options.output)) throw new Error("release binary output already exists");
  const asset = releaseAssetName(version, target);
  const archive = requireRegularFile(join(options.release, asset), `release archive: ${asset}`);
  const entries = target.archiveFormat === "zip" ? readZip(archive) : readTarGz(archive);
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
    throw new Error(`release archive inventory drifted: ${asset}`);
  }
  const checksummed = [...entries.entries()]
    .filter(([name]) => name !== "SHA256SUMS")
    .map(([name, entry]) => ({ body: entry.body, name }));
  const checksumEntry = entries.get("SHA256SUMS");
  const checksumBody = Buffer.from(checksumEntry?.body ?? []).toString("utf8");
  if (
    checksumEntry?.mode !== 0o644 ||
    parseChecksumFile(checksumBody).size !== checksummed.length ||
    checksumBody !== checksumFile(checksummed)
  ) {
    throw new Error(`release archive checksums drifted: ${asset}`);
  }
  const executable = entries.get(target.executable);
  if (executable?.mode !== 0o755 || executable.body.byteLength === 0) {
    throw new Error(`release executable drifted: ${asset}`);
  }
  mkdirSync(dirname(options.output), { recursive: true });
  writeFileSync(options.output, executable.body, { flag: "wx", mode: 0o755 });
  if (process.platform !== "win32") chmodSync(options.output, 0o755);
}

function main(): void {
  const options = parseExtractArguments(process.argv.slice(2));
  extractReleaseBinary(options);
  console.log(`Extracted verified Rootform ${options.version} ${options.target} binary.`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
