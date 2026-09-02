#!/usr/bin/env bun

import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { normalizeVersion, releaseAssetNames } from "./release/contract.ts";
import { sha256 } from "./release/digest.ts";

const repository = "rootform-dev/rootform";
const maximumAssetBytes = 512 * 1024 * 1024;
const maximumReleaseMetadataBytes = 4 * 1024 * 1024;

type JsonObject = Record<string, unknown>;

export type GitHubReleaseRequest = (url: string, init: RequestInit) => Promise<Response>;

export type ReleaseDownloadMetadata = {
  assets: Array<{ digest: string; name: string; size: number }>;
  prerelease: boolean;
  release_id: number;
  tag: string;
  target_commit: string;
};

type DownloadOptions = {
  metadata: string;
  output: string;
  releaseId: number;
  request?: GitHubReleaseRequest;
  token: string;
  version: string;
};

type DownloadArguments = Omit<DownloadOptions, "request" | "token">;

type AssetRecord = {
  digest: string;
  id: number;
  name: string;
  size: number;
};

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function safeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return Number(value);
}

function parseReleaseId(value: string): number {
  if (!/^[1-9][0-9]*$/u.test(value)) throw new Error(`invalid release ID: ${value}`);
  return safeInteger(Number(value), "release ID");
}

export function parseReleaseDownloadArguments(
  arguments_: string[],
  cwd = process.cwd(),
): DownloadArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    const name = ["version", "release-id", "output", "metadata"].find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown release download argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate release download argument: --${name}`);
    const inline = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++index];
    if (!inline || inline.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, inline);
  }
  for (const required of ["version", "release-id", "output", "metadata"]) {
    if (!values.get(required)) throw new Error(`--${required} is required`);
  }
  return {
    metadata: absolute(values.get("metadata") as string, cwd),
    output: absolute(values.get("output") as string, cwd),
    releaseId: parseReleaseId(values.get("release-id") as string),
    version: normalizeVersion(values.get("version") as string),
  };
}

function headers(token: string, accept: string): Record<string, string> {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function responseBody(response: Response, label: string, maximum: number): Promise<Buffer> {
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`);
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^[0-9]+$/u.test(declared) || Number(declared) > maximum)) {
    throw new Error(`${label} exceeds its maximum size`);
  }
  if (!response.body) throw new Error(`${label} returned no body`);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new Error(`${label} exceeds its maximum size`);
      }
      chunks.push(Buffer.from(result.value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

function releaseAssets(
  release: JsonObject,
  releaseId: number,
  version: string,
): { assets: AssetRecord[]; metadata: Omit<ReleaseDownloadMetadata, "assets"> } {
  const tag = `v${version}`;
  if (
    release.id !== releaseId ||
    release.draft !== false ||
    typeof release.prerelease !== "boolean" ||
    release.tag_name !== tag ||
    typeof release.target_commitish !== "string" ||
    !/^[0-9a-f]{40}$/u.test(release.target_commitish)
  ) {
    throw new Error("release source must be one exact published version and commit");
  }
  if (!Array.isArray(release.assets)) throw new Error("release assets are unavailable");
  const expectedNames = releaseAssetNames(version);
  const assets = release.assets.map((value, index) => {
    const asset = object(value, `release asset ${index}`);
    if (typeof asset.name !== "string" || typeof asset.digest !== "string") {
      throw new Error(`release asset ${index} lacks identity`);
    }
    const size = safeInteger(asset.size, `release asset size: ${asset.name}`);
    if (size > maximumAssetBytes) throw new Error(`release asset is too large: ${asset.name}`);
    if (!/^sha256:[0-9a-f]{64}$/u.test(asset.digest)) {
      throw new Error(`release asset lacks SHA-256 digest: ${asset.name}`);
    }
    return {
      digest: asset.digest,
      id: safeInteger(asset.id, `release asset ID: ${asset.name}`),
      name: asset.name,
      size,
    };
  });
  assets.sort((left, right) => left.name.localeCompare(right.name, "en"));
  if (JSON.stringify(assets.map(({ name }) => name)) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `release asset inventory drifted: ${assets.map(({ name }) => name).join(", ")}`,
    );
  }
  return {
    assets,
    metadata: {
      prerelease: release.prerelease,
      release_id: releaseId,
      tag,
      target_commit: release.target_commitish,
    },
  };
}

function metadataInsideOutput(metadata: string, output: string): boolean {
  const path = relative(output, metadata);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export async function downloadRelease(options: DownloadOptions): Promise<ReleaseDownloadMetadata> {
  const version = normalizeVersion(options.version);
  const token = options.token.trim();
  if (!token) throw new Error("GITHUB_TOKEN is required to download the release");
  const output = resolve(options.output);
  const metadata = resolve(options.metadata);
  if (metadataInsideOutput(metadata, output)) {
    throw new Error("release metadata must remain outside the asset directory");
  }
  if (existsSync(output)) throw new Error("release output path already exists");
  if (existsSync(metadata)) throw new Error("release metadata path already exists");
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(dirname(metadata), { recursive: true });
  const temporaryOutput = mkdtempSync(join(dirname(output), ".release-download-"));
  const temporaryMetadata = mkdtempSync(join(dirname(metadata), ".release-metadata-"));
  const request = options.request ?? ((url, init) => fetch(url, init));
  let outputPromoted = false;
  let metadataPromoted = false;
  try {
    const releaseResponse = await request(
      `https://api.github.com/repos/${repository}/releases/${options.releaseId}`,
      { headers: headers(token, "application/vnd.github+json") },
    );
    const encodedRelease = await responseBody(
      releaseResponse,
      "release request",
      maximumReleaseMetadataBytes,
    );
    let releaseValue: unknown;
    try {
      releaseValue = JSON.parse(encodedRelease.toString("utf8"));
    } catch {
      throw new Error("release response is invalid JSON");
    }
    const selected = releaseAssets(object(releaseValue, "release"), options.releaseId, version);
    for (const asset of selected.assets) {
      const response = await request(
        `https://api.github.com/repos/${repository}/releases/assets/${asset.id}`,
        { headers: headers(token, "application/octet-stream"), redirect: "follow" },
      );
      const body = await responseBody(response, `release asset request: ${asset.name}`, asset.size);
      if (body.byteLength !== asset.size || `sha256:${sha256(body)}` !== asset.digest) {
        throw new Error(`downloaded release asset digest drifted: ${asset.name}`);
      }
      writeFileSync(join(temporaryOutput, asset.name), body, { flag: "wx", mode: 0o644 });
    }
    const evidence: ReleaseDownloadMetadata = {
      assets: selected.assets.map(({ digest, name, size }) => ({ digest, name, size })),
      ...selected.metadata,
    };
    const temporaryMetadataFile = join(temporaryMetadata, "github-release.json");
    writeFileSync(temporaryMetadataFile, `${JSON.stringify(evidence, null, 2)}\n`, {
      flag: "wx",
      mode: 0o644,
    });
    renameSync(temporaryOutput, output);
    outputPromoted = true;
    renameSync(temporaryMetadataFile, metadata);
    metadataPromoted = true;
    return evidence;
  } catch (error) {
    if (metadataPromoted) rmSync(metadata, { force: true });
    if (outputPromoted) rmSync(output, { force: true, recursive: true });
    throw error;
  } finally {
    rmSync(temporaryOutput, { force: true, recursive: true });
    rmSync(temporaryMetadata, { force: true, recursive: true });
  }
}

if (import.meta.main) {
  try {
    const options = parseReleaseDownloadArguments(process.argv.slice(2));
    await downloadRelease({ ...options, token: process.env.GITHUB_TOKEN ?? "" });
    console.log(`Downloaded authenticated Rootform ${options.version} release.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
