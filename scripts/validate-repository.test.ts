import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateExampleDialectLock, validateRepository } from "./validate-repository.ts";

test("current repository respects distribution boundary", () => {
  expect(validateRepository).not.toThrow();
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
      '{"format_version":"2","unsupported_providers":[],"entries":[{"name":"core","version":"0.1.0"},{"name":"google","version":"0.1.0"}]}\n',
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
