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
