import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  checkRelease,
  prepareRelease,
  releaseChangelog,
  releasedEntries,
  releaseNotes,
  rewriteMentions,
  versionMentions,
  withPackageVersion,
} from "./prepare-release.ts";
import { releaseVersionRefusal } from "./release/contract.ts";

const engineCommit = "0123456789abcdef0123456789abcdef01234567";

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "rootform-prepare-release-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

function repository(): string {
  return fixture({
    "CHANGELOG.md": "# Changelog\n\n## Unreleased\n\n- Added a report.\n- Fixed a limit.\n",
    "README.md":
      "curl -fsSLO https://raw.githubusercontent.com/rootform-dev/rootform/dev/examples/plan.json\n",
    "docs/installation.md": [
      "docker pull ghcr.io/rootform-dev/rootform:0.1.0",
      "From [Rootform v0.1.0](https://github.com/rootform-dev/rootform/releases/tag/v0.1.0),",
      "| Linux | `rootform_0.1.0_linux_amd64.tar.gz` |",
      'policy_pack "team" { version = "0.1.0" }',
      "rootform uninstall dialects payments@0.1.0",
      "",
    ].join("\n"),
    "docs/integrations/github-actions.md":
      "- uses: rootform-dev/action@v1\n  with:\n    version: 0.1.0\n",
    "distribution/installers/README.md":
      "bun scripts/generate-installation.ts \\\n  --version 0.1.0 \\\n",
    "package.json":
      '{\n  "name": "@rootform/distribution",\n  "version": "0.1.0",\n  "private": true\n}\n',
    "public-export.json": JSON.stringify({
      files: [],
      format_version: "1",
      source_commit: engineCommit,
      source_repository: "rootform-dev/engine",
    }),
  });
}

test("release versions refuse retired tags and pull request identities", () => {
  expect(releaseVersionRefusal("0.1.2")).toBeUndefined();
  expect(releaseVersionRefusal("0.2.0-rc.1")).toBeUndefined();
  for (const retired of ["0.1.0", "0.1.1", "0.1.0-dev.2"]) {
    expect(releaseVersionRefusal(retired)).toContain("deleted immutable release");
  }
  expect(releaseVersionRefusal("0.1.2-pr.117.1")).toContain("pull request build identity");
  expect(releaseVersionRefusal("v0.1.2")).toContain("invalid release version");
});

test("the changelog releases every Unreleased entry under the version", () => {
  const text = "# Changelog\n\n## Unreleased\n\n- One.\n- Two.\n\n## 0.0.9\n\n- Old.\n";
  const released = releaseChangelog(text, "0.1.2");
  expect(released).toBe(
    "# Changelog\n\n## Unreleased\n\n## 0.1.2\n\n- One.\n- Two.\n\n## 0.0.9\n\n- Old.\n",
  );
  expect(releasedEntries(released, "0.1.2")).toBe(2);
  expect(releaseNotes(released, "0.1.2")).toStartWith("- One.\n- Two.\n\nUse, redistribution");
  expect(() => releaseNotes(released, "0.1.3")).toThrow("no entries under ## 0.1.3");
  expect(() => releaseChangelog(released, "0.1.2")).toThrow("already has a section");
  expect(() => releaseChangelog(released, "0.1.3")).toThrow("no Unreleased change");
});

test("only mentions of the released binary follow the version", () => {
  const text = readFileSync(join(repository(), "docs/installation.md"), "utf8");
  expect(versionMentions("docs/installation.md", text).map(({ line }) => line)).toEqual([
    1, 2, 2, 3,
  ]);
  const next = rewriteMentions("docs/installation.md", text, "0.2.0-rc.1");
  expect(next).toContain("ghcr.io/rootform-dev/rootform:0.2.0-rc.1");
  expect(next).toContain(
    "[Rootform v0.2.0-rc.1](https://github.com/rootform-dev/rootform/releases/tag/v0.2.0-rc.1)",
  );
  expect(next).toContain("rootform_0.2.0-rc.1_linux_amd64.tar.gz");
  expect(next).toContain('version = "0.1.0"');
  expect(next).toContain("payments@0.1.0");
  const action = "  with:\n    version: 0.1.0\n";
  expect(versionMentions("docs/integrations/github-actions/check.md", action)).toHaveLength(1);
  expect(versionMentions("docs/guides/check-with-policies.md", action)).toEqual([]);
});

test("the package version changes without reformatting package.json", () => {
  const text =
    '{\n  "name": "x",\n  "version": "0.1.0",\n  "dependencies": { "a": { "version": "1" } }\n}\n';
  expect(withPackageVersion(text, "0.1.2")).toBe(
    text.replace('"version": "0.1.0"', '"version": "0.1.2"'),
  );
});

test("a prepared release is the request the check reads", () => {
  const root = repository();
  expect(checkRelease(root).problems).toEqual([
    "package.json: v0.1.0 belonged to a deleted immutable release and cannot be used again; choose another version",
  ]);
  expect(() => prepareRelease(root, "0.1.1")).toThrow("deleted immutable release");
  expect(prepareRelease(root, "0.1.2")).toEqual([
    "CHANGELOG.md",
    "package.json",
    "distribution/installers/README.md",
    "docs/installation.md",
    "docs/integrations/github-actions.md",
    "README.md",
  ]);
  expect(checkRelease(root)).toEqual({
    problems: [],
    request: { engine_commit: engineCommit, tag: "v0.1.2", version: "0.1.2" },
  });
  expect(readFileSync(join(root, "README.md"), "utf8")).toContain(
    "/rootform/v0.1.2/examples/plan.json",
  );
  expect(() => prepareRelease(root, "0.1.2")).toThrow("already has a section");
});

test("the check names every unprepared place", () => {
  const root = repository();
  writeFileSync(join(root, "package.json"), '{\n  "version": "0.1.2"\n}\n');
  writeFileSync(join(root, "public-export.json"), JSON.stringify({ source_commit: "main" }));
  expect(checkRelease(root).problems).toEqual([
    "CHANGELOG.md: no entries under ## 0.1.2",
    "distribution/installers/README.md:2: names Rootform 0.1.0, not 0.1.2",
    "docs/installation.md:1: names Rootform 0.1.0, not 0.1.2",
    "docs/installation.md:2: names Rootform 0.1.0, not 0.1.2",
    "docs/installation.md:2: names Rootform 0.1.0, not 0.1.2",
    "docs/installation.md:3: names Rootform 0.1.0, not 0.1.2",
    "docs/integrations/github-actions.md:3: names Rootform 0.1.0, not 0.1.2",
    "README.md:1: documentation download follows dev, not v0.1.2",
    "public-export.json: no exact Engine commit",
  ]);
});
