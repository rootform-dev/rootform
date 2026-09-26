import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findEnginePathReference,
  hasExactLine,
  validateExampleDialectLock,
  validateRepository,
} from "./validate-repository.ts";

const root = join(import.meta.dir, "..");

test("current repository respects distribution boundary", () => {
  expect(validateRepository).not.toThrow();
});

test("engine path guard rejects private Engine paths in public files", () => {
  for (const body of [
    "packages/renderer/src/fixtures/generated-real-fixtures.ts",
    "web/src/lib/architecture-icons/assets/icon.svg",
    "web/fixtures/ir/generated.json",
    "testdata/plan/sample.json",
    "docs/internal/adr-004.md",
    "prd.md",
    ".ai-private",
    "specs/059-google-cloud-dialect-v8/evidence/coverage-matrix.json",
    "docs/adr/002-observability-ownership.md",
    "SPEC-059-google-cloud-dialect-v8.md",
    "ADR-007-runtime-ownership.md",
  ]) {
    expect(findEnginePathReference(body)).not.toBeNull();
  }
});

test("engine path guard keeps legitimate public provenance and handoff contracts", () => {
  const exportManifest = readFileSync(join(root, "public-export.json"), "utf8");
  expect(findEnginePathReference(exportManifest)).toBeNull();
  const provenance = JSON.parse(exportManifest) as { source_commit: string };
  expect(
    findEnginePathReference(
      JSON.stringify({
        release_set: {
          format_version: "1",
          rf_language: { contract_sha256: "a".repeat(64), version: "0.1.0" },
          units: [
            {
              content_digest: "b".repeat(64),
              kind: "vocabulary",
              owner: "rf",
              semantic_digest: "c".repeat(64),
              version: "0.1.0",
            },
          ],
          version: "0.1.0",
        },
        source: { commit: provenance.source_commit, repository: "rootform-dev/engine" },
      }),
    ),
  ).toBeNull();
  const handoffContract = readFileSync(join(root, "contracts", "binary-handoff.md"), "utf8");
  expect(findEnginePathReference(handoffContract)).toBeNull();
});

test("workflow URL controls require one exact line", () => {
  const expected =
    "              'https://github.com/orgs/rootform-dev/packages/container/policy-packs/settings' >&2";
  expect(hasExactLine(expected, expected)).toBeTrue();
  expect(
    hasExactLine(
      "              'https://github.com.evil.example/orgs/rootform-dev/packages/container/policy-packs/settings' >&2",
      expected,
    ),
  ).toBeFalse();
  expect(hasExactLine(`${expected}.evil.example`, expected)).toBeFalse();
});

test("example dialect lock follows format-1 selection", () => {
  const directory = mkdtempSync(join(tmpdir(), "rootform-distribution-example-"));
  try {
    writeFileSync(
      join(directory, "rootform.lock"),
      '{"format_version":"1","dialects":[],"policy_packs":[],"excluded_owners":[],"replacements":[]}\n',
    );
    expect(() => validateExampleDialectLock(directory, "fixture")).not.toThrow();

    writeFileSync(join(directory, "rootform.lock"), '{"format_version":"1"}\n');
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock dialects must be an array",
    );

    writeFileSync(join(directory, "rootform.lock"), '{"format_version":"1","entries":[]}\n');
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock has invalid structure",
    );

    writeFileSync(
      join(directory, "rootform.lock"),
      '{"format_version":"1","unsupported_providers":[]}\n',
    );
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock has invalid structure",
    );

    writeFileSync(join(directory, "rootform.lock"), '{"format_version":"unsupported"}\n');
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock has invalid structure",
    );

    writeFileSync(join(directory, "rootform.lock"), '{"format_version":"1","dialects":{}}\n');
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock dialects must be an array",
    );

    writeFileSync(
      join(directory, "rootform.lock"),
      '{"format_version":"1","dialects":[],"policy_packs":[],"excluded_owners":[],"replacements":"rf"}\n',
    );
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock replacements must be an array",
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
