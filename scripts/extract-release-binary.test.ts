import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractReleaseBinary, parseExtractArguments } from "./extract-release-binary.ts";
import { createTarGz } from "./release/archive.ts";
import { RELEASE_TARGETS, releaseAssetName } from "./release/contract.ts";
import { checksumFile } from "./release/digest.ts";

const version = "0.1.0-dev.2";
const target = RELEASE_TARGETS[0] as (typeof RELEASE_TARGETS)[number];

function releaseArchive(extra = false, driftChecksums = false): Buffer {
  const entries = [
    { body: Buffer.from("binary bytes"), mode: 0o755 as const, name: target.executable },
    { body: Buffer.from("license"), mode: 0o644 as const, name: "ROOTFORM-BINARY-LICENSE.txt" },
    { body: Buffer.from("notices"), mode: 0o644 as const, name: "THIRD_PARTY_NOTICES.txt" },
    {
      body: Buffer.from("sbom"),
      mode: 0o644 as const,
      name: `rootform_${version}_sbom.spdx.json`,
    },
    ...(extra ? [{ body: Buffer.from("extra"), mode: 0o644 as const, name: "extra.txt" }] : []),
  ];
  const checksums = checksumFile(entries);
  const driftedChecksums = `${checksums[0] === "0" ? "1" : "0"}${checksums.slice(1)}`;
  return createTarGz([
    ...entries,
    {
      body: Buffer.from(driftChecksums ? driftedChecksums : checksums),
      mode: 0o644,
      name: "SHA256SUMS",
    },
  ]);
}

test("extracts exact executable from canonical final archive", () => {
  const parent = mkdtempSync(join(tmpdir(), "rootform-release-extract-"));
  const output = join(parent, "bin", "rootform");
  try {
    writeFileSync(join(parent, releaseAssetName(version, target)), releaseArchive());
    extractReleaseBinary({ output, release: parent, target: "linux-amd64", version });
    expect(readFileSync(output)).toEqual(Buffer.from("binary bytes"));
  } finally {
    rmSync(parent, { force: true, recursive: true });
  }
});

test("rejects extra entries and checksum drift", () => {
  for (const archive of [releaseArchive(true), releaseArchive(false, true)]) {
    const parent = mkdtempSync(join(tmpdir(), "rootform-release-extract-"));
    try {
      writeFileSync(join(parent, releaseAssetName(version, target)), archive);
      expect(() =>
        extractReleaseBinary({
          output: join(parent, "rootform"),
          release: parent,
          target: "linux-amd64",
          version,
        }),
      ).toThrow();
    } finally {
      rmSync(parent, { force: true, recursive: true });
    }
  }
});

test("release extraction CLI requires exact explicit inputs", () => {
  expect(
    parseExtractArguments(
      [
        `--version=${version}`,
        "--release=release",
        "--target=linux-amd64",
        "--output=bin/rootform",
      ],
      "/workspace",
    ),
  ).toEqual({
    output: "/workspace/bin/rootform",
    release: "/workspace/release",
    target: "linux-amd64",
    version,
  });
  expect(() => parseExtractArguments([`--version=${version}`])).toThrow("--release is required");
});
