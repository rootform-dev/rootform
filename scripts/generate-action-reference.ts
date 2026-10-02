#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const actionNames = ["action", "setup", "init", "analyze", "compare", "check"] as const;
export type ActionName = (typeof actionNames)[number];
type Input = { description: string; required: boolean; default: string };
type Metadata = {
  name: string;
  description: string;
  inputs: Record<string, Input>;
  outputs: Record<string, { description: string }>;
};
export type ActionReference = {
  source: { repository: string; commit: string };
  actions: Record<ActionName, Metadata>;
};
const begin = "<!-- BEGIN GENERATED ACTION -->";
const end = "<!-- END GENERATED ACTION -->";

function cell(value: string): string {
  return value
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("`", "&#96;")
    .replace(/\s+/g, " ")
    .trim();
}

export function renderReference(document: ActionReference, name: ActionName): string {
  const metadata = document.actions[name];
  const path = name === "action" ? "action.yml" : `${name}/action.yml`;
  const source = `https://github.com/${document.source.repository}/blob/${document.source.commit}/${path}`;
  const lines = [
    begin,
    "",
    "## Inputs",
    "",
    "| Input | Default | Description |",
    "| --- | --- | --- |",
  ];
  for (const [id, input] of Object.entries(metadata.inputs)) {
    const fallback = input.default === "" ? "Omitted" : `\`${cell(input.default)}\``;
    lines.push(
      `| \`${id}\` | ${fallback} | ${cell(input.description)}${input.required ? " Required." : ""} |`,
    );
  }
  lines.push("", "## Outputs", "", "| Output | Description |", "| --- | --- |");
  for (const [id, output] of Object.entries(metadata.outputs))
    lines.push(`| \`${id}\` | ${cell(output.description)} |`);
  lines.push("", `Exact fields and defaults: [Action metadata](${source}).`, "", end);
  return lines.join("\n");
}

export function updateReference(page: string, generated: string): string {
  if (
    page.split(begin).length !== 2 ||
    page.split(end).length !== 2 ||
    page.indexOf(begin) > page.indexOf(end)
  )
    throw new Error("Action reference requires one complete generated region");
  return (
    page.slice(0, page.indexOf(begin)) + generated + page.slice(page.indexOf(end) + end.length)
  );
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const document = JSON.parse(
    readFileSync(join(root, "reference/github-actions.json"), "utf8"),
  ) as ActionReference;
  if (
    document.source.repository !== "rootform-dev/action" ||
    !/^[a-f0-9]{40}$/.test(document.source.commit) ||
    Object.keys(document.actions).sort().join() !== [...actionNames].sort().join()
  )
    throw new Error(
      "Action reference requires the six entrypoints and an exact public source commit",
    );
  let stale = false;
  for (const name of actionNames) {
    const path = join(root, "docs/integrations/github-actions", `${name}.md`);
    const current = readFileSync(path, "utf8");
    const next = updateReference(current, renderReference(document, name));
    if (next === current) continue;
    if (process.argv.includes("--check")) {
      console.error(`Stale Action reference: ${name}; run bun run generate:actions`);
      stale = true;
    } else writeFileSync(path, next);
  }
  if (stale) process.exit(1);
  console.log("Six Action references match the exact metadata snapshot.");
}
