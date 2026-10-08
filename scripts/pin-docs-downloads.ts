#!/usr/bin/env bun

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { normalizeVersion } from "./release/contract.ts";

// Documentation downloads name files of this repository through raw GitHub
// URLs. On dev they follow the dev branch so examples stay current. A published
// tag is immutable, so the commit it tags must download from that same tag:
// a branch would let the files change under a release that cannot.
export const DOWNLOAD_PREFIX = "https://raw.githubusercontent.com/rootform-dev/rootform/";
const DOWNLOAD_PATTERN =
  /https:\/\/raw\.githubusercontent\.com\/rootform-dev\/rootform\/([^/\s)"'`<>]+)\/([^\s)"'`<>]+)/gu;

export type Download = {
  file: string;
  line: number;
  path: string;
  ref: string;
};

export function releaseTag(version: string): string {
  if (version === "dev") return "dev";
  return `v${normalizeVersion(version)}`;
}

export function findDownloads(file: string, text: string): Download[] {
  const downloads: Download[] = [];
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(DOWNLOAD_PATTERN)) {
      downloads.push({ file, line: index + 1, path: match[2] ?? "", ref: match[1] ?? "" });
    }
  }
  return downloads;
}

export function pinDownloads(text: string, tag: string): string {
  return text.replace(
    DOWNLOAD_PATTERN,
    (_url, _ref: string, path: string) => `${DOWNLOAD_PREFIX}${tag}/${path}`,
  );
}

export function unpinnedDownloads(downloads: Download[], tag: string): Download[] {
  return downloads.filter(({ ref }) => ref !== tag);
}

export function documentationFiles(root: string): string[] {
  const files = ["README.md"];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (relative(root, path) !== join("docs", "assets")) walk(path);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(relative(root, path));
      }
    }
  };
  walk(join(root, "docs"));
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function usage(): never {
  console.error("usage: pin-docs-downloads.ts [--check] <version|dev>");
  process.exit(2);
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const args = process.argv.slice(2);
  const check = args[0] === "--check";
  const version = check ? args[1] : args[0];
  if (version === undefined || args.length !== (check ? 2 : 1)) usage();
  const tag = releaseTag(version);
  const downloads: Download[] = [];
  let rewritten = 0;
  for (const file of documentationFiles(root)) {
    const path = join(root, file);
    const text = readFileSync(path, "utf8");
    const found = findDownloads(file, text);
    downloads.push(...found);
    if (!check && unpinnedDownloads(found, tag).length > 0) {
      writeFileSync(path, pinDownloads(text, tag));
      rewritten += unpinnedDownloads(found, tag).length;
    }
  }
  if (check) {
    const unpinned = unpinnedDownloads(downloads, tag);
    for (const { file, line, ref } of unpinned) {
      console.error(`${file}:${line}: documentation download follows ${ref}, not ${tag}`);
    }
    if (unpinned.length > 0) process.exit(1);
    console.log(`All ${downloads.length} documentation downloads reference ${tag}.`);
  } else {
    console.log(`Pinned ${rewritten} of ${downloads.length} documentation downloads to ${tag}.`);
  }
}
