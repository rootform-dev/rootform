import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  cliModulePin,
  type PinnedComponent,
  type PinnedExecutable,
  verifyFrozenPins,
} from "./module-pin.ts";

// Commit times: 2026-09-29 20:25:11 UTC, recorded two hours east of UTC, and
// 2026-09-29 21:00:00 UTC.
const FIRST = "1790713511 +0200";
const FIRST_STAMP = "20260929202511";
const SECOND = "1790715600 +0000";
const SECOND_STAMP = "20260929210000";

const INITIAL = {
  "cli/go.mod": "module github.com/rootform-dev/rootform/cli\n",
  "dialects/aws/dialect.rf.hcl": 'dialect "aws" {}\n',
  "docs/index.md": "first\n",
};

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
});

// executable is the build information of a Go executable built against the
// public CLI module at version. A Go executable carries it twice.
function executable(version: string, replaced = false): Buffer {
  const info =
    "path\tgithub.com/example/cmd/rootform\n" +
    "mod\tgithub.com/example\t(devel)\t\n" +
    `dep\tgithub.com/rootform-dev/rootform/cli\t${version}\th1:AAAA=\n` +
    (replaced ? "=>\t../cli\t(devel)\t\n" : "") +
    "dep\tgithub.com/spf13/cobra\tv1.10.2\th1:BBBB=\n";
  return Buffer.concat([
    Buffer.from([0, 0xff]),
    Buffer.from(info),
    Buffer.from([0]),
    Buffer.from(info),
  ]);
}

function targets(version: string): PinnedExecutable[] {
  return ["rootform_linux_amd64", "rootform_windows_amd64.exe"].map((file) => ({
    body: executable(version),
    file,
  }));
}

function pseudoVersion(stamp: string, commit: string): string {
  return `v0.0.0-${stamp}-${commit.slice(0, 12)}`;
}

function inventory(commit: string): PinnedComponent[] {
  return [
    { kind: "go-module", version: "v1.10.2" },
    { kind: "dialect-bundle", version: commit },
  ];
}

