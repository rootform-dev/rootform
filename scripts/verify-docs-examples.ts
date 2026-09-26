#!/usr/bin/env bun

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { verifyAuthoringExamples } from "./docs-authoring-examples.ts";
import { verifyAutomationExamples } from "./docs-automation-examples.ts";
import { verifyConceptExamples } from "./docs-concept-examples.ts";
import { assertNoRetiredCommands, extractedMarkers } from "./docs-core-examples.ts";
import { verifyJourneyExamples } from "./docs-journey-examples.ts";
import { verifyLanguageExamples } from "./docs-language-examples.ts";
import { verifyLanguageReferenceExamples } from "./docs-language-reference-examples.ts";
import { registryMarkers } from "./docs-registry-examples.ts";
import { verifyVisualExamples } from "./docs-visual-examples.ts";

const root = resolve(import.meta.dir, "..");
const binary = process.env.ROOTFORM_BIN;
if (!binary || !isAbsolute(binary) || !existsSync(binary)) {
  throw new Error("ROOTFORM_BIN must name an existing absolute executable");
}

/* Marker names are global: one docs-check marker per name across the tree,
   and every docs-output excerpt belongs to a command marked on the same page. */
function documentedMarkers(): Map<string, string> {
  const markers = new Map<string, string>();
  for (const entry of new Bun.Glob("**/*.md").scanSync({
    cwd: join(root, "docs"),
    onlyFiles: true,
  })) {
    const page = readFileSync(join(root, "docs", entry), "utf8");
    const commands = new Set<string>();
    for (const match of page.matchAll(/<!-- docs-check:([^ ]+) -->/gu)) {
      const name = match[1] ?? "";
      const previous = markers.get(name);
      if (previous)
        throw new Error(`docs-check marker ${name} appears in ${previous} and docs/${entry}`);
      markers.set(name, `docs/${entry}`);
      commands.add(name);
    }
    for (const match of page.matchAll(/<!-- docs-output:([^ ]+) -->/gu)) {
      if (!commands.has(match[1] ?? ""))
        throw new Error(`docs/${entry}: docs-output ${match[1]} has no docs-check command`);
    }
  }
  return markers;
}

/* Every marked documentation command runs here or in the registry lane
   (bun run test:docs-registry), so no marked example can silently drift. */
function assertEveryMarkerExecuted(markers: Map<string, string>): void {
  const covered = new Set<string>([...extractedMarkers, ...registryMarkers]);
  const unexecuted = [...markers]
    .filter(([name]) => !covered.has(name))
    .map(([name, page]) => `${page}: ${name}`)
    .sort();
  if (unexecuted.length > 0)
    throw new Error(`documented commands not executed:\n  ${unexecuted.join("\n  ")}`);
}

const markers = documentedMarkers();
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
const journeys = await verifyJourneyExamples(binary, root);
const concepts = await verifyConceptExamples(binary, root);
const automation = await verifyAutomationExamples(binary, root);
const language = await verifyLanguageExamples(binary, root);
const languageReference = await verifyLanguageReferenceExamples(binary, root);
const authoring = await verifyAuthoringExamples(binary, root);
assertEveryMarkerExecuted(markers);
console.log(
  `Docs examples: ${checked} Markdown pages free of retired commands; ${visual.join("; ")}; JSON, Markdown, text, and SARIF verified.`,
);
for (const summary of [journeys, concepts, automation, language, languageReference, authoring])
  console.log(summary);
console.log(
  `All ${markers.size} documented command markers executed (${registryMarkers.length} in the registry lane).`,
);
