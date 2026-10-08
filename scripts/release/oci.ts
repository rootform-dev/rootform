import { gunzipSync } from "node:zlib";
import { sha256 } from "./digest.ts";

const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAX_LAYER_BYTES = 1024 * 1024 * 1024;
const DIGEST = /^sha256:([0-9a-f]{64})$/u;

export type ImagePlatform = {
  architecture: "amd64" | "arm64";
  os: "linux";
};

export type ImageFile = {
  mode: number;
  path: string;
  sha256: string;
  size: number;
};

export type ImageConfiguration = {
  command: string[];
  entrypoint: string[];
  environment: string[];
  labels: Record<string, string>;
  user: string;
  workingDirectory: string;
};

export type ImageVariant = {
  configuration: ImageConfiguration;
  digest: string;
  files: ImageFile[];
  layerCount: number;
  overlayFiles: ImageFile[];
  platform: ImagePlatform;
};

export type ImageArchive = {
  digest: string;
  variants: ImageVariant[];
};

type TarEntry = {
  body: Uint8Array;
  mode: number;
  path: string;
  type: string;
};

function octal(field: Uint8Array): number {
  const raw = Buffer.from(field).toString("ascii").replace(/\0/gu, " ").trim();
  if (raw === "") return 0;
  if (!/^[0-7]+$/u.test(raw)) throw new Error("container tar has an invalid numeric field");
  const value = Number.parseInt(raw, 8);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("container tar has an invalid numeric field");
  }
  return value;
}

function isZeroBlock(block: Uint8Array): boolean {
  return block.every((byte) => byte === 0);
}

function paxPath(body: Uint8Array): string | undefined {
  const text = Buffer.from(body).toString("utf8");
  for (const record of text.split("\n")) {
    const match = record.match(/^[0-9]+ path=(.*)$/u);
    if (match?.[1] !== undefined) return match[1];
  }
  return undefined;
}

/**
 * Reads an uncompressed tar stream produced by a container runtime. Container
 * tars legitimately use PAX and GNU extensions, so this reader stays tolerant
 * where the strict release reader in archive.ts stays canonical.
 */
export function readContainerTar(body: Uint8Array): TarEntry[] {
  if (body.byteLength > MAX_LAYER_BYTES) throw new Error("container tar is too large");
  const tar = Buffer.from(body);
  const entries: TarEntry[] = [];
  let pendingPath: string | undefined;
  let offset = 0;
  while (offset + 512 <= tar.byteLength) {
    const header = tar.subarray(offset, offset + 512);
    if (isZeroBlock(header)) break;
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/su, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/su, "");
    const mode = octal(header.subarray(100, 108));
    const size = octal(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] ?? 0);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.byteLength) throw new Error("container tar entry is truncated");
    const contents = tar.subarray(dataStart, dataEnd);
    offset = dataStart + Math.ceil(size / 512) * 512;
    if (type === "x" || type === "X") {
      pendingPath = paxPath(contents);
      continue;
    }
    if (type === "g") continue;
    if (type === "L") {
      pendingPath = Buffer.from(contents).toString("utf8").replace(/\0.*$/su, "");
      continue;
    }
    const joined = prefix === "" ? name : `${prefix}/${name}`;
    entries.push({ body: Buffer.from(contents), mode, path: pendingPath ?? joined, type });
    pendingPath = undefined;
  }
  return entries;
}

function blobKey(digest: string): string {
  const match = digest.match(DIGEST);
  if (!match?.[1]) throw new Error(`container digest is invalid: ${digest}`);
  return `blobs/sha256/${match[1]}`;
}

function readBlob(blobs: Map<string, Uint8Array>, digest: string): Uint8Array {
  const body = blobs.get(blobKey(digest));
  if (!body) throw new Error("container archive is missing a referenced blob");
  if (`sha256:${sha256(body)}` !== digest) throw new Error("container blob digest drifted");
  return body;
}

function readJsonBlob(blobs: Map<string, Uint8Array>, digest: string): Record<string, unknown> {
  const parsed = JSON.parse(Buffer.from(readBlob(blobs, digest)).toString("utf8")) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("container metadata blob must be an object");
  }
  return parsed as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("container configuration list is invalid");
  }
  return value as string[];
}

function labelMap(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("container labels are invalid");
  }
  const labels: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item !== "string") throw new Error("container labels are invalid");
    labels[key] = item;
  }
  return labels;
}

