import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyPlaygroundForms } from "./playground-forms.ts";

const root = resolve(import.meta.dir, "..");
const fixtures = join(root, "examples/playground/forms");
const recordedVersion = JSON.parse(readFileSync(join(fixtures, "manifest.json"), "utf8")).binary
  .version as string;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

function executable(directory: string, version: string, drift = false): string {
  const binary = join(directory, drift ? "drifting" : "other-target");
  writeFileSync(
    binary,
    `#!/bin/sh
set -eu
if [ "$1" = version ]; then
  printf '%s\\n' ${quote(version)}
  exit 0
fi
last=""
for arg in "$@"; do last="$arg"; done
cat ${quote(fixtures)}/"$(basename "$last")" > "$last"
${drift ? 'printf "\\n" >> "$last"' : ""}
`,
  );
  chmodSync(binary, 0o755);
  return binary;
}

test("another binary of the recorded version must reproduce every pinned visual byte", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "playground-forms-binary-"));
  try {
    const binary = executable(scratch, recordedVersion);
    expect(await verifyPlaygroundForms(binary, root)).toHaveLength(3);
    await expect(
      verifyPlaygroundForms(executable(scratch, recordedVersion, true), root),
    ).rejects.toThrow("binary output changed");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("a different generator version cannot validate the recorded visual outputs", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "playground-forms-version-"));
  try {
    await expect(
      verifyPlaygroundForms(executable(scratch, "rootform 0.0.0"), root),
    ).rejects.toThrow("binary version mismatch");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
