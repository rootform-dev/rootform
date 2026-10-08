#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  documentationFiles,
  findDownloads,
  pinDownloads,
  releaseTag,
  unpinnedDownloads,
} from "./pin-docs-downloads.ts";
import { normalizeVersion, releaseVersionRefusal } from "./release/contract.ts";

// This repository alone names a release of the Rootform binary. A release pull
// request sets the version in package.json, moves the Unreleased changelog
// entries under that version, and points the documentation at its tag;
// public-export.json already names the Engine commit that builds it. Once the
// pull request is promoted to main, `--check` reads that request for the
// release handoff and for candidate qualification, or refuses it.

export type ReleaseRequest = { engine_commit: string; tag: string; version: string };

export type Mention = { file: string; line: number; version: string };

const VERSION = String.raw`[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?`;

// Documentation names the released binary in these forms. Language, Dialect,
// and Policy Pack versions are separate and never match.
const MENTIONS: ReadonlyArray<{ applies: (file: string) => boolean; pattern: RegExp }> = [
  {
    applies: () => true,
    pattern: new RegExp(`(ghcr\\.io/rootform-dev/rootform:)(${VERSION})`, "gu"),
  },
  {
    applies: () => true,
    pattern: new RegExp(`(rootform_)(${VERSION})(?=_(?:darwin|linux|windows)_)`, "gu"),
  },
  {
    applies: () => true,
    pattern: new RegExp(`(rootform-dev/rootform/releases/(?:tag|download)/v)(${VERSION})`, "gu"),
  },
  { applies: () => true, pattern: new RegExp(`(\\[Rootform v)(${VERSION})(?=\\])`, "gu") },
  {
    // The version input of the GitHub Action examples.
    applies: (file) => file.startsWith("docs/integrations/github-actions"),
    pattern: new RegExp(`^(\\s*version: )(${VERSION})$`, "gmu"),
  },
  {
    applies: (file) => file === "installers/README.md",
    pattern: new RegExp(`(--version )(${VERSION})`, "gu"),
  },
];

