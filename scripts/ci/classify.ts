#!/usr/bin/env bun
import { appendFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Change, classifyChanges, fullImpact, type Impact } from "./impact.ts";

function git(source: string, args: string[]): Buffer {
  const result = Bun.spawnSync(["git", "-C", source, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.exitCode !== 0) throw new Error("Cannot inspect exact Git revisions");
  return result.stdout;
}

function text(source: string, sha: string, path: string): string | null | undefined {
  if (!path.endsWith(".md")) return undefined;
  const tree = git(source, ["ls-tree", sha, "--", path]).toString();
  if (!tree) return null;
  if (!/^100644 blob /u.test(tree)) return undefined;
  const value = git(source, ["show", `${sha}:${path}`]);
  if (value.length > 2 * 1024 * 1024 || value.includes(0)) return undefined;
  return value.toString("utf8");
}

export function inspectChanges(source: string, base: string, head: string): Change[] {
  for (const sha of [base, head])
    if (!/^[0-9a-f]{40}$/u.test(sha)) throw new Error("Revision must be an exact Git SHA");
  const tokens = git(source, ["diff", "--name-status", "-z", "--find-renames", base, head, "--"])
    .toString()
    .split("\0");
  const changes: Change[] = [];
  while (tokens.length && tokens[0]) {
    const status = tokens.shift() ?? "";
    const first = tokens.shift();
    const second = /^[RC]/u.test(status) ? tokens.shift() : undefined;
    const path = second ?? first;
    if (!path || !/^[ACDMRTUXB][0-9]*$/u.test(status))
      throw new Error("Incomplete change inventory");
    changes.push({
      path,
      previousPath: second ? first : undefined,
      before: text(source, base, first ?? path),
      after: text(source, head, path),
    });
  }
  return changes;
}

if (import.meta.main) {
  const [source, base, head, output] = process.argv.slice(2);
  if (!source || !base || !head || !output)
    throw new Error("usage: classify.ts SOURCE BASE_SHA HEAD_SHA OUTPUT");
  let impact: Impact;
  try {
    impact = classifyChanges(inspectChanges(resolve(source), base, head));
  } catch {
    impact = fullImpact("Git change inventory unavailable; full validation required");
  }
  writeFileSync(output, `${JSON.stringify(impact, null, 2)}\n`);
  for (const [name, needed] of Object.entries(impact.lanes))
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${needed}\n`);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `scenarios=${impact.scenarios}\nregistry=${impact.registry}\nplan=${JSON.stringify(impact)}\n`,
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Contribution impact\n\n${impact.reasons.map((reason) => `- ${reason}`).join("\n")}\n\nExact source: \`${head}\`.\n`,
    );
  console.log(JSON.stringify(impact));
}
