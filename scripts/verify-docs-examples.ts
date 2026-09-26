#!/usr/bin/env bun

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { assertNoRetiredCommands } from "./docs-core-examples.ts";
import { verifyVisualExamples } from "./docs-visual-examples.ts";

const root = resolve(import.meta.dir, "..");
const binary = process.env.ROOTFORM_BIN;
if (!binary || !isAbsolute(binary) || !existsSync(binary)) {
  throw new Error("ROOTFORM_BIN must name an existing absolute executable");
}
const checked = assertNoRetiredCommands(root);
const visual = await verifyVisualExamples(binary, root);
const plan = join(root, "examples/playground/event-driven-platform/head/plan.json");
const saved = join(root, "examples/playground/event-driven-platform/head/plan.tfplan");
const scratch = mkdtempSync(join(tmpdir(), "rf-docs-output-"));
const env = { ...process.env, ROOTFORM_SOURCE: root, ROOTFORM_HOME: join(scratch, "home") };
for (const extension of ["json", "md", "txt", "sarif"]) {
  const output = join(scratch, `analysis.${extension}`);
  const result = Bun.spawnSync(
    [binary, "run", plan, "--plan-file", saved, "--require-enrichment", "--no-serve", "-o", output],
    {
      cwd: root,
      env,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (result.exitCode !== 0 || !existsSync(output))
    throw new Error(`${extension} output failed: ${result.stderr.toString()}`);
  if (extension === "json" && JSON.parse(readFileSync(output, "utf8")).kind !== "plan")
    throw new Error("JSON output is not a plan document");
}
const help = Bun.spawnSync([binary, "run", "-h"], { stdout: "pipe", stderr: "pipe" });
if (help.exitCode !== 0 || !help.stdout.toString().includes("rootform run <input>"))
  throw new Error("run help differs from documentation");
console.log(
  `Docs examples: ${checked} Markdown pages free of retired commands; ${visual.join("; ")}; JSON, Markdown, text, and SARIF verified.`,
);
