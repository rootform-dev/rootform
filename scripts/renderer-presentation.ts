const identityPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const resourceKeyPattern = /^(?:resource|data|ephemeral|action)\/[a-z][a-z0-9_-]*$/u;
const semanticKeyPattern =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.(?:rule|concept)\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const sections = [
  "resources",
  "rules",
  "concepts",
  "resource_labels",
  "rule_labels",
  "concept_labels",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateMap(
  value: unknown,
  keyPattern: RegExp,
  valueValidator: (value: string) => boolean,
  label: string,
): void {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  for (const [key, entry] of Object.entries(value)) {
    if (!keyPattern.test(key)) throw new Error(`${label} has invalid key ${key}`);
    if (typeof entry !== "string" || !valueValidator(entry)) {
      throw new Error(`${label} has invalid value for ${key}`);
    }
  }
}

function validLabel(value: string): boolean {
  return (
    value !== "" && value.trim() === value && new TextEncoder().encode(value).byteLength <= 256
  );
}

export function validateRendererPresentation(value: unknown, label: string): void {
  if (!isRecord(value)) throw new Error(`${label}: presentation must be an object`);
  if (value.format_version !== "1") throw new Error(`${label}: unknown presentation format`);
  const allowed = new Set<string>(["format_version", ...sections]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error(`${label}: presentation has unknown fields`);
  }
  for (const section of sections) {
    const keyPattern =
      section === "resources" || section === "resource_labels"
        ? resourceKeyPattern
        : section === "rules" || section === "concepts"
          ? semanticKeyPattern
          : semanticKeyPattern;
    const valueValidator = section.endsWith("labels")
      ? validLabel
      : (entry: string) => identityPattern.test(entry);
    validateMap(value[section], keyPattern, valueValidator, `${label}: ${section}`);
  }
}

export function buildRendererPresentation(root: string): string {
  const inventory = JSON.parse(readFileSync(join(root, "dialects/dialects.json"), "utf8")) as {
    dialects: Array<{ name: string }>;
  };
  const catalog: Record<string, string | Record<string, string>> = { format_version: "1" };
  for (const section of sections) catalog[section] = {};
  for (const { name } of inventory.dialects) {
    const manifest = JSON.parse(
      readFileSync(join(root, "dialects", name, "presentation.json"), "utf8"),
    ) as Record<string, Record<string, string>>;
    for (const section of sections) {
      const target = catalog[section] as Record<string, string>;
      for (const [key, value] of Object.entries(manifest[section] ?? {})) {
        const qualified =
          section === "rules" || section === "rule_labels"
            ? `${name}.rule.${key}`
            : section === "concepts" || section === "concept_labels"
              ? `${name}.concept.${key}`
              : key;
        if (target[qualified] !== undefined && target[qualified] !== value) {
          throw new Error(`Conflicting presentation identity: ${qualified}`);
        }
        target[qualified] = value;
      }
    }
  }
  const concepts = catalog.concepts as Record<string, string>;
  const labels = catalog.concept_labels as Record<string, string>;
  for (const [name, identity, label] of [
    ["kubernetes-cluster", "kubernetes/cluster", "Kubernetes cluster"],
    ["managed-database", "generic/database", "Managed database"],
    ["object-storage-container", "generic/storage", "Object storage container"],
    ["service-identity", "generic/identity", "Service identity"],
    ["subnet", "generic/subnet", "Subnet"],
    ["virtual-network", "generic/network", "Virtual network"],
  ] as const) {
    concepts[`rf.concept.${name}`] = identity;
    labels[`rf.concept.${name}`] = label;
  }
  for (const section of sections) {
    const values = catalog[section] as Record<string, string>;
    catalog[section] = Object.fromEntries(
      Object.entries(values).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }
  validateRendererPresentation(catalog, "merged catalog");
  return `${JSON.stringify(catalog)}\n`;
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
