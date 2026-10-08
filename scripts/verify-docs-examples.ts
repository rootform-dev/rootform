#!/usr/bin/env bun

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { verifyAuthoringExamples } from "./docs-authoring-examples.ts";
import { verifyAutomationExamples } from "./docs-automation-examples.ts";
import { verifyConceptExamples } from "./docs-concept-examples.ts";
import { assertNoRetiredCommands, extractedMarkers } from "./docs-core-examples.ts";
import { verifyDocsCoverageExamples } from "./docs-coverage-examples.ts";
import { verifyJourneyExamples } from "./docs-journey-examples.ts";
import { verifyLanguageExamples } from "./docs-language-examples.ts";
import { verifyLanguageReferenceExamples } from "./docs-language-reference-examples.ts";
import { verifyLearningExamples } from "./docs-learning-examples.ts";
import { registryMarkers } from "./docs-registry-examples.ts";
import { verifyPlaygroundForms } from "./playground-forms.ts";

const root = resolve(import.meta.dir, "..");
const documentationOnly = process.argv.includes("--documentation-only");
if (process.argv.slice(2).some((argument) => argument !== "--documentation-only")) {
  throw new Error("usage: verify-docs-examples.ts [--documentation-only]");
}
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
// Full qualification preserves Explorer/Playground proof. Documentation CI
// executes public recipes and assertions without renderer or scenario builds.
const playgroundForms = documentationOnly ? [] : await verifyPlaygroundForms(binary, root);
if (!documentationOnly) {
  const coverage = await verifyDocsCoverageExamples(binary);
  console.log(
    `Coverage examples: ${coverage.assertions.form_kind} and ${coverage.state_assertions.form_kind}, four uninterpreted managed/data instances retained in each Form and Explorer payload.`,
  );
}
const plan = join(root, "examples/playground/event-driven-platform/head/plan.json");
const saved = join(root, "examples/playground/event-driven-platform/head/plan.tfplan");
const scratch = mkdtempSync(join(tmpdir(), "rf-docs-output-"));
const env = { ...process.env, ROOTFORM_SOURCE: root, ROOTFORM_HOME: join(scratch, "home") };
for (const extension of ["json", "md", "txt", "html"]) {
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
/* The baseline Pack has no target in this plan: every report is still written,
   and the verdict is no decision rather than a pass. */
for (const extension of ["json", "md", "txt", "sarif"]) {
  const output = join(scratch, `policy.${extension}`);
  const pack = join(root, "policy-packs/baseline");
  const result = Bun.spawnSync(
    [binary, "check", join(scratch, "analysis.json"), "--policy-pack", pack, "-o", output],
    { cwd: root, env, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 3 || !existsSync(output))
    throw new Error(`check ${extension} report failed: ${result.stderr.toString()}`);
  const report = readFileSync(output, "utf8");
  if (extension === "json" && JSON.parse(report).status !== "no_decision")
    throw new Error("check JSON result is not a no-decision result");
  if (extension === "sarif" && JSON.parse(report).version !== "2.1.0")
    throw new Error("check SARIF output is not SARIF 2.1.0");
}
const helpUsages: Array<[string, string]> = [
  ["run", "rootform run <input>"],
  ["check", "rootform check <input>"],
];
for (const [command, usage] of helpUsages) {
  const help = Bun.spawnSync([binary, command, "-h"], { stdout: "pipe", stderr: "pipe" });
  if (help.exitCode !== 0 || !help.stdout.toString().includes(usage))
    throw new Error(`${command} help differs from documentation`);
}
async function lane(name: string, verify: () => Promise<string>): Promise<string> {
  console.log(`Docs ${name}: started`);
  const start = performance.now();
  const result = await verify();
  console.log(`Docs ${name}: passed in ${((performance.now() - start) / 1000).toFixed(2)}s`);
  return result;
}
const journeys = await lane("journeys", () => verifyJourneyExamples(binary, root));
const concepts = await lane("concepts", () => verifyConceptExamples(binary, root));
const automation = await lane("automation", () => verifyAutomationExamples(binary, root));
const language = await lane("language", () => verifyLanguageExamples(binary, root));
const languageReference = await lane("language reference", () =>
  verifyLanguageReferenceExamples(binary, root),
);
const authoring = await lane("authoring", () => verifyAuthoringExamples(binary, root));
const learning = await lane("learning", () => verifyLearningExamples(binary, root));
assertEveryMarkerExecuted(markers);
console.log(
  `Docs examples: ${checked} Markdown pages free of retired commands; ${playgroundForms.join("; ")}; analysis JSON, Markdown, text, and HTML and Policy JSON, Markdown, text, and SARIF verified.`,
);
for (const summary of [
  journeys,
  concepts,
  automation,
  language,
  languageReference,
  authoring,
  learning,
])
  console.log(summary);
console.log(
  `${markers.size - registryMarkers.length} documented command markers executed locally; ${registryMarkers.length} require the separate registry lane.`,
);
