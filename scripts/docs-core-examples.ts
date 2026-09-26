import { readFileSync } from "node:fs";
import { join } from "node:path";

export const extractedMarkers = new Set<string>();
const fence = "```";
export function markedCommand(page: string, name: string): string {
  const marker = `<!-- docs-check:${name} -->`;
  const parts = page.split(marker);
  if (parts.length !== 2) throw new Error(`Expected one command marker: ${name}`);
  const match = new RegExp(`^\\s*${fence}sh\\n([\\s\\S]*?)\\n${fence}`).exec(parts[1] ?? "");
  if (!match?.[1]) throw new Error(`Expected shell block after ${name}`);
  extractedMarkers.add(name);
  return match[1];
}
export function configuration(page: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [
    ...page.matchAll(
      new RegExp(`${fence}(?:hcl|rf) title="${escaped}"\\n([\\s\\S]*?)\\n${fence}`, "gu"),
    ),
  ];
  if (matches.length !== 1 || !matches[0]?.[1]) throw new Error(`Expected one hcl block: ${title}`);
  return `${matches[0][1]}\n`;
}
export function assertHelpUsage(path: string, exported: string, help: string): void {
  const actual = /^Usage:\n\s+([^\n]+)/mu.exec(help)?.[1];
  if (actual !== exported)
    throw new Error(
      `${path} usage differs from public export: help ${JSON.stringify(actual)}, export ${JSON.stringify(exported)}`,
    );
}
export function assertNoRetiredCommands(root: string): number {
  const paths = ["docs", "examples/playground", "contracts"];
  let checked = 0;
  const walk = (directory: string) => {
    for (const entry of new Bun.Glob("**/*.md").scanSync({ cwd: directory, onlyFiles: true })) {
      const text = readFileSync(join(directory, entry), "utf8");
      if (/rootform (?:build|check|diff)\b/u.test(text))
        throw new Error(`${entry}: retired CLI command`);
      checked += 1;
    }
  };
  for (const path of paths) walk(join(root, path));
  return checked;
}
