import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findEnginePathReference,
  goModuleViolation,
  hasExactLine,
  validateExampleDialectLock,
  validateRepository,
} from "./validate-repository.ts";

const root = join(import.meta.dir, "..");

test("current repository respects distribution boundary", () => {
  expect(validateRepository).not.toThrow();
});

test("Go source stays inside the self-contained public CLI module", () => {
  const goMod = "module github.com/rootform-dev/rootform/cli\n\ngo 1.26.0\n\ntoolchain go1.26.7\n";
  expect(goModuleViolation("cli/go.mod", goMod)).toBeNull();
  expect(goModuleViolation("cli/go.sum", "")).toBeNull();
  expect(
    goModuleViolation("cli/form/form.go", 'package form\n\nimport "encoding/json"\n'),
  ).toBeNull();

  expect(goModuleViolation("scripts/tool.go", "package main\n")).toBe(
    "private implementation material is forbidden: scripts/tool.go",
  );
  for (const path of ["go.work", "cli/go.work", "cli/go.work.sum"]) {
    expect(goModuleViolation(path, "")).toBe(`Go workspace files are forbidden: ${path}`);
  }
  expect(goModuleViolation("tools/go.mod", goMod)).toBe(
    "Go module files belong only to cli/: tools/go.mod",
  );
  for (const imported of [
    "github.com/rootform-dev/engine" + "/internal/fictional",
    "github.com/rootform-dev/engine",
    "github.com/rootform-dev/web/apps/renderer",
  ]) {
    expect(goModuleViolation("cli/app.go", `package cli\n\nimport "${imported}"\n`)).toBe(
      "the CLI module imports private source: cli/app.go",
    );
  }
  expect(
    goModuleViolation(
      "cli/app.go",
      'package cli\n\nimport "github.com/rootform-dev/rootform/cli/form"\n',
    ),
  ).toBeNull();
  expect(goModuleViolation("cli/go.mod", goMod.replace("rootform/cli", "rootform/other"))).toBe(
    "cli/go.mod must declare module github.com/rootform-dev/rootform/cli",
  );
  expect(
    goModuleViolation("cli/go.mod", `${goMod}\nreplace github.com/spf13/cobra => ../../cobra\n`),
  ).toBe("cli/go.mod must not replace a module");
  expect(goModuleViolation("cli/go.mod", `${goMod}\nreplace (\n)\n`)).toBe(
    "cli/go.mod must not replace a module",
  );
  expect(goModuleViolation("cli/go.mod", goMod.replace("toolchain go1.26.7\n", ""))).toBe(
    "cli/go.mod must pin an exact toolchain",
  );
});

test("engine path guard rejects private Engine paths in public files", () => {
  for (const body of [
    "packages" + "/renderer/src/fixtures/example.ts",
    "web" + "/src/example.svg",
    "web" + "/fixtures/example.json",
    "engine" + "/testdata/example.json",
    "engine" + "/internal/compiler.go",
    "docs" + "/internal/example.md",
    "prd" + ".md",
    ".fictional" + "-private/example.md",
    ".fictional" + "-internal/example.md",
    "specs" + "/999-fictional-feature/evidence/example.json",
    "docs" + "/adr/999-fictional-decision.md",
    "SPEC" + "-999-fictional-feature.md",
    "ADR" + "-999-fictional-decision.md",
  ]) {
    expect(findEnginePathReference(body)).not.toBeNull();
  }
});

test("engine path guard accepts public Go fixture references", () => {
  for (const body of [
    "Go fixtures live in testdata/example.json.",
    "The CLI module reads cli/testdata/plan.json during tests.",
    "Agent integrations and AI tools use the public spec contracts.",
  ]) {
    expect(findEnginePathReference(body)).toBeNull();
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