function platformOf(value: unknown): ImagePlatform | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.os !== "linux") return undefined;
  if (record.architecture !== "amd64" && record.architecture !== "arm64") return undefined;
  return { architecture: record.architecture, os: "linux" };
}

function layerFiles(blobs: Map<string, Uint8Array>, digest: string): ImageFile[] {
  const raw = readBlob(blobs, digest);
  const body =
    raw[0] === 0x1f && raw[1] === 0x8b
      ? gunzipSync(raw, { maxOutputLength: MAX_LAYER_BYTES })
      : Buffer.from(raw);
  return readContainerTar(body)
    .filter((entry) => entry.type === "0" || entry.type === "\0" || entry.type === "5")
    .map((entry) => ({
      mode: entry.mode,
      path: `/${entry.path.replace(/^\.?\//u, "").replace(/\/$/u, "")}`,
      sha256: sha256(entry.body),
      size: entry.body.byteLength,
    }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
}

/**
 * Parses an OCI image layout archive without a registry, a daemon, or any
 * network access, so image contents can be audited from release evidence
 * alone.
 */
export function readImageArchive(archive: Uint8Array): ImageArchive {
  if (archive.byteLength < 1024 || archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error("container image archive has an invalid size");
  }
  const blobs = new Map<string, Uint8Array>();
  let index: Record<string, unknown> | undefined;
  let layout = false;
  for (const entry of readContainerTar(archive)) {
    if (entry.type !== "0" && entry.type !== "\0") continue;
    const path = entry.path.replace(/^\.?\//u, "");
    if (path === "index.json") {
      index = JSON.parse(Buffer.from(entry.body).toString("utf8")) as Record<string, unknown>;
    } else if (path === "oci-layout") {
      layout = true;
    } else if (path.startsWith("blobs/sha256/")) {
      blobs.set(path, entry.body);
    }
  }
  if (!layout || !index) throw new Error("container image archive is not an OCI layout");
  const roots = index.manifests;
  if (!Array.isArray(roots) || roots.length !== 1) {
    throw new Error("container image archive must expose exactly one root manifest");
  }
  const rootDescriptor = roots[0] as Record<string, unknown>;
  const rootDigest = String(rootDescriptor.digest ?? "");
  const rootManifest = readJsonBlob(blobs, rootDigest);
  const descriptors = rootManifest.manifests;
  if (!Array.isArray(descriptors)) throw new Error("container image index is invalid");

  const variants: ImageVariant[] = [];
  for (const descriptor of descriptors as Array<Record<string, unknown>>) {
    const platform = platformOf(descriptor.platform);
    if (!platform) continue;
    const digest = String(descriptor.digest ?? "");
    const manifest = readJsonBlob(blobs, digest);
    const configDescriptor = manifest.config as Record<string, unknown> | undefined;
    const layers = manifest.layers;
    if (!configDescriptor || !Array.isArray(layers) || layers.length === 0) {
      throw new Error("container image manifest is invalid");
    }
    const configuration = readJsonBlob(blobs, String(configDescriptor.digest ?? ""));
    const runtime = (configuration.config ?? {}) as Record<string, unknown>;
    const files: ImageFile[] = [];
    const overlayFiles: ImageFile[] = [];
    layers.forEach((layer, position) => {
      const contents = layerFiles(blobs, String((layer as Record<string, unknown>).digest ?? ""));
      files.push(...contents);
      if (position > 0) overlayFiles.push(...contents);
    });
    variants.push({
      configuration: {
        command: stringArray(runtime.Cmd),
        entrypoint: stringArray(runtime.Entrypoint),
        environment: stringArray(runtime.Env),
        labels: labelMap(runtime.Labels),
        user: typeof runtime.User === "string" ? runtime.User : "",
        workingDirectory: typeof runtime.WorkingDir === "string" ? runtime.WorkingDir : "",
      },
      digest,
      files: files.sort((left, right) => left.path.localeCompare(right.path, "en")),
      layerCount: layers.length,
      overlayFiles: overlayFiles.sort((left, right) => left.path.localeCompare(right.path, "en")),
      platform,
    });
  }
  if (variants.length === 0) throw new Error("container image archive exposes no linux platform");
  return {
    digest: rootDigest,
    variants: variants.sort((left, right) =>
      left.platform.architecture.localeCompare(right.platform.architecture, "en"),
    ),
  };
}
