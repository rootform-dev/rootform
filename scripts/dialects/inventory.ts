import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  flattenRfBlocks,
  parseRfSource,
  type RfBlock,
  referencePaths,
  staticString,
} from "./rf-source.ts";
import { filesBelow } from "./validate.ts";

export type SourceLocation = { file: string; line: number; endLine: number };
export type Fields = Record<string, string>;
export type Definition = {
  id: string;
  kind: "concept" | "context" | "relation";
  description?: string;
  declarations: Array<SourceLocation & { inline: boolean }>;
  usedBy: string[];
};
export type Emission = {
  kind: "context" | "relation" | "contribution";
  symbol?: string;
  target: string;
  via: string;
  fields: Fields;
  match: Fields;
  source: SourceLocation;
};
export type Member = {
  name: string;
  via: string;
  dependencies: string[];
  match: Fields;
  source: SourceLocation;
};
export type Rule = {
  id: string;
  name: string;
  type: string;
  kind: string;
  classification?: string;
  condition?: string;
  identity: Fields;
  endpoint: Fields;
  emissions: Emission[];
  members: Member[];
  references: string[];
  source: SourceLocation;
};
export type DialectInventory = {
  name: string;
  version: string;
  providers: Array<{ address: string; versions: string; source: SourceLocation }>;
  definitions: Definition[];
  rfReferences: string[];
  rules: Rule[];
  presentation?: { file: string; hasResources: boolean; hasDefinitions: boolean };
};

const ordered = (a: string, b: string) => a.localeCompare(b, "en");
const fields = (block?: RfBlock): Fields =>
  Object.fromEntries([...(block?.fields ?? [])].map(([key, field]) => [key, field.value]));
const field = (block: RfBlock, name: string): string | undefined => block.fields.get(name)?.value;
const source = (file: string, block: RfBlock): SourceLocation => ({
  file,
  line: block.line,
  endLine: block.endLine,
});
export function qualifyReference(owner: string, expression: string): string {
  return /^(concept|context|relation|rule)\./u.test(expression)
    ? `${owner}.${expression}`
    : expression;
}
function literal(block: RfBlock, key: string, file: string): string {
  const value = staticString(field(block, key) ?? "");
  if (value === undefined) throw new Error(`${file}:${block.line}: ${key} must be a static string`);
  return value;
}
function semanticReferences(owner: string, block: RfBlock): string[] {
  return [
    ...new Set(
      flattenRfBlocks([block]).flatMap((child) =>
        [...child.fields.values()]
          .flatMap(({ value }) => referencePaths(value))
          .map((value) => qualifyReference(owner, value))
          .filter((value) => {
            const parts = value.split(".");
            return (
              parts.length === 3 &&
              [owner, "rf"].includes(parts[0]!) &&
              ["concept", "context", "relation", "rule"].includes(parts[1]!)
            );
          }),
      ),
    ),
  ].sort(ordered);
}

