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
export function assertHelpUsage(path: string, reference: string, help: string): void {
  const actual = /^Usage\n\s+([^\n]+)/mu.exec(help)?.[1];
  if (actual !== reference)
    throw new Error(
      `${path} usage differs from the CLI reference: help ${JSON.stringify(actual)}, reference ${JSON.stringify(reference)}`,
    );
}
/* run analyzes and never evaluates Policies, so a documented run command
   carrying Policy flags or a SARIF output would fail; check takes its input
   as an argument, not through the retired --plan flag. explain instance and
   explain rule read an input given with --input, explain policy reads a check
   result given with --result, list and show choose their format with
   --format, init shows more with --details, and a comparison Form reopens
   alone. Only code blocks and inline code are commands; prose may name both
   commands in one sentence. */
export function retiredCommand(text: string): string | undefined {
  if (/rootform (?:build|diff)\b/u.test(text)) return "retired CLI command";
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)\n```/gu)].map((match) => match[1] ?? "");
  const prose = text.replace(/```[^\n]*\n[\s\S]*?\n```/gu, "");
  const spans = [...prose.matchAll(/`([^`\n]+)`/gu)].map((match) => match[1] ?? "");
  const commands = [...blocks, ...spans].flatMap((code) =>
    code.replace(/\\\n\s*/gu, " ").split(/\n|&&|\|\||;|\|/u),
  );
  for (const command of commands) {
    if (/\brootform run\b.*\s--policy(?:-pack)?(?:[\s=]|$)/u.test(command))
      return "run does not evaluate Policies; use rootform check";
    if (/\brootform run\b.*(?:--format[\s=]+sarif|\.sarif(?:\.json)?\b)/u.test(command))
      return "run does not write SARIF; use rootform check";
    if (/\brootform check\b.*\s--plan(?:[\s=]|$)/u.test(command))
      return "check takes its input as an argument";
    if (/\brootform explain (?:architecture|semantics)\b/u.test(command))
      return "explain architecture and explain semantics are explain instance and explain rule";
    const help = /\s(?:-h|--help)(?:\s|$)/u.test(command);
    if (
      /\brootform explain (?:instance|rule)\s+\S/u.test(command) &&
      !help &&
      !/\s--input(?:[\s=]|$)/u.test(command)
    )
      return "explain instance and explain rule read the input given with --input";
    if (
      /\brootform explain policy\s+\S/u.test(command) &&
      !help &&
      !/\s--result(?:[\s=]|$)/u.test(command)
    )
      return "explain policy reads the check result given with --result";
    if (/\brootform (?:list|show)\b.*\s(?:-o|--output)(?:[\s=]|$)/u.test(command))
      return "list and show print to standard output; --format chooses the format";
    if (/\brootform init\b.*\s(?:-v|--verbose)(?:[\s=]|$)/u.test(command))
      return "init shows more with --details";
    if (/(?:^|\s)--(?:before|after)-side(?:[\s=]|$)/u.test(command))
      return "a comparison Form reopens alone; it has no --before-side or --after-side";
  }
  return undefined;
}
export function assertNoRetiredCommands(root: string): number {
  const paths = ["docs", "examples", "contracts", "policy-packs", "dialects"];
  let checked = 0;
  const walk = (directory: string) => {
    for (const entry of new Bun.Glob("**/*.md").scanSync({ cwd: directory, onlyFiles: true })) {
      const retired = retiredCommand(readFileSync(join(directory, entry), "utf8"));
      if (retired) throw new Error(`${entry}: ${retired}`);
      checked += 1;
    }
  };
  for (const path of paths) walk(join(root, path));
  return checked;
}
