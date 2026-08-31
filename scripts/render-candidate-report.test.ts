import { expect, test } from "bun:test";
import { checksumFile, sha256 } from "./release/digest.ts";
import {
  type CandidateEvidence,
  DISTRIBUTION_EVIDENCE_MARKER,
  renderCandidateEvidence,
} from "./render-candidate-report.ts";

const digest = (character: string): string => character.repeat(64);
const commit = (character: string): string => character.repeat(40);

function evidence(): CandidateEvidence {
  const artifacts = [
    ["darwin", "amd64", "tar.gz", "1"],
    ["darwin", "arm64", "tar.gz", "2"],
    ["linux", "amd64", "tar.gz", "3"],
    ["linux", "arm64", "tar.gz", "4"],
    ["windows", "amd64", "zip", "5"],
  ].map(([operatingSystem, architecture, format, character]) => ({
    architecture: architecture as string,
    asset: `rootform_0.1.0-pr.39.1_${operatingSystem}_${architecture}.${format}`,
    bytes: 32 * 1024 * 1024,
    operatingSystem: operatingSystem as string,
    rawSha256: digest(character as string),
    sha256: sha256(`archive-${character}`),
  }));
  return {
    artifacts,
    checksums: checksumFile([
      ...artifacts.map(({ asset }, index) => ({ body: `archive-${index + 1}`, name: asset })),
      { body: "license", name: "ROOTFORM-BINARY-LICENSE.txt" },
      { body: "notices", name: "THIRD_PARTY_NOTICES.txt" },
      { body: "manifest", name: "rootform_0.1.0-pr.39.1_manifest.json" },
      { body: "sbom", name: "rootform_0.1.0-pr.39.1_sbom.spdx.json" },
    ]),
    componentCount: 83,
    dialectCommit: commit("a"),
    distributionCommit: commit("b"),
    handoffSha256: digest("c"),
    licenseSpdx: "Elastic-2.0",
    releaseUrl: "https://github.com/rootform-dev/rootform/releases/tag/v0.1.0-pr.39.1",
    runUrl: "https://github.com/rootform-dev/rootform/actions/runs/12",
    version: "0.1.0-pr.39.1",
  };
}

test("renders public-safe deterministic candidate evidence", () => {
  const first = renderCandidateEvidence(evidence());
  const second = renderCandidateEvidence(evidence());
  expect(first).toBe(second);
  expect(first.startsWith(DISTRIBUTION_EVIDENCE_MARKER)).toBe(true);
  expect(first).toContain("handoff:cccccccccccc → rootform:bbbbbbbbbbbb → draft:v0.1.0-pr.39.1");
  expect(first).toContain("5/5 target archives · 83 licensed components · Elastic-2.0");
  expect(first).toContain(
    `| windows / amd64 | 32.0 MiB | \`555555555555\` | \`${sha256("archive-5").slice(0, 12)}\` |`,
  );
  expect(first).not.toContain("rootform-dev/engine");
  expect(first).not.toContain(["/Users", "/"].join(""));
});

test("rejects license, checksum, and URL drift", () => {
  const license = evidence();
  license.licenseSpdx = "Apache-2.0";
  expect(() => renderCandidateEvidence(license)).toThrow("binary license is invalid");

  const checksum = evidence();
  const first = checksum.artifacts[0];
  if (!first) throw new Error("fixture has no artifact");
  first.sha256 = digest("f");
  expect(() => renderCandidateEvidence(checksum)).toThrow("release checksum drifted");

  const url = evidence();
  url.releaseUrl = "https://example.test/release";
  expect(() => renderCandidateEvidence(url)).toThrow(
    "draft release URL must be an authenticated GitHub URL",
  );
});
