import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "./digest.ts";

export const BINARY_LICENSE_FILE = "ROOTFORM-BINARY-LICENSE.txt";
export const BINARY_LICENSE_SPDX = "Elastic-2.0";
export const CANONICAL_ELASTIC_LICENSE_SHA256 =
  "48255018b41fc0e965b1115af7e6779bc218bb8a6747d561da800d5022622aa2";

const applicationNotice = `Rootform Binary License Notice
==============================

Copyright 2026 Thierno Bah. All rights reserved.

Licensor: Thierno Bah
Software: Rootform executable code distributed in an official Rootform release
archive that contains this notice.
SPDX-License-Identifier: Elastic-2.0

Elastic License 2.0 applies only to Software owned or licensable by the
Licensor. It does not supersede terms for Rootform Dialects, third-party
components, or assets identified in THIRD_PARTY_NOTICES.txt.

`;

const canonicalStart =
  "Elastic License 2.0\n\nURL: https://www.elastic.co/licensing/elastic-license\n";

export function validateBinaryLicense(body: Uint8Array): void {
  const text = Buffer.from(body).toString("utf8");
  if (!text.startsWith(applicationNotice)) {
    throw new Error("binary license application notice drifted");
  }
  const canonical = text.slice(applicationNotice.length);
  if (!canonical.startsWith(canonicalStart)) {
    throw new Error("binary license canonical terms are missing");
  }
  if (sha256(Buffer.from(canonical)) !== CANONICAL_ELASTIC_LICENSE_SHA256) {
    throw new Error("binary license canonical terms drifted");
  }
}

export function readBinaryLicense(root: string): Buffer {
  const body = readFileSync(join(root, "LICENSES", BINARY_LICENSE_FILE));
  validateBinaryLicense(body);
  return body;
}
