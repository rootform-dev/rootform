#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { type PlanFixtureInventory, planFixtureInventoryProblems } from "./plan-fixtures.ts";

type Inventory = {
  format_version: string;
  dialects: Array<{ name: string; version: string }>;
};

const root = join(import.meta.dir, "../../dialects");
const forbiddenPath = /(?:^|\/)(?:\.ai-private|docs\/internal|prd\.md|node_modules)(?:\/|$)/u;
const forbiddenText =
  /(?:\/Users\/|\/home\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\|BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY|github_pat_|ghp_)/u;
const privateImplementationReference =
  /(?:^|[/ "'`])(?:specs\/[0-9]{3}-|testdata\/architecture\/|docs\/adr\/[0-9]{3}-|packages\/renderer\/|web\/src\/)|\b(?:SPEC|ADR)-[0-9]{3}\b|\baccepted_adr\b/u;
const qualifiedRuleReference =
  /(?<![A-Za-z0-9_.-])([a-z][a-z0-9]*(?:-[a-z0-9]+)*[.]rule[.][a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?![A-Za-z0-9_.-])/gu;
// prior_rule_id records the pre-migration identity of an audited Rule. Audits
// with disposition removed or corrected intentionally reference ids that no
// longer exist; the field is provenance, not a live semantic reference.
const evidenceNames = new Set([
  "coverage-matrix.json",
  "coverage-summary.json",
  "icon-license-spike.md",
  "provider-baseline.json",
  "provider-boundaries-spike.md",
  "provider-compatibility.json",
  "provider-registry-equivalence.json",
  "provider-source-inventory.json",
  "provider-surfaces-spike.md",
  "plan-fixture-inventory.json",
  "rf-vocabulary-bindings.json",
  "rule-audit.json",
  "scenarios.json",
  "semantic-catalog.json",
  "service-catalog.json",
  "terminology.json",
]);

export function filesBelow(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    if ([".git", "artifacts", "build", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    const name = relative(root, path).replaceAll("\\", "/");
    if (entry.isSymbolicLink()) throw new Error(`symbolic link is forbidden: ${name}`);
    if (entry.isDirectory()) files.push(...filesBelow(path));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`irregular filesystem entry is forbidden: ${name}`);
  }
  return files;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasPrivateImplementationReference(body: string): boolean {
  return privateImplementationReference.test(body);
}

function validatePublicEvidenceReferences(value: unknown, source: string): void {
  if (typeof value === "string") {
    if (!value.startsWith("evidence/") && !value.startsWith("fixtures/")) return;
    const target = value.split("#", 1)[0] ?? "";
    if (!target || !existsSync(join(root, target))) {
      throw new Error(`public evidence reference is missing: ${source}: ${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) validatePublicEvidenceReferences(entry, source);
    return;
  }
  if (isRecord(value)) {
    for (const entry of Object.values(value)) validatePublicEvidenceReferences(entry, source);
  }
}

export function validateLock(value: unknown): void {
  if (!isRecord(value)) throw new Error("rootform.lock must be an object");
  const expectedKeys = [
    "dialects",
    "excluded_owners",
    "format_version",
    "policy_packs",
    "replacements",
  ];
  if (Object.keys(value).sort().join("\n") !== expectedKeys.join("\n")) {
    throw new Error("rootform.lock must contain only project selection fields");
  }
  const lock = value as Record<string, unknown>;
  if (lock.format_version !== "1") {
    throw new Error("rootform.lock must use format version 1");
  }
  for (const field of ["dialects", "policy_packs", "excluded_owners", "replacements"]) {
    if (!Array.isArray(lock[field]) || lock[field].length !== 0) {
      throw new Error(`rootform.lock ${field} must be an empty selection`);
    }
  }
}

type RfBlock = { kind: "concept" | "rule"; name: string; text: string };

type ContractBlock = {
  kind: string;
  name: string;
  line: number;
  parent?: ContractBlock;
  fields: Map<string, { value: string; line: number; justification: boolean }>;
  children: ContractBlock[];
};

// Official source uses one block opener or closer per line. Keep this check
// small and independent of the compiler so repository review catches omitted
// outcome declarations and undocumented external disclosure early.
export function validateDialectContract(text: string, path: string): ContractBlock[] {
  const lines = text.split("\n");
  const roots: ContractBlock[] = [];
  const stack: ContractBlock[] = [];
  let comment = "";
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      comment = trimmed.slice(1).trim();
      continue;
    }
    if (trimmed === "") continue;
    const opener = /^(\w+)(?:\s+"([^"]+)")?\s*\{$/u.exec(trimmed);
    if (opener) {
      const parent = stack.at(-1);
      const block: ContractBlock = {
        kind: opener[1] ?? "",
        name: opener[2] ?? "",
        line: index + 1,
        parent,
        fields: new Map(),
        children: [],
      };
      if (parent) parent.children.push(block);
      else roots.push(block);
      stack.push(block);
      comment = "";
      continue;
    }
    if (trimmed === "}") {
      if (!stack.pop()) throw new Error(`unexpected block close: ${path}:${index + 1}`);
      comment = "";
      continue;
    }
    const assignment = /^([a-z_]+)\s*=\s*(.*?)\s*$/u.exec(trimmed);
    if (assignment && stack.length > 0) {
      stack.at(-1)?.fields.set(assignment[1] ?? "", {
        value: assignment[2] ?? "",
        line: index + 1,
        justification: comment.length >= 20,
      });
    }
    comment = "";
  }
  if (stack.length > 0) throw new Error(`unclosed block: ${path}:${stack.at(-1)?.line}`);

  const all: ContractBlock[] = [];
  const visit = (block: ContractBlock): void => {
    all.push(block);
    for (const child of block.children) visit(child);
  };
  for (const block of roots) visit(block);
  for (const block of all) {
    if (!["contribution", "relation", "context"].includes(block.kind) || !block.fields.has("via"))
      continue;
    for (const key of ["on_null", "on_empty"]) {
      const value = block.fields.get(key)?.value;
      if (value !== '"absent"' && value !== '"indeterminate"') {
        throw new Error(`${path}:${block.line}: emission ${key} must be explicit`);
      }
    }
    const external = block.fields.get("external");
    const disclose = block.fields.get("disclose");
    if (external && external.value !== '"allow"' && external.value !== '"deny"') {
      throw new Error(`${path}:${external.line}: invalid external policy`);
    }
    if (external?.value === '"allow"' && !external.justification) {
      throw new Error(`${path}:${external.line}: external allow needs a justification comment`);
    }
    if (disclose) {
      if (external?.value !== '"allow"') {
        throw new Error(`${path}:${disclose.line}: disclose requires external allow`);
      }
      if (!['"none"', '"record"', '"report"'].includes(disclose.value)) {
        throw new Error(`${path}:${disclose.line}: invalid disclosure tier`);
      }
      if (disclose.value !== '"none"' && !disclose.justification) {
        throw new Error(`${path}:${disclose.line}: disclosure needs a justification comment`);
      }
    }
  }
  return all;
}

// Every emission target rule declares identity and endpoint attributes: a
// candidate whose type lacks the match attribute is compared on its identity
// attributes, and a traversal pairs only with a declared endpoint attribute.
function validateTargetContracts(inventory: Inventory): void {
  // A concept of the shared rf vocabulary is interpreted by rules of several
  // Dialects, so one Dialect cannot declare its identity alone. The official
  // set must still declare every attribute an emission matches such a
  // concept by.
  const sharedIdentity = new Map<string, Set<string>>();
  const sharedMatches: { path: string; line: number; concept: string; by: string }[] = [];
  for (const { name } of inventory.dialects) {
    const located = filesBelow(join(root, name))
      .filter((path) => path.endsWith(".rf.hcl"))
      .flatMap((path) =>
        validateDialectContract(readFileSync(join(root, path), "utf8"), path).map((block) => ({
          block,
          path,
        })),
      );
    const blocks = located.map(({ block }) => block);
    const rules = blocks.filter((block) => block.kind === "rule");
    for (const rule of rules) {
      const concept = rule.fields.get("as")?.value;
      const identity = rule.children.find((child) => child.kind === "identity");
      const attributes = identity?.fields.get("attributes")?.value;
      if (!concept?.startsWith("rf.concept.") || attributes === undefined) continue;
      const declared = sharedIdentity.get(concept) ?? new Set<string>();
      for (const attribute of JSON.parse(attributes) as string[]) declared.add(attribute);
      sharedIdentity.set(concept, declared);
    }
    for (const { block, path } of located) {
      const concept = block.fields.get("to")?.value;
      const by = block.children.find((child) => child.kind === "match")?.fields.get("by")?.value;
      if (!["contribution", "relation", "context"].includes(block.kind)) continue;
      if (!concept?.startsWith("rf.concept.") || !by?.startsWith("target.")) continue;
      sharedMatches.push({ path, line: block.line, concept, by: by.slice("target.".length) });
    }
    for (const emission of blocks.filter(
      (block) =>
        ["contribution", "relation", "context"].includes(block.kind) && block.fields.has("via"),
    )) {
      const target = emission.fields.get("to")?.value;
      const candidates = rules.filter((rule) =>
        target?.startsWith("rule.")
          ? rule.name === target.slice(5)
          : rule.fields.get("as")?.value === target,
      );
      for (const candidate of candidates) {
        const identity = candidate.children.find((child) => child.kind === "identity");
        const endpoint = candidate.children.find((child) => child.kind === "endpoint");
        if (!identity || !endpoint) {
          throw new Error(`${name}: target rule ${candidate.name} needs identity and endpoint`);
        }
      }
    }
  }
  for (const { path, line, concept, by } of sharedMatches) {
    if (!sharedIdentity.get(concept)?.has(by)) {
      throw new Error(
        `${path}:${line}: ${concept} is matched by ${by}, which no official rule declares as identity`,
      );
    }
  }
}

// MirrorPairCandidate is a resource rule that only reclassifies its own type
// into a local concept: static match, no where, no emission, and a concept used
// nowhere else in the dialect. The corpus prunes these pairs; the repository
// gate rejects any reappearance.
export type MirrorPairCandidate = {
  dialect: string;
  rule: string;
  type: string | null;
  file: string;
};

function parseRfBlocks(text: string): RfBlock[] {
  const blocks: RfBlock[] = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; ) {
    const line = lines[index] ?? "";
    const match = /^(concept|rule)\s+"([^"]+)"\s*\{/u.exec(line);
    if (match === null) {
      index += 1;
      continue;
    }
    const kind = match[1] as "concept" | "rule";
    const name = match[2] ?? "";
    let depth = 0;
    let end = index;
    for (; end < lines.length; end += 1) {
      const stripped = (lines[end] ?? "").replace(/"[^"]*"/gu, '""');
      depth += (stripped.match(/\{/gu) ?? []).length - (stripped.match(/\}/gu) ?? []).length;
      if (depth <= 0) {
        end += 1;
        break;
      }
    }
    blocks.push({ kind, name, text: lines.slice(index, end).join("\n") });
    index = end;
  }
  return blocks;
}

function mirrorRuleInfo(text: string): {
  type: string | null;
  data: boolean;
  emissions: boolean;
  where: boolean;
  asLocal: string | null;
  asRf: string | null;
  matchExtra: string[];
} {
  const info = {
    type: null as string | null,
    data: false,
    emissions: false,
    where: false,
    asLocal: null as string | null,
    asRf: null as string | null,
    matchExtra: [] as string[],
  };
  const matchHead = /\bmatch\s*\{/u.exec(text);
  if (matchHead !== null) {
    const start = (matchHead.index ?? 0) + matchHead[0].length;
    let depth = 1;
    let cursor = start;
    for (; cursor < text.length && depth > 0; cursor += 1) {
      if (text[cursor] === "{") depth += 1;
      else if (text[cursor] === "}") depth -= 1;
    }
    const matchBody = text.slice(start, cursor - 1);
    const typeMatch = /type\s*=\s*"([^"]+)"/u.exec(matchBody);
    if (typeMatch !== null) info.type = typeMatch[1] ?? null;
    if (/kind\s*=\s*"data"/u.test(matchBody)) info.data = true;
    info.matchExtra = [...matchBody.matchAll(/^\s*([a-z_]+)\s*=/gmu)]
      .map((entry) => entry[1] ?? "")
      .filter((field) => field !== "type" && field !== "kind");
  }
  const localAs = /^\s*as\s*=\s*concept\.([\w-]+)\s*$/mu.exec(text);
  const sharedAs = /^\s*as\s*=\s*rf\.concept\.([\w-]+)\s*$/mu.exec(text);
  if (localAs !== null) info.asLocal = localAs[1] ?? null;
  if (sharedAs !== null) info.asRf = sharedAs[1] ?? null;
  info.emissions = /^\s*(?:composition|context|relation|contribution|emission)\b/gmu.test(text);
  info.where = /\bwhere\b/u.test(text);
  return info;
}

export function declaredRuleIds(inventory: Inventory): Set<string> {
  const ids = new Set<string>();
  for (const { name } of inventory.dialects) {
    for (const path of filesBelow(join(root, name)).filter((candidate) =>
      candidate.endsWith(".rf.hcl"),
    )) {
      const body = readFileSync(join(root, path), "utf8");
      for (const match of body.matchAll(/^rule\s+"([^"]+)"/gmu)) {
        ids.add(`${name}.rule.${match[1] ?? ""}`);
      }
    }
  }
  return ids;
}

export function emittingRuleIds(inventory: Inventory): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const { name } of inventory.dialects) {
    const emitting = new Set<string>();
    for (const path of filesBelow(join(root, name)).filter((candidate) =>
      candidate.endsWith(".rf.hcl"),
    )) {
      const body = readFileSync(join(root, path), "utf8");
      for (const block of parseRfBlocks(body)) {
        if (block.kind === "rule" && /^\s*via\s*=/mu.test(block.text)) {
          emitting.add(`${name}.rule.${block.name}`);
        }
      }
    }
    result[name] = [...emitting].sort();
  }
  return result;
}

function validatePlanFixtureInventory(inventory: Inventory): void {
  const path = join(root, "evidence", "plan-fixture-inventory.json");
  const value = JSON.parse(readFileSync(path, "utf8")) as PlanFixtureInventory;
  const problems = planFixtureInventoryProblems(
    value,
    join(root, "fixtures"),
    emittingRuleIds(inventory),
  );
  if (problems.length > 0) throw new Error(problems.join("\n"));
}

export type ProviderBinding = {
  dialect: string;
  source: string;
  version: string;
};

export type RegistryEquivalence = ProviderBinding & {
  archives: string;
  checks: {
    version: string;
    platform: string;
    terraform_sha256: string;
    opentofu_sha256: string;
  }[];
};

const sha256Pattern = /^[0-9a-f]{64}$/u;

// A shorthand provider binding covers registry.terraform.io and
// registry.opentofu.org, so each one needs evidence that both
// registries serve the same provider: identical release archives, or for
// hashicorp sources an OpenTofu rebuild of the same release tag.
export function registryEquivalenceProblems(
  bindings: ProviderBinding[],
  evidence: RegistryEquivalence[],
): string[] {
  const problems: string[] = [];
  const key = ({ dialect, source, version }: ProviderBinding): string =>
    [dialect, source, version].join("|");
  const recorded = new Map(evidence.map((entry) => [key(entry), entry]));
  const shorthand = bindings.filter(({ source }) => source.split("/").length === 2);
  for (const binding of shorthand) {
    const entry = recorded.get(key(binding));
    const label = `${binding.dialect}: ${binding.source}`;
    if (!entry || entry.checks.length === 0) {
      problems.push(`${label} has no registry equivalence evidence`);
      continue;
    }
    if (
      !entry.checks.every(
        (check) =>
          sha256Pattern.test(check.terraform_sha256) && sha256Pattern.test(check.opentofu_sha256),
      )
    ) {
      problems.push(`${label} evidence lacks an archive digest from each registry`);
      continue;
    }
    const identical = entry.checks.every(
      (check) => check.terraform_sha256 === check.opentofu_sha256,
    );
    if (entry.archives !== (identical ? "identical" : "rebuilt")) {
      problems.push(`${label} evidence does not match its archive digests`);
    }
    if (!identical && !binding.source.startsWith("hashicorp/")) {
      problems.push(`${label} archives differ between registries; bind one host explicitly`);
    }
  }
  const bound = new Set(shorthand.map(key));
  for (const entry of evidence) {
    if (!bound.has(key(entry)))
      problems.push(`${entry.dialect}: stale registry evidence for ${entry.source}`);
  }
  return problems;
}

function validateRegistryEquivalence(inventory: Inventory): void {
  const bindings: ProviderBinding[] = [];
  for (const { name } of inventory.dialects) {
    const body = readFileSync(join(root, name, "dialect.rf.hcl"), "utf8");
    for (const match of body.matchAll(/provider\s+"([^"]+)"\s*\{\s*version\s*=\s*"([^"]+)"/gu)) {
      bindings.push({
        dialect: name,
        source: match[1] ?? "",
        version: match[2] ?? "",
      });
    }
  }
  const value = JSON.parse(
    readFileSync(join(root, "evidence", "provider-registry-equivalence.json"), "utf8"),
  ) as { format_version?: string; bindings?: RegistryEquivalence[] };
  if (value.format_version !== "1" || !Array.isArray(value.bindings)) {
    throw new Error("provider registry equivalence evidence is malformed");
  }
  const problems = registryEquivalenceProblems(bindings, value.bindings);
  if (problems.length > 0) throw new Error(problems.join("\n"));
}

export type UndeclaredRuleReference = { file: string; path: string; ref: string };

// Collect every qualified owner.rule.name string under documentary schemas
// that is not declared in the official dialect sources. Values of documentary
// provenance keys (prior_rule_id) are audit history and are skipped.
export function collectUndeclaredRuleReferences(
  value: unknown,
  file: string,
  jsonPath: string,
  declared: ReadonlySet<string>,
  out: UndeclaredRuleReference[],
): void {
  if (typeof value === "string") {
    for (const match of value.matchAll(qualifiedRuleReference)) {
      const ref = match[1] ?? "";
      if (!declared.has(ref)) out.push({ file, path: jsonPath, ref });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      collectUndeclaredRuleReferences(entry, file, `${jsonPath}[${index}]`, declared, out);
    }
    return;
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (
        key === "prior_rule_id" &&
        (value.disposition === "removed" || value.disposition === "corrected")
      ) {
        continue;
      }
      const childPath = jsonPath === "$" ? `$.${key}` : `${jsonPath}.${key}`;
      collectUndeclaredRuleReferences(entry, file, childPath, declared, out);
    }
  }
}

export function undeclaredRuleReferences(inventory: Inventory): UndeclaredRuleReference[] {
  const declared = declaredRuleIds(inventory);
  const out: UndeclaredRuleReference[] = [];
  for (const path of filesBelow(root)) {
    if (!path.startsWith("evidence/")) continue;
    const body = readFileSync(join(root, path), "utf8");
    if (path.endsWith(".json")) {
      collectUndeclaredRuleReferences(JSON.parse(body) as unknown, path, "$", declared, out);
    } else {
      const lines = body.split("\n");
      for (const [index, line] of lines.entries()) {
        for (const match of line.matchAll(qualifiedRuleReference)) {
          const ref = match[1] ?? "";
          if (!declared.has(ref)) out.push({ file: path, path: `line ${index + 1}`, ref });
        }
      }
    }
  }
  return out;
}

function conceptReferenceCount(contents: string[], concept: string): number {
  const escaped = concept.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
  const pattern = new RegExp(`(?<![A-Za-z0-9-]\\.)concept\\.${escaped}\\b`, "gu");
  let count = 0;
  for (const content of contents) {
    count += (content.match(pattern) ?? []).length;
  }
  return count;
}

export function mirrorPairCandidates(): MirrorPairCandidate[] {
  const inventory = JSON.parse(readFileSync(join(root, "dialects.json"), "utf8")) as Inventory;
  const candidates: MirrorPairCandidate[] = [];
  for (const { name: dialect } of inventory.dialects) {
    const rfPaths = filesBelow(join(root, dialect)).filter((path) => path.endsWith(".rf.hcl"));
    const contents = rfPaths.map((path) => ({
      path,
      text: readFileSync(join(root, path), "utf8"),
    }));
    const blocks = contents.flatMap((file) =>
      parseRfBlocks(file.text).map((block) => ({ ...block, file: file.path })),
    );
    const conceptNames = [
      ...new Set(blocks.filter((b) => b.kind === "concept").map((b) => b.name)),
    ];
    const allText = contents.map((file) => file.text);
    const referenceCount = new Map(
      conceptNames.map((name) => [name, conceptReferenceCount(allText, name)]),
    );
    for (const block of blocks.filter((b) => b.kind === "rule")) {
      const info = mirrorRuleInfo(block.text);
      if (info.data || info.where || info.emissions) continue;
      if (info.type === null || info.matchExtra.length > 0) continue;
      if (info.asRf !== null || info.asLocal === null) continue;
      if (referenceCount.get(info.asLocal) !== 1) continue;
      candidates.push({ dialect, rule: block.name, type: info.type, file: block.file });
    }
  }
  return candidates;
}

export function validatePresentationManifests(): void {
  const inventory = JSON.parse(readFileSync(join(root, "dialects.json"), "utf8")) as Inventory;
  for (const { name } of inventory.dialects) {
    const value = JSON.parse(readFileSync(join(root, name, "presentation.json"), "utf8")) as Record<
      string,
      unknown
    >;
    const resources = value.resources;
    const labels = value.resource_labels;
    if (resources === undefined && labels === undefined) continue;
    if (!isRecord(resources) || !isRecord(labels)) {
      throw new Error(`presentation manifests must pair resources with resource_labels: ${name}`);
    }
    const resourceKeys = Object.keys(resources);
    const labelKeys = Object.keys(labels).sort();
    if (JSON.stringify(labelKeys) !== JSON.stringify([...resourceKeys].sort())) {
      throw new Error(`presentation resources and resource_labels must share keys: ${name}`);
    }
    for (const key of resourceKeys) {
      if (!key.startsWith("resource/")) {
        throw new Error(`presentation resource key must start with resource/: ${name}: ${key}`);
      }
      if (typeof resources[key] !== "string" || typeof labels[key] !== "string") {
        throw new Error(`presentation resource entries must be strings: ${name}: ${key}`);
      }
    }
  }
}

export function validateRepository(): void {
  const inventory = JSON.parse(readFileSync(join(root, "dialects.json"), "utf8")) as Inventory;
  if (inventory.format_version !== "1" || inventory.dialects.length === 0) {
    throw new Error("dialects.json must contain format version 1 and at least one dialect");
  }

  const expected = inventory.dialects.map(({ name }) => name);
  const allowedTopLevel = new Set([
    ...expected,
    ".gitattributes",
    "LICENSE",
    "README.md",
    "THIRD_PARTY_NOTICES.md",
    "dialects.json",
    "evidence",
    "fixtures",
  ]);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if ([".git", "artifacts", "build", "node_modules"].includes(entry.name)) continue;
    if (!allowedTopLevel.has(entry.name))
      throw new Error(`unexpected top-level path: ${entry.name}`);
  }
  const actual = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && expected.includes(entry.name))
    .map(({ name }) => name)
    .sort((a, b) => a.localeCompare(b, "en"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `dialect inventory mismatch: expected ${expected.join(", ")}; got ${actual.join(", ")}`,
    );
  }

  const files = filesBelow(root);
  for (const path of files) {
    if (forbiddenPath.test(path)) throw new Error(`private path is forbidden: ${path}`);
    if (
      expected.includes(path.split("/", 1)[0] ?? "") &&
      !path.endsWith(".rf.hcl") &&
      !path.endsWith("/presentation.json")
    ) {
      throw new Error(`unexpected dialect file: ${path}`);
    }
    if (path.startsWith("evidence/") && !evidenceNames.has(path.split("/").at(-1) ?? "")) {
      throw new Error(`unexpected evidence file: ${path}`);
    }
    if (
      path !== "scripts/validate-repository.ts" &&
      /\.(?:golden|json|md|rf|tf|tfvars|ts|txt|yml|yaml)$/u.test(path)
    ) {
      const body = readFileSync(join(root, path), "utf8");
      if (forbiddenText.test(body))
        throw new Error(`private or secret-shaped text is forbidden: ${path}`);
      if (hasPrivateImplementationReference(body)) {
        throw new Error(`private implementation reference is forbidden: ${path}`);
      }
      if (path.startsWith("evidence/") && path.endsWith(".json")) {
        validatePublicEvidenceReferences(JSON.parse(body) as unknown, path);
      }
    }
  }

  for (const { name, version } of inventory.dialects) {
    const declaration = readFileSync(join(root, name, "dialect.rf.hcl"), "utf8");
    const match = declaration.match(
      /^dialect\s+"([^"]+)"\s*\{[\s\S]*?^\s*version\s*=\s*"([^"]+)"/mu,
    );
    if (!match || match[1] !== name || match[2] !== version) {
      throw new Error(`dialect declaration does not match inventory: ${name}@${version}`);
    }
    JSON.parse(readFileSync(join(root, name, "presentation.json"), "utf8"));
  }

  const mirrors = mirrorPairCandidates();
  if (mirrors.length > 0) {
    const sample = mirrors
      .slice(0, 5)
      .map((candidate) => `${candidate.dialect}/${candidate.rule} (${candidate.type})`)
      .join(", ");
    throw new Error(`${mirrors.length} redundant resource-mirror pair(s) remain: ${sample}`);
  }
  validatePresentationManifests();
  validateTargetContracts(inventory);
  validatePlanFixtureInventory(inventory);
  validateRegistryEquivalence(inventory);

  const danglingRules = undeclaredRuleReferences(inventory);
  if (danglingRules.length > 0) {
    const sample = danglingRules
      .slice(0, 5)
      .map((hit) => `${hit.file}: ${hit.path} = ${hit.ref}`)
      .join("; ");
    throw new Error(`${danglingRules.length} undeclared rule reference(s) in evidence: ${sample}`);
  }
}

if (import.meta.main) {
  try {
    validateRepository();
    console.log("Repository structure is valid.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
