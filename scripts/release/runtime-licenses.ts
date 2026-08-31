import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "./digest.ts";

export type RuntimeComponent = {
  copyright_text: string;
  extracted_text?: string;
  kind: "asset" | "dialect-bundle" | "go-module" | "go-runtime" | "vendored-source" | "web-package";
  license_concluded: string;
  license_declared: string;
  license_text_sha256: string;
  name: string;
  notice_text_sha256?: string;
  upstream: string;
  version: string;
};

export type RuntimeLicensing = {
  componentCount: number;
  components: RuntimeComponent[];
  inventory: Buffer;
  inventorySha256: string;
  notices: Buffer;
};

const digest = /^[0-9a-f]{64}$/u;
const expression =
  /^(?:[A-Za-z0-9.-]+|LicenseRef-[A-Za-z0-9.-]+)(?: (?:AND|OR) (?:[A-Za-z0-9.-]+|LicenseRef-[A-Za-z0-9.-]+))*$/u;

function exactKeys(value: RuntimeComponent): boolean {
  const optional = [
    ...(value.extracted_text === undefined ? [] : ["extracted_text"]),
    ...(value.notice_text_sha256 === undefined ? [] : ["notice_text_sha256"]),
  ];
  const expected = [
    "copyright_text",
    ...optional,
    "kind",
    "license_concluded",
    "license_declared",
    "license_text_sha256",
    "name",
    "upstream",
    "version",
  ].sort((left, right) => left.localeCompare(right, "en"));
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function occurrences(text: string, marker: string): number {
  return text.split(marker).length - 1;
}

function enclosedText(text: string, begin: string, end: string): string {
  if (occurrences(text, begin) !== 1 || occurrences(text, end) !== 1) {
    throw new Error(`third-party notice marker drifted: ${begin.trim()}`);
  }
  const start = text.indexOf(begin) + begin.length;
  const finish = text.indexOf(end, start);
  if (finish < start) throw new Error(`third-party notice marker order drifted: ${begin.trim()}`);
  return text.slice(start, finish);
}

export function validateRuntimeLicensing(inventory: Buffer, notices: Buffer): RuntimeLicensing {
  const inventoryText = inventory.toString("utf8");
  if (!inventoryText.endsWith("\n")) throw new Error("runtime inventory must end with newline");
  let parsed: unknown;
  try {
    parsed = JSON.parse(inventoryText);
  } catch {
    throw new Error("runtime inventory is invalid JSON");
  }
  if (`${JSON.stringify(parsed, null, 2)}\n` !== inventoryText) {
    throw new Error("runtime inventory JSON is not canonical");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("runtime inventory must be an object");
  }
  const document = parsed as { components?: unknown; format_version?: unknown };
  if (document.format_version !== "1" || !Array.isArray(document.components)) {
    throw new Error("runtime inventory has invalid structure");
  }
  const components = document.components as RuntimeComponent[];
  if (components.length === 0) throw new Error("runtime inventory is empty");
  const noticesText = notices.toString("utf8");
  if (!noticesText.endsWith("\n")) throw new Error("third-party notices must end with newline");
  const keys: string[] = [];
  for (const component of components) {
    const key = `${component.kind}:${component.name}@${component.version}`;
    const usesLicenseRef =
      component.license_declared?.includes("LicenseRef-") ||
      component.license_concluded?.includes("LicenseRef-");
    if (
      !exactKeys(component) ||
      ![
        "asset",
        "dialect-bundle",
        "go-module",
        "go-runtime",
        "vendored-source",
        "web-package",
      ].includes(component.kind) ||
      !component.name ||
      !component.version ||
      !component.copyright_text ||
      !expression.test(component.license_declared) ||
      !expression.test(component.license_concluded) ||
      !digest.test(component.license_text_sha256) ||
      (component.notice_text_sha256 !== undefined && !digest.test(component.notice_text_sha256)) ||
      !/^https:\/\//u.test(component.upstream) ||
      usesLicenseRef !==
        (typeof component.extracted_text === "string" && component.extracted_text.length > 0) ||
      keys.includes(key)
    ) {
      throw new Error(`invalid runtime component: ${key}`);
    }
    const identity = `${component.name}@${component.version}`;
    const licenseText = enclosedText(
      noticesText,
      `----- BEGIN LICENSE TEXT: ${identity} -----\n`,
      `----- END LICENSE TEXT: ${identity} -----`,
    );
    if (sha256(Buffer.from(licenseText)) !== component.license_text_sha256) {
      throw new Error(`runtime license text digest drifted: ${identity}`);
    }
    if (component.notice_text_sha256) {
      const noticeText = enclosedText(
        noticesText,
        `----- BEGIN NOTICE TEXT: ${identity} -----\n`,
        `----- END NOTICE TEXT: ${identity} -----`,
      );
      if (sha256(Buffer.from(noticeText)) !== component.notice_text_sha256) {
        throw new Error(`runtime notice text digest drifted: ${identity}`);
      }
    }
    keys.push(key);
  }
  const canonical = [...keys].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(keys) !== JSON.stringify(canonical)) {
    throw new Error("runtime component inventory is not canonical");
  }
  if (occurrences(noticesText, "----- BEGIN LICENSE TEXT:") !== components.length) {
    throw new Error("third-party notice component count drifted");
  }
  return {
    componentCount: components.length,
    components,
    inventory,
    inventorySha256: sha256(inventory),
    notices,
  };
}

export function readRuntimeLicensing(root: string): RuntimeLicensing {
  return validateRuntimeLicensing(
    readFileSync(join(root, "dependencies", "runtime-components.json")),
    readFileSync(join(root, "THIRD_PARTY_NOTICES.txt")),
  );
}
