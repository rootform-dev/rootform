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