export function inventoryFromSources(
  name: string,
  version: string,
  sources: Array<{ file: string; text: string }>,
): DialectInventory {
  const located = [...sources]
    .sort((a, b) => ordered(a.file, b.file))
    .flatMap(({ file, text }) => parseRfSource(text, file).map((block) => ({ file, block })));
  const manifests = located.filter(({ block }) => block.kind === "dialect");
  if (manifests.length !== 1) throw new Error(`${name}: expected one Dialect declaration`);
  const manifest = manifests[0]!;
  if (manifest.block.name !== name || literal(manifest.block, "version", manifest.file) !== version)
    throw new Error(`${name}: declaration differs from the official inventory`);
  const providers = manifest.block.children
    .filter((block) => block.kind === "provider")
    .map((block) => ({
      address: block.name,
      versions: literal(block, "version", manifest.file),
      source: source(manifest.file, block),
    }))
    .sort((a, b) => ordered(a.address, b.address));
  const definitions = new Map<string, Definition>();
  const rules: Rule[] = [];
  function declare(kind: Definition["kind"], file: string, block: RfBlock, inline: boolean) {
    const id = `${name}.${kind}.${block.name}`;
    const description =
      field(block, "description") === undefined ? undefined : literal(block, "description", file);
    const existing = definitions.get(id);
    if (existing?.description && description && existing.description !== description)
      throw new Error(`${id}: conflicting descriptions`);
    const definition = existing ?? { id, kind, declarations: [], usedBy: [] };
    if (description !== undefined) definition.description = description;
    definition.declarations.push({ ...source(file, block), inline });
    definitions.set(id, definition);
  }
  for (const { file, block } of located) {
    if (["concept", "context", "relation"].includes(block.kind))
      declare(block.kind as Definition["kind"], file, block, false);
    if (block.kind !== "rule") continue;
    const match = block.children.find((child) => child.kind === "match");
    if (!match) throw new Error(`${file}:${block.line}: Rule match missing`);
    const emissions = block.children
      .filter((child) => ["context", "relation", "contribution"].includes(child.kind))
      .map((child): Emission => {
        if (child.name && child.kind !== "contribution")
          declare(child.kind as Definition["kind"], file, child, true);
        const as = field(child, "as");
        const symbol =
          child.kind === "contribution"
            ? undefined
            : child.name
              ? `${name}.${child.kind}.${child.name}`
              : as && qualifyReference(name, as);
        return {
          kind: child.kind as Emission["kind"],
          symbol,
          target: qualifyReference(name, field(child, "to") ?? ""),
          via: field(child, "via") ?? "",
          fields: fields(child),
          match: fields(child.children.find((nested) => nested.kind === "match")),
          source: source(file, child),
        };
      });
    const composition = block.children.find((child) => child.kind === "composition");
    const members = (composition?.children ?? [])
      .filter((child) => child.kind === "member")
      .map((child): Member => {
        const via = field(child, "via") ?? "";
        return {
          name: child.name,
          via,
          dependencies: [
            ...new Set(
              referencePaths(via)
                .filter((value) => value.startsWith("member."))
                .map((value) => value.split(".")[1]!),
            ),
          ],
          match: fields(child.children.find((nested) => nested.kind === "match")),
          source: source(file, child),
        };
      });
    const classification = field(block, "as");
    const references = [
      ...new Set([
        ...semanticReferences(name, block),
        ...emissions.flatMap((emission) => (emission.symbol ? [emission.symbol] : [])),
      ]),
    ].sort(ordered);
    rules.push({
      id: `${name}.rule.${block.name}`,
      name: block.name,
      type: literal(match, "type", file),
      kind: field(match, "kind") === undefined ? "resource" : literal(match, "kind", file),
      classification: classification && qualifyReference(name, classification),
      condition: field(match, "where"),
      identity: fields(block.children.find((child) => child.kind === "identity")),
      endpoint: fields(block.children.find((child) => child.kind === "endpoint")),
      emissions,
      members,
      references,
      source: source(file, block),
    });
  }
  const ids = new Set<string>();
  for (const rule of rules) {
    if (ids.has(rule.id)) throw new Error(`${rule.id}: duplicate Rule`);
    ids.add(rule.id);
    for (const reference of rule.references) definitions.get(reference)?.usedBy.push(rule.id);
  }
  for (const definition of definitions.values())
    definition.usedBy = [...new Set(definition.usedBy)].sort(ordered);
  return {
    name,
    version,
    providers,
    definitions: [...definitions.values()].sort((a, b) => ordered(a.id, b.id)),
    rfReferences: [
      ...new Set(rules.flatMap((rule) => rule.references).filter((id) => id.startsWith("rf."))),
    ].sort(ordered),
    rules: rules.sort((a, b) =>
      ordered(`${a.type}/${a.kind}/${a.name}`, `${b.type}/${b.kind}/${b.name}`),
    ),
  };
}

export function officialDialectInventory(root: string): DialectInventory[] {
  const dialectRoot = join(root, "dialects");
  const inventory = JSON.parse(readFileSync(join(dialectRoot, "dialects.json"), "utf8")) as {
    dialects: Array<{ name: string; version: string }>;
  };
  return [...inventory.dialects]
    .sort((a, b) => ordered(a.name, b.name))
    .map(({ name, version }) => {
      const paths = filesBelow(join(dialectRoot, name));
      if (paths.some((path) => path.endsWith(".rf.json")))
        throw new Error(`${name}: official inventory requires native RF sources`);
      const dialect = inventoryFromSources(
        name,
        version,
        paths
          .filter((file) => file.endsWith(".rf.hcl"))
          .map((file) => ({ file, text: readFileSync(join(dialectRoot, file), "utf8") })),
      );
      const file = `${name}/presentation.json`;
      if (existsSync(join(dialectRoot, file))) {
        const presentation = JSON.parse(readFileSync(join(dialectRoot, file), "utf8")) as Record<
          string,
          Record<string, unknown>
        >;
        dialect.presentation = {
          file,
          hasResources: Object.keys(presentation.resources ?? {}).length > 0,
          hasDefinitions: ["rules", "concepts"].some(
            (key) => Object.keys(presentation[key] ?? {}).length > 0,
          ),
        };
      }
      return dialect;
    });
}
