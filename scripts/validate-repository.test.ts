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
  const dialectPin = JSON.parse(
    readFileSync(join(root, "dependencies", "dialects.json"), "utf8"),
  ) as { commit: string };
  const provenance = JSON.parse(exportManifest) as { source_commit: string };
  expect(
    findEnginePathReference(
      JSON.stringify({
        inputs: {
          dialects: { commit: dialectPin.commit, repository: "rootform-dev/dialects" },
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

test("example dialect contract matches its generated lock", () => {
  const directory = mkdtempSync(join(tmpdir(), "rootform-distribution-example-"));
  try {
    writeFileSync(join(directory, "example.json"), '{"dialects":["core","google"]}\n');
    writeFileSync(
      join(directory, "rootform.lock"),
      '{"format_version":"1","unsupported_providers":[],"entries":[{"name":"core","version":"0.1.0"},{"name":"google","version":"0.1.0"}]}\n',
    );
    expect(() => validateExampleDialectLock(directory, "fixture")).not.toThrow();

    writeFileSync(join(directory, "example.json"), '{"dialects":["core"]}\n');
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture dialect contract does not match rootform.lock",
    );

    writeFileSync(join(directory, "example.json"), '{"dialects":["core","google"]}\n');
    writeFileSync(
      join(directory, "rootform.lock"),
      '{"format_version":"unsupported","unsupported_providers":[],"entries":[{"name":"core","version":"0.1.0"},{"name":"google","version":"0.1.0"}]}\n',
    );
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock has invalid structure",
    );

    writeFileSync(
      join(directory, "rootform.lock"),
      '{"format_version":"1","entries":[{"name":"core","version":"0.1.0"},{"name":"google","version":"0.1.0"}]}\n',
    );
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock has invalid structure",
    );

    writeFileSync(
      join(directory, "rootform.lock"),
      '{"format_version":"1","unsupported_providers":[],"entries":[{"name":"core"},{"name":"google","version":"0.1.0"}]}\n',
    );
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock has invalid structure",
    );

    writeFileSync(
      join(directory, "rootform.lock"),
      '{"format_version":"1","unsupported_providers":[],"entries":[{"name":"core","version":"latest"},{"name":"google","version":"0.1.0"}]}\n',
    );
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock has invalid structure",
    );

    writeFileSync(
      join(directory, "rootform.lock"),
      '{"format_version":"1","unsupported_providers":[],"entries":[{"name":"core","version":"00.1.0"},{"name":"google","version":"0.1.0"}]}\n',
    );
    expect(() => validateExampleDialectLock(directory, "fixture")).toThrow(
      "fixture rootform.lock has invalid structure",
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
