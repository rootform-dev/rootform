import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkPublication, trackedPublicationIssues } from "./check-publication.ts";
import { assertPublicMessage, publicationIssues } from "./publication-safety.ts";

test("synthetic private content is refused without echoing its value", () => {
  for (const value of [
    "/" + "Users/fictional/project",
    "github_" + "pat_" + "SYNTHETIC".repeat(8),
    "FixtureReviewer" + " 9.9 Max review",
    "# Session" + " report",
    "Includes 12" + " merged Engine pull requests",
  ]) {
    expect(publicationIssues(value).length).toBeGreaterThan(0);
    try {
      assertPublicMessage({ output: { summary: value } });
      throw new Error("Expected rejection");
    } catch (error) {
      expect(String(error)).toContain("Public message refused:");
      expect(String(error)).not.toContain(value);
    }
  }
});

test("public AI, agent and spec terminology and technical provenance remain valid", () => {
  expect(() =>
    assertPublicMessage([
      "AI integration uses a documented API.",
      "The agent runs validation; this spec defines the public schema.",
      { source_repository: "rootform-dev/engine", source_commit: "a".repeat(40) },
      "The binary handoff verifies exact provenance.",
    ]),
  ).not.toThrow();
});

test("serialized and URL-encoded metadata is inspected before sending", () => {
  expect(() => assertPublicMessage(undefined)).not.toThrow();
  const path = "/" + "Users/fictional/session";
  const token = "github_" + "pat_" + "SYNTHETIC".repeat(8);
  for (const value of [path, token]) {
    for (const serialized of [
      encodeURIComponent(value),
      encodeURIComponent(encodeURIComponent(value)),
      JSON.stringify({ value }).replaceAll("/", "\\/"),
      JSON.stringify({ value }).replaceAll("/", "\\u002f"),
      { encoding: "base64", content: btoa(value) },
      { encoding: "base64", content: btoa(JSON.stringify({ value }).replaceAll("/", "\\u002f")) },
      JSON.stringify({ API_TOKEN: value }),
      { message: "Update public fixture", content: btoa(value) },
    ]) {
      try {
        assertPublicMessage(serialized);
        throw new Error("Expected rejection");
      } catch (error) {
        expect(String(error)).toContain("Public message refused:");
        expect(String(error)).not.toContain(value);
      }
    }
  }
  expect(() =>
    assertPublicMessage({ encoding: "base64", content: btoa("Public fixture") }),
  ).not.toThrow();
  expect(() => assertPublicMessage({ encoding: "base64", content: "?" })).toThrow(
    "uninspectable-content",
  );
});

test("nested JSON and rendered metadata cannot hide private text", () => {
  const credential = "SYNTHETIC".repeat(8);
  const path = "/" + "Users/fictional/session";
  for (const value of [
    { body: JSON.stringify({ API_KEY: credential }) },
    '"api_key": "' + credential + '"',
    { body: JSON.stringify({ CLOUDFLARE_API_KEY: credential }) },
    { encoding: "base64", content: Buffer.from(path, "utf16le").toString("base64") },
    ["&#47", ";Users&#47", ";fictional&#47", ";session"].join(""),
    "notes/" + "fictional-session/report.json",
  ])
    expect(() => assertPublicMessage(value)).toThrow("Public message refused:");
  for (const value of [
    "ROOTFORM_DATADOG_CLOUDFLARE_KEY_SENTINEL",
    "ROOTFORM_DATADOG_FASTLY_KEY_SENTINEL",
    "ROOTFORM_HCP_DATADOG_API_SENTINEL",
    "ROOTFORM_ATLAS_OBSERVABILITY_SECRET",
  ])
    expect(() => assertPublicMessage('api_key = "' + value + '"')).not.toThrow();
});

test("tracked ignored files and staged bytes cannot escape the publication scan", () => {
  const directory = mkdtempSync(join(tmpdir(), "publication-fixture-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: directory });
  try {
    git("init", "-q");
    writeFileSync(join(directory, ".gitignore"), "artifacts/\n");
    mkdirSync(join(directory, "artifacts"));
    writeFileSync(join(directory, "artifacts/tracked.txt"), "/" + "Users/fictional/hidden");
    git("add", ".gitignore");
    git("add", "-f", "artifacts/tracked.txt");
    expect(trackedPublicationIssues(directory)[0]?.rule).toBe("personal-path");
    writeFileSync(join(directory, "artifacts/tracked.txt"), "Clean working copy.\n");
    expect(() => checkPublication(["--repo", directory, "--staged"])).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("large staged files are inspected and Git failures never echo their input", () => {
  const directory = mkdtempSync(join(tmpdir(), "publication-large-fixture-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: directory });
  try {
    git("init", "-q");
    writeFileSync(
      join(directory, "bundle.js"),
      `${"x".repeat(2 * 1024 * 1024)}\n/${"Users/fictional/hidden"}`,
    );
    git("add", "bundle.js");
    expect(trackedPublicationIssues(directory, ":")[0]?.rule).toBe("personal-path");
    const revision = "/" + "Users/fictional/invalid";
    expect(() => trackedPublicationIssues(directory, revision)).toThrow(
      "cannot read tracked Git content",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("staged symlink modes cannot be concealed by the working copy", () => {
  const directory = mkdtempSync(join(tmpdir(), "publication-link-fixture-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: directory });
  try {
    git("init", "-q");
    symlinkSync("nonexistent-fixture", join(directory, "alias"));
    git("add", "alias");
    rmSync(join(directory, "alias"));
    writeFileSync(join(directory, "alias"), "Regular working copy.\n");
    expect(trackedPublicationIssues(directory)).toEqual([]);
    expect(trackedPublicationIssues(directory, ":")[0]?.rule).toBe("symlink");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("named credentials are checked recursively while exact synthetic literals remain valid", () => {
  const credential = "SYNTHETIC".repeat(8);
  for (const payload of [
    { API_TOKEN: credential },
    { encoding: "base64", content: btoa(JSON.stringify({ api_key: credential })) },
    {
      encoding: "base64",
      content: btoa(
        JSON.stringify({ encoding: "base64", content: btoa("github_" + "pat_" + credential) }),
      ),
    },
  ])
    expect(() => assertPublicMessage(payload)).toThrow("credential");
  for (const value of [
    "ROOTFORM_DATADOG_CLOUDFLARE_KEY_SENTINEL",
    "ROOTFORM_DATADOG_FASTLY_KEY_SENTINEL",
    "ROOTFORM_HCP_DATADOG_API_SENTINEL",
    "ROOTFORM_ATLAS_OBSERVABILITY_SECRET",
  ]) {
    expect(() => assertPublicMessage({ api_key: value })).not.toThrow();
    expect(() => assertPublicMessage({ api_key: value + "_CHANGED" })).toThrow("credential");
  }
  const path = "/" + "Users/fictional/session";
  expect(() =>
    assertPublicMessage({
      encoding: "base64",
      content: btoa(JSON.stringify({ value: path }).replaceAll("/", "\\u002f")),
    }),
  ).toThrow("personal-path");
});
