#!/usr/bin/env bun

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

type Flag = {
  name: string;
  type: string;
  default: string;
  usage: string;
  shorthand?: string;
  required?: boolean;
  no_option_default?: string;
  deprecated?: string;
  shorthand_deprecated?: string;
};

export type Command = {
  path: string;
  usage: string;
  summary: string;
  description: string;
  aliases?: string[];
  examples?: string;
  deprecated?: string;
  subcommands?: string[];
  flags?: Flag[];
  inherited_flags?: Flag[];
};

const commandKeys = [
  "path",
  "usage",
  "summary",
  "description",
  "aliases",
  "examples",
  "deprecated",
  "subcommands",
  "flags",
  "inherited_flags",
];
const flagKeys = [
  "name",
  "type",
  "default",
  "usage",
  "shorthand",
  "required",
  "no_option_default",
  "deprecated",
  "shorthand_deprecated",
];
const notice =
  "<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->";
export const beginBuild = "<!-- BEGIN GENERATED CLI: rootform build -->";
export const endBuild = "<!-- END GENERATED CLI -->";

function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CLI reference: expected object");
  }
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (!keys.includes(key)) throw new Error(`CLI reference: unknown field ${key}`);
  }
  return result;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`CLI reference: ${label} must contain strings`);
  }
  return value;
}

export function parseReference(value: unknown): Command[] {
  const document = object(value, ["format_version", "commands"]);
  if (document.format_version !== 1 || !Array.isArray(document.commands)) {
    throw new Error("CLI reference: unsupported document");
  }
  const seen = new Set<string>();
  for (const entry of document.commands) {
    const cmd = object(entry, commandKeys);
    for (const key of ["path", "usage", "summary", "description"]) {
      if (typeof cmd[key] !== "string") throw new Error(`CLI reference: missing ${key}`);
    }
    const path = String(cmd.path);
    if (!/^rootform(?: [a-z][a-z0-9-]*)*$/u.test(path) || seen.has(path)) {
      throw new Error(`CLI reference: invalid or duplicate command ${path}`);
    }
    seen.add(path);
    for (const key of ["examples", "deprecated"]) {
      if (cmd[key] !== undefined && typeof cmd[key] !== "string") {
        throw new Error(`CLI reference: invalid ${key}`);
      }
    }
    for (const key of ["aliases", "subcommands"]) {
      if (cmd[key] !== undefined) strings(cmd[key], key);
    }
    const names = new Set<string>();
    for (const key of ["flags", "inherited_flags"]) {
      const flags = cmd[key];
      if (flags === undefined) continue;
      if (!Array.isArray(flags)) throw new Error(`CLI reference: invalid ${key}`);
      for (const raw of flags) {
        const flag = object(raw, flagKeys);
        for (const field of ["name", "type", "default", "usage"]) {
          if (typeof flag[field] !== "string")
            throw new Error(`CLI reference: missing flag ${field}`);
        }
        if (!/^[a-z][a-z0-9-]*$/u.test(String(flag.name)) || names.has(String(flag.name))) {
          throw new Error("CLI reference: invalid or shadowed flag");
        }
        names.add(String(flag.name));
        for (const [field, item] of Object.entries(flag)) {
          if (typeof item !== (field === "required" ? "boolean" : "string")) {
            throw new Error(`CLI reference: invalid flag ${field}`);
          }
        }
      }
    }
  }
  if (!seen.has("rootform")) throw new Error("CLI reference: root command missing");
  const commands = document.commands as Command[];
  for (const cmd of commands) {
    const children = commands.filter(
      (child) => child.path.split(" ").slice(0, -1).join(" ") === cmd.path,
    );
    const expected = children.map((child) => child.path).sort();
    if (JSON.stringify([...(cmd.subcommands ?? [])].sort()) !== JSON.stringify(expected)) {
      throw new Error(`CLI reference: incomplete child inventory for ${cmd.path}`);
    }
    const parent = cmd.path.split(" ").slice(0, -1).join(" ");
    if (parent && !seen.has(parent)) throw new Error(`CLI reference: missing parent ${parent}`);
  }
  return commands;
}