export function releaseDocuments(root: string): string[] {
  return [...documentationFiles(root), "installers/README.md"].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

export function versionMentions(file: string, text: string): Mention[] {
  const mentions: Mention[] = [];
  const lines = text.split("\n");
  for (const { applies, pattern } of MENTIONS) {
    if (!applies(file)) continue;
    for (const [index, line] of lines.entries()) {
      for (const match of line.matchAll(new RegExp(pattern.source, pattern.flags))) {
        mentions.push({ file, line: index + 1, version: match[2] ?? "" });
      }
    }
  }
  return mentions.sort((left, right) => left.line - right.line);
}

export function rewriteMentions(file: string, text: string, version: string): string {
  let next = text;
  for (const { applies, pattern } of MENTIONS) {
    if (applies(file))
      next = next.replace(pattern, (_match, prefix: string) => `${prefix}${version}`);
  }
  return next;
}

function changelogSection(
  lines: string[],
  heading: string,
): { end: number; start: number } | undefined {
  const start = lines.indexOf(heading);
  if (start === -1) return undefined;
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return { end: next === -1 ? lines.length : next, start };
}

export function releaseChangelog(text: string, version: string): string {
  const lines = text.split("\n");
  if (lines.includes(`## ${version}`))
    throw new Error(`CHANGELOG.md already has a section for ${version}`);
  const unreleased = changelogSection(lines, "## Unreleased");
  if (!unreleased) throw new Error("CHANGELOG.md has no Unreleased section");
  const entries = lines.slice(unreleased.start + 1, unreleased.end);
  if (!entries.some((line) => line.startsWith("- "))) {
    throw new Error("CHANGELOG.md has no Unreleased change to release");
  }
  return [
    ...lines.slice(0, unreleased.start),
    "## Unreleased",
    "",
    `## ${version}`,
    ...entries,
    ...lines.slice(unreleased.end),
  ].join("\n");
}

export function releasedEntries(text: string, version: string): number {
  const lines = text.split("\n");
  const section = changelogSection(lines, `## ${version}`);
  if (!section) return 0;
  return lines.slice(section.start + 1, section.end).filter((line) => line.startsWith("- ")).length;
}

export function releaseNotes(text: string, version: string): string {
  const lines = text.split("\n");
  const section = changelogSection(lines, `## ${version}`);
  const body = section
    ? lines
        .slice(section.start + 1, section.end)
        .join("\n")
        .trim()
    : "";
  if (!body) throw new Error(`CHANGELOG.md has no entries under ## ${version}`);
  return `${body}\n\nUse, redistribution, and modification of these binaries follow the attached ROOTFORM-BINARY-LICENSE.txt and THIRD_PARTY_NOTICES.txt.\n`;
}

export function withPackageVersion(text: string, version: string): string {
  const pattern = /^( {2}"version": ")([^"]+)(",)$/mu;
  if (!pattern.test(text)) throw new Error("package.json has no top-level version");
  return text.replace(
    pattern,
    (_line, prefix: string, _old: string, suffix: string) => `${prefix}${version}${suffix}`,
  );
}

function readText(root: string, file: string): string {
  return readFileSync(join(root, file), "utf8");
}

export function checkRelease(root: string): { problems: string[]; request?: ReleaseRequest } {
  const problems: string[] = [];
  const version = String(JSON.parse(readText(root, "package.json")).version ?? "");
  const refusal = releaseVersionRefusal(version);
  if (refusal) return { problems: [`package.json: ${refusal}`] };
  const tag = releaseTag(version);
  if (releasedEntries(readText(root, "CHANGELOG.md"), version) === 0) {
    problems.push(`CHANGELOG.md: no entries under ## ${version}`);
  }
  for (const file of releaseDocuments(root)) {
    const text = readText(root, file);
    for (const { line, ref } of unpinnedDownloads(findDownloads(file, text), tag)) {
      problems.push(`${file}:${line}: documentation download follows ${ref}, not ${tag}`);
    }
    for (const mention of versionMentions(file, text)) {
      if (mention.version !== version) {
        problems.push(`${file}:${mention.line}: names Rootform ${mention.version}, not ${version}`);
      }
    }
  }
  const exported = JSON.parse(readText(root, "public-export.json"));
  const engineCommit = String(exported.source_commit ?? "");
  if (
    exported.source_repository !== "rootform-dev/engine" ||
    !/^[0-9a-f]{40}$/u.test(engineCommit)
  ) {
    problems.push("public-export.json: no exact Engine commit");
  }
  if (problems.length > 0) return { problems };
  return { problems, request: { engine_commit: engineCommit, tag, version } };
}

export function prepareRelease(root: string, version: string): string[] {
  const refusal = releaseVersionRefusal(version);
  if (refusal) throw new Error(refusal);
  const normalized = normalizeVersion(version);
  const tag = releaseTag(normalized);
  const changed: string[] = [];
  const write = (file: string, next: string) => {
    if (readText(root, file) === next) return;
    writeFileSync(join(root, file), next);
    changed.push(file);
  };
  write("CHANGELOG.md", releaseChangelog(readText(root, "CHANGELOG.md"), normalized));
  write("package.json", withPackageVersion(readText(root, "package.json"), normalized));
  for (const file of releaseDocuments(root)) {
    write(file, pinDownloads(rewriteMentions(file, readText(root, file), normalized), tag));
  }
  return changed;
}

function usage(): never {
  console.error(
    "usage: prepare-release.ts <version> | prepare-release.ts --check | prepare-release.ts --notes",
  );
  process.exit(2);
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const args = process.argv.slice(2);
  if (args.length !== 1) usage();
  if (args[0] === "--check") {
    const { problems, request } = checkRelease(root);
    for (const problem of problems) console.error(problem);
    if (!request) {
      console.error(
        "This commit does not request a release. Prepare one with bun scripts/prepare-release.ts <version>.",
      );
      process.exit(1);
    }
    console.log(JSON.stringify(request));
  } else if (args[0] === "--notes") {
    // The notes of the draft release, published with it: this version's changelog.
    try {
      const version = String(JSON.parse(readText(root, "package.json")).version ?? "");
      process.stdout.write(releaseNotes(readText(root, "CHANGELOG.md"), version));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else {
    const version = args[0] ?? "";
    if (version.startsWith("-")) usage();
    try {
      const changed = prepareRelease(root, version);
      const { problems } = checkRelease(root);
      for (const problem of problems) console.error(problem);
      if (problems.length > 0) process.exit(1);
      console.log(
        `Prepared Rootform ${version} in ${changed.length} files: ${changed.join(", ")}.`,
      );
      console.log(
        `Open a pull request into dev titled "chore(release): prepare ${version}", then promote it.`,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}