function git(root: string, time: string, arguments_: string[]): string {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: time,
      GIT_AUTHOR_EMAIL: "fixture@example.com",
      GIT_AUTHOR_NAME: "Fixture",
      GIT_COMMITTER_DATE: time,
      GIT_COMMITTER_EMAIL: "fixture@example.com",
      GIT_COMMITTER_NAME: "Fixture",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    },
  });
  if (result.status !== 0) throw new Error(`git ${arguments_.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

// repository is a distribution repository whose commits carry fixed times,
// so the pseudo-version of each commit is known.
function repository(): {
  commit: (time: string, files: Record<string, string>) => string;
  root: string;
} {
  const root = mkdtempSync(join(tmpdir(), "rootform-module-pin-"));
  roots.push(root);
  git(root, FIRST, ["init", "--quiet"]);
  return {
    commit(time, files) {
      for (const [path, body] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), body);
      }
      git(root, time, ["add", "--all"]);
      git(root, time, ["commit", "--quiet", "--no-verify", "--message", "fixture"]);
      return git(root, time, ["rev-parse", "HEAD"]);
    },
    root,
  };
}

describe("public CLI module version of an executable", () => {
  test("reads the one version every copy of the build information records", () => {
    const version = "v0.0.0-20260929202511-298e04448c0d";
    expect(cliModulePin(executable(version), "rootform")).toEqual({
      prefix: "298e04448c0d",
      time: "20260929202511",
      version,
    });
    for (const form of [
      "v1.2.4-0.20260929202511-298e04448c0d",
      "v1.2.3-pre.0.20260929202511-298e04448c0d",
    ]) {
      expect(cliModulePin(executable(form), "rootform")).toMatchObject({
        prefix: "298e04448c0d",
        time: "20260929202511",
      });
    }
  });

  test("refuses a missing, replaced, inconsistent or tagged module", () => {
    const version = "v0.0.0-20260929202511-298e04448c0d";
    expect(() => cliModulePin(Buffer.from("no build information"), "rootform")).toThrow(
      "handoff target does not record one public CLI module version: rootform",
    );
    expect(() => cliModulePin(executable(version, true), "rootform")).toThrow(
      "handoff target replaces the public CLI module: rootform",
    );
    expect(() =>
      cliModulePin(
        Buffer.concat([executable(version), executable("v0.0.0-20260929210000-298e04448c0d")]),
        "rootform",
      ),
    ).toThrow("does not record one public CLI module version");
    expect(() => cliModulePin(executable("v1.0.0"), "rootform")).toThrow(
      "handoff target public CLI module version names no commit: rootform",
    );
  });
});

describe("frozen public CLI module and Dialects", () => {
  test("accepts a pinned commit whose trees the distribution still holds", () => {
    const distribution = repository();
    const pinned = distribution.commit(FIRST, INITIAL);
    distribution.commit(SECOND, { "docs/index.md": "second\n" });
    expect(
      verifyFrozenPins(
        distribution.root,
        targets(pseudoVersion(FIRST_STAMP, pinned)),
        inventory(pinned),
      ),
    ).toBe(pinned);
  });

  test("refuses a module or Dialect change since the pinned commit", () => {
    for (const path of ["cli/go.mod", "dialects/aws/dialect.rf.hcl"]) {
      const distribution = repository();
      const pinned = distribution.commit(FIRST, INITIAL);
      distribution.commit(SECOND, { [path]: "changed\n" });
      expect(() =>
        verifyFrozenPins(
          distribution.root,
          targets(pseudoVersion(FIRST_STAMP, pinned)),
          inventory(pinned),
        ),
      ).toThrow(`cli or dialects changed since the pinned Rootform commit: ${pinned}`);
    }
  });

  test("refuses a pin that names no commit, another time, or a commit outside the history", () => {
    const distribution = repository();
    const pinned = distribution.commit(FIRST, INITIAL);
    expect(() =>
      verifyFrozenPins(
        distribution.root,
        targets(pseudoVersion(SECOND_STAMP, pinned)),
        inventory(pinned),
      ),
    ).toThrow(`does not match the time of ${pinned}`);
    expect(() =>
      verifyFrozenPins(
        distribution.root,
        targets(pseudoVersion(FIRST_STAMP, "0123456789ab")),
        inventory(pinned),
      ),
    ).toThrow("public CLI module version names no commit of this repository");
    const tree = git(distribution.root, SECOND, ["rev-parse", "HEAD^{tree}"]);
    const side = git(distribution.root, SECOND, ["commit-tree", tree, "-p", pinned, "-m", "side"]);
    expect(() =>
      verifyFrozenPins(
        distribution.root,
        targets(pseudoVersion(SECOND_STAMP, side)),
        inventory(side),
      ),
    ).toThrow(`pinned Rootform commit is not an ancestor of the distribution: ${side}`);
  });

  test("refuses targets that disagree and an inventory without the pinned Dialects", () => {
    const distribution = repository();
    const first = distribution.commit(FIRST, INITIAL);
    const second = distribution.commit(SECOND, { "docs/index.md": "second\n" });
    expect(() =>
      verifyFrozenPins(
        distribution.root,
        [
          { body: executable(pseudoVersion(FIRST_STAMP, first)), file: "rootform_linux_amd64" },
          { body: executable(pseudoVersion(SECOND_STAMP, second)), file: "rootform_linux_arm64" },
        ],
        inventory(first),
      ),
    ).toThrow("handoff targets do not record one public CLI module version");
    for (const components of [inventory(second), []]) {
      expect(() =>
        verifyFrozenPins(distribution.root, targets(pseudoVersion(FIRST_STAMP, first)), components),
      ).toThrow("runtime license inventory records no Dialects of the pinned Rootform commit");
    }
  });

  test("accepts another Dialect bundle from an earlier commit with the same Dialects", () => {
    const distribution = repository();
    const first = distribution.commit(FIRST, INITIAL);
    const second = distribution.commit(SECOND, { "docs/index.md": "second\n" });
    expect(
      verifyFrozenPins(distribution.root, targets(pseudoVersion(SECOND_STAMP, second)), [
        ...inventory(second),
        { kind: "dialect-bundle", version: first },
      ]),
    ).toBe(second);
  });

  test("refuses another Dialect bundle the distribution no longer holds", () => {
    const distribution = repository();
    const first = distribution.commit(FIRST, INITIAL);
    const second = distribution.commit(SECOND, { "dialects/aws/dialect.rf.hcl": "changed\n" });
    for (const version of [first, "f".repeat(40), "catalogs"]) {
      expect(() =>
        verifyFrozenPins(distribution.root, targets(pseudoVersion(SECOND_STAMP, second)), [
          ...inventory(second),
          { kind: "dialect-bundle", version },
        ]),
      ).toThrow(
        `runtime license inventory records Dialects the distribution no longer holds: ${version}`,
      );
    }
  });
});
