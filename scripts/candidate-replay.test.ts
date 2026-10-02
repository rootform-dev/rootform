import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { releaseAssetNames } from "./release/contract.ts";
import { checksumFile, sha256 } from "./release/digest.ts";

const workflow = Bun.YAML.parse(
  readFileSync(join(import.meta.dir, "..", ".github/workflows/candidate.yml"), "utf8"),
) as {
  jobs: { platforms: { steps: { name?: string; run?: string }[] } };
};
const download = workflow.jobs.platforms.steps.find(
  (step) => step.name === "Download and verify exact existing draft assets",
)?.run;
if (!download) throw new Error("draft replay download is missing");

test("draft replay verifies exact release assets without native TSV parsing", () => {
  const temporary = mkdtempSync(join(tmpdir(), "rootform-replay-"));
  try {
    const tools = join(temporary, "tools");
    const fixture = join(temporary, "fixture");
    mkdirSync(tools);
    mkdirSync(fixture);
    cpSync(join(import.meta.dir, "release"), join(temporary, "scripts/release"), {
      recursive: true,
    });
    const version = "0.1.0-pr.117.1";
    const commit = "a".repeat(40);
    const files = releaseAssetNames(version)
      .filter((name) => name !== "SHA256SUMS")
      .map((name) => ({
        name,
        body: name.endsWith("_manifest.json")
          ? JSON.stringify({ product: { version }, distribution: { commit } })
          : `synthetic ${name}\n`,
      }));
    files.push({ name: "SHA256SUMS", body: checksumFile(files) });
    const assets = files.map((file, index) => {
      const id = index + 1;
      writeFileSync(join(fixture, String(id)), file.body);
      return {
        id,
        name: file.name,
        size: Buffer.byteLength(file.body),
        digest: `sha256:${sha256(file.body)}`,
      };
    });
    writeFileSync(
      join(fixture, "release.json"),
      JSON.stringify({
        id: 123,
        draft: true,
        prerelease: true,
        tag_name: `v${version}`,
        target_commitish: commit,
        assets,
      }),
    );
    writeFileSync(
      join(tools, "gh"),
      '#!/bin/bash\nif [ "$1" = api ]; then cat "$ROOTFORM_REPLAY_FIXTURE/release.json"; else for asset in "$ROOTFORM_REPLAY_FIXTURE/assets/"*; do cp "$asset" build/release/; done; fi\n',
      { mode: 0o755 },
    );
    mkdirSync(join(fixture, "assets"));
    for (const file of files) writeFileSync(join(fixture, "assets", file.name), file.body);
    const env = {
      PATH: `${tools}:${process.env.PATH}`,
      ROOTFORM_REPLAY_FIXTURE: fixture,
      RELEASE_ID: "123",
      ROOTFORM_VERSION: version,
      GITHUB_REPOSITORY: "rootform-dev/rootform",
    };
    const run = (script: string) =>
      Bun.spawnSync(["/bin/bash", "-c", script], {
        cwd: temporary,
        env,
        stdout: "pipe",
        stderr: "pipe",
        timeout: 10000,
      });
    const fixed = run(download);
    expect(fixed.stderr.toString()).toBe("");
    expect(fixed.exitCode).toBe(0);
    for (const file of files)
      expect(readFileSync(join(temporary, "build/release", file.name), "utf8")).toBe(file.body);
    rmSync(join(temporary, "build"), { recursive: true });
    writeFileSync(join(fixture, "assets", "ROOTFORM-BINARY-LICENSE.txt"), "corrupt");
    const corrupted = run(download);
    expect(corrupted.exitCode).not.toBe(0);
    expect(corrupted.stderr.toString()).toContain("draft asset digest drifted");
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
});