function prose(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function cell(text: string): string {
  return prose(text).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function code(text: string): string {
  const delimiter = "`".repeat(
    Math.max(0, ...[...text.matchAll(/`+/gu)].map((m) => m[0].length)) + 1,
  );
  return `${delimiter} ${cell(text)} ${delimiter}`;
}

function fence(text: string, language: string): string {
  const delimiter = "`".repeat(
    Math.max(2, ...[...text.matchAll(/`+/gu)].map((m) => m[0].length)) + 1,
  );
  return `${delimiter}${language}\n${text}\n${delimiter}`;
}

export function commandPage(path: string): string {
  return path === "rootform"
    ? "reference/cli/index.md"
    : `reference/cli/${path.split(" ").slice(1).join("/")}.md`;
}

function link(from: string, target: string): string {
  return relative(dirname(commandPage(from)), commandPage(target)).replaceAll("\\", "/");
}

function flagTable(flags: Flag[], title: string): string {
  if (!flags.length) return "";
  const rows = flags.map((flag) => {
    const name = `${flag.shorthand ? `-${flag.shorthand}, ` : ""}--${flag.name}`;
    const notes = [
      flag.required ? "Required." : "",
      flag.deprecated ? `Deprecated: ${flag.deprecated}` : "",
      flag.shorthand_deprecated ? `Shorthand deprecated: ${flag.shorthand_deprecated}` : "",
      flag.no_option_default && !(flag.type === "bool" && flag.no_option_default === "true")
        ? `Without a value: ${code(flag.no_option_default)}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `| ${code(name)} | ${code(flag.type)} | ${code(flag.default === "" ? '""' : flag.default)} | ${cell(flag.usage)}${notes ? ` ${cell(notes)}` : ""} |`;
  });
  return `## ${title}\n\n| Flag | Type | Default | Meaning |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n`;
}

export function syntax(cmd: Command): string {
  const parts = [`## Usage\n\n${fence(cmd.usage, "text")}\n`];
  if (cmd.aliases?.length) parts.push(`Aliases: ${cmd.aliases.map(code).join(", ")}.\n`);
  if (cmd.deprecated) parts.push(`Deprecated: ${prose(cmd.deprecated)}\n`);
  parts.push(
    flagTable(cmd.flags ?? [], "Flags"),
    flagTable(cmd.inherited_flags ?? [], "Inherited flags"),
  );
  return parts.filter(Boolean).join("\n").trimEnd();
}

export function renderCommand(cmd: Command, commands: Command[]): string {
  const chunks = [
    `---\ntitle: ${JSON.stringify(cmd.path === "rootform" ? "CLI command reference" : cmd.path)}\ndescription: ${JSON.stringify(cmd.summary)}\n---`,
    notice,
    `${prose(cmd.summary)}.`,
    syntax(cmd),
  ];
  if (cmd.description) {
    const [body, exits] = cmd.description.split(/\n\nExit status:\n/u);
    chunks.push(`## Behavior\n\n${prose(body ?? "")}`);
    if (exits) chunks.push(`## Exit status\n\n${fence(exits.replace(/^ {2}/gmu, ""), "text")}`);
  }
  if (cmd.subcommands?.length) {
    const rows = cmd.subcommands.map((path) => {
      const child = commands.find((entry) => entry.path === path);
      return `| [${code(path)}](${link(cmd.path, path)}) | ${cell(child?.summary ?? "")} |`;
    });
    chunks.push(`## Subcommands\n\n| Command | Purpose |\n| --- | --- |\n${rows.join("\n")}`);
  }
  if (cmd.examples) {
    chunks.push(`## Examples\n\n${fence(cmd.examples.replace(/^ {2}/gmu, ""), "sh")}`);
  }
  return `${chunks.join("\n\n")}\n`;
}

export function replaceBuild(page: string, cmd: Command): string {
  if (page.split(beginBuild).length !== 2 || page.split(endBuild).length !== 2) {
    throw new Error("Build reference needs exactly one generated block");
  }
  const start = page.indexOf(beginBuild);
  const end = page.indexOf(endBuild);
  if (end < start) throw new Error("Build reference markers are reversed");
  return `${page.slice(0, start) + beginBuild}\n\n${syntax(cmd)}\n\n${page.slice(end)}`;
}

type Nav = string | { label: string; page?: string; items?: Nav[] };

export function commandNavigation(commands: Command[]): Nav[] {
  function entry(cmd: Command): Nav {
    const label = cmd.path === "rootform" ? "Overview" : (cmd.path.split(" ").at(-1) ?? cmd.path);
    const page = commandPage(cmd.path)
      .replace(/\.md$/u, "")
      .replace(/\/index$/u, "");
    if (cmd.path !== "rootform" && cmd.subcommands?.length) {
      return {
        label,
        items: [
          { label: "Overview", page },
          ...cmd.subcommands.map((path) => {
            const child = commands.find((candidate) => candidate.path === path);
            if (!child) throw new Error(`Missing command metadata: ${path}`);
            return entry(child);
          }),
        ],
      };
    }
    return { label, page };
  }
  return commands.filter((cmd) => cmd.path.split(" ").length === 2).map(entry);
}

export function generate(root: string, check: boolean): void {
  const commands = parseReference(
    JSON.parse(readFileSync(join(root, "reference/cli.json"), "utf8")),
  );
  const docs = join(root, "docs");
  const expected = new Map<string, string>();
  for (const cmd of commands) {
    const path = commandPage(cmd.path);
    const text =
      cmd.path === "rootform build"
        ? replaceBuild(readFileSync(join(docs, path), "utf8"), cmd)
        : renderCommand(cmd, commands);
    expected.set(join(docs, path), text);
  }
  const navPath = join(docs, "navigation.json");
  const navigation = JSON.parse(readFileSync(navPath, "utf8")) as Nav[];
  const reference = navigation.find(
    (item) => typeof item !== "string" && item.label === "Reference",
  );
  const group =
    typeof reference !== "string"
      ? reference?.items?.find((item) => typeof item !== "string" && item.label === "Commands")
      : undefined;
  if (!group || typeof group === "string")
    throw new Error("Reference > Commands navigation group missing");
  group.items = commandNavigation(commands);
  // Match the repository formatter without asking it to rewrite opaque input.
  const formatted = Bun.spawnSync(
    [join(root, "node_modules/.bin/biome"), "format", "--stdin-file-path=docs/navigation.json"],
    {
      cwd: root,
      stdin: Buffer.from(JSON.stringify(navigation)),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (formatted.exitCode !== 0) throw new Error(formatted.stderr.toString());
  expected.set(navPath, formatted.stdout.toString());
  const stale = readdirSync(join(docs, "reference/cli"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !expected.has(path) && readFileSync(path, "utf8").includes(notice));
  const changed = [...expected].filter(
    ([path, text]) => !existsSync(path) || readFileSync(path, "utf8") !== text,
  );
  if (check && (changed.length || stale.length)) {
    throw new Error(
      `Generated CLI reference drift: run bun run generate:cli (${changed.length} changed, ${stale.length} stale)`,
    );
  }
  if (!check) {
    for (const [path, text] of changed) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    }
    for (const path of stale) rmSync(path);
  }
  console.log(`CLI reference ${check ? "verified" : "generated"}: ${commands.length} commands`);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check") || args.length > 1)
    throw new Error("Usage: bun scripts/generate-cli-reference.ts [--check]");
  generate(resolve(import.meta.dir, ".."), args.includes("--check"));
}
