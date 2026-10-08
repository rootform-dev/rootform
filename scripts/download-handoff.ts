#!/usr/bin/env bun

import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { handoffBundleName, normalizeVersion } from "./release/contract.ts";
import { sha256 } from "./release/digest.ts";

const repository = "rootform-dev/rootform";
const maximumAssetBytes = 512 * 1024 * 1024;
const maximumReleaseMetadataBytes = 4 * 1024 * 1024;

type JsonObject = Record<string, unknown>;

export type GitHubRequest = (url: string, init: RequestInit) => Promise<Response>;

type DownloadOptions = {
  metadata: string;
  output: string;
  releaseId: number;
  request?: GitHubRequest;
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
  if (!/^[1-9][0-9]*$/u.test(value)) throw new Error(`invalid handoff release ID: ${value}`);
  return safeInteger(Number(value), "handoff release ID");
}

export function parseDownloadArguments(
  arguments_: string[],
  cwd = process.cwd(),
): DownloadArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    const name = ["version", "release-id", "output", "metadata"].find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown handoff download argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate handoff download argument: --${name}`);
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

function releaseAssets(release: JsonObject, releaseId: number, version: string): AssetRecord[] {
  if (release.id !== releaseId || release.draft !== true) {
    throw new Error("handoff source must be the requested draft release");
  }
  if (!Array.isArray(release.assets)) throw new Error("handoff release assets are unavailable");
  const expectedNames = ["ENGINE_HANDOFF_SHA256SUMS", handoffBundleName(version)].sort(
    (left, right) => left.localeCompare(right, "en"),
  );
  const assets = release.assets.map((value, index) => {
    const asset = object(value, `handoff release asset ${index}`);
    const name = asset.name;
    const digest = asset.digest;
    if (typeof name !== "string" || typeof digest !== "string") {
      throw new Error(`handoff release asset ${index} lacks identity`);
    }
    const size = safeInteger(asset.size, `handoff release asset size: ${name}`);
    if (size > maximumAssetBytes) throw new Error(`handoff release asset is too large: ${name}`);
    if (!/^sha256:[0-9a-f]{64}$/u.test(digest)) {
      throw new Error(`handoff release asset lacks SHA-256 digest: ${name}`);
    }
    return {
      digest,
      id: safeInteger(asset.id, `handoff release asset ID: ${name}`),
      name,
      size,
    };
  });
  assets.sort((left, right) => left.name.localeCompare(right.name, "en"));
  if (JSON.stringify(assets.map(({ name }) => name)) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `handoff release asset inventory drifted: ${assets.map(({ name }) => name).join(", ")}`,
    );
  }
  return assets;
}

function metadataInsideOutput(metadata: string, output: string): boolean {
  const path = relative(output, metadata);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export async function downloadHandoff(options: DownloadOptions): Promise<void> {
  const version = normalizeVersion(options.version);
  const token = options.token.trim();
  if (!token) throw new Error("GITHUB_TOKEN is required to download the handoff");
  const output = resolve(options.output);
  const metadata = resolve(options.metadata);
  if (metadataInsideOutput(metadata, output)) {
    throw new Error("handoff metadata must remain outside the handoff asset directory");
  }
  if (existsSync(output)) throw new Error("handoff output path already exists");
  if (existsSync(metadata)) throw new Error("handoff metadata path already exists");
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(dirname(metadata), { recursive: true });
  const temporaryOutput = mkdtempSync(join(dirname(output), ".handoff-download-"));
  const temporaryMetadata = mkdtempSync(join(dirname(metadata), ".handoff-metadata-"));
  const request = options.request ?? ((url, init) => fetch(url, init));
  let outputPromoted = false;
  let metadataPromoted = false;
  try {
    const releaseResponse = await request(
      `https://api.github.com/repos/${repository}/releases/${options.releaseId}`,
      { headers: headers(token, "application/vnd.github+json") },
    );
    const releaseBody = await responseBody(
      releaseResponse,
      "handoff release request",
      maximumReleaseMetadataBytes,
    );
    let releaseValue: unknown;
    try {
      releaseValue = JSON.parse(releaseBody.toString("utf8"));
    } catch {
      throw new Error("handoff release response is invalid JSON");
    }
    const assets = releaseAssets(
      object(releaseValue, "handoff release"),
      options.releaseId,
      version,
    );
    for (const asset of assets) {
      const assetResponse = await request(
        `https://api.github.com/repos/${repository}/releases/assets/${asset.id}`,
        { headers: headers(token, "application/octet-stream"), redirect: "follow" },
      );
      const body = await responseBody(
        assetResponse,
        `handoff asset request: ${asset.name}`,
        asset.size,
      );
      if (body.byteLength !== asset.size || `sha256:${sha256(body)}` !== asset.digest) {
        throw new Error(`downloaded handoff asset digest drifted: ${asset.name}`);
      }
      writeFileSync(join(temporaryOutput, asset.name), body, { flag: "wx", mode: 0o644 });
    }
    const metadataBody = `${JSON.stringify(
      {
        assets: assets.map(({ digest, name, size }) => ({ digest, name, size })),
        draft: true,
        release_id: options.releaseId,
      },
      null,
      2,
    )}\n`;
    const temporaryMetadataFile = join(temporaryMetadata, "github-assets.json");
    writeFileSync(temporaryMetadataFile, metadataBody, { flag: "wx", mode: 0o644 });
    renameSync(temporaryOutput, output);
    outputPromoted = true;
    renameSync(temporaryMetadataFile, metadata);
    metadataPromoted = true;
  } catch (error) {
    if (metadataPromoted) rmSync(metadata, { force: true });
    if (outputPromoted) rmSync(output, { force: true, recursive: true });
    throw error;
  } finally {
    rmSync(temporaryOutput, { force: true, recursive: true });
    rmSync(temporaryMetadata, { force: true, recursive: true });
  }
}

async function main(): Promise<void> {
  const options = parseDownloadArguments(process.argv.slice(2));
  await downloadHandoff({
    ...options,
    token: process.env.GITHUB_TOKEN ?? "",
  });
  console.log(`Downloaded authenticated Rootform ${options.version} handoff.`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
