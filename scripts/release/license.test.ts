import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BINARY_LICENSE_FILE, BINARY_LICENSE_SPDX, validateBinaryLicense } from "./license.ts";

const root = join(import.meta.dir, "..", "..");
const license = readFileSync(join(root, "dependencies", BINARY_LICENSE_FILE));

describe("Rootform binary license", () => {
  test("binds exact application notice to canonical Elastic License 2.0", () => {
    expect(BINARY_LICENSE_SPDX).toBe("Elastic-2.0");
    expect(() => validateBinaryLicense(license)).not.toThrow();
  });

  test("rejects application, identifier, and canonical-term drift", () => {
    const replacements: Array<[string, string]> = [
      ["Licensor: Thierno Bah", "Licensor: Other"],
      ["SPDX-License-Identifier: Elastic-2.0", "SPDX-License-Identifier: Apache-2.0"],
      ["non-exclusive, royalty-free", "exclusive, royalty-free"],
    ];
    for (const [from, to] of replacements) {
      const drifted = Buffer.from(license.toString("utf8").replace(from, to));
      expect(() => validateBinaryLicense(drifted)).toThrow("drifted");
    }
  });
});
