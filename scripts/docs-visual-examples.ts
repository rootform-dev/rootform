import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildRendererPresentation,
  validateRendererPresentation,
} from "./renderer-presentation.ts";

const families = ["commerce-platform", "event-driven-platform", "shared-data-platform"] as const;
const sides = ["base", "head"] as const;
const inputNames = [
  "main.tf",
  "plan.json",
  "plan.tfplan",
  ".terraform.lock.hcl",
  "rootform.lock",
] as const;
const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const bytes = (path: string) => readFileSync(path);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Docs visuals: ${message}`);
}
function documentFiles(): string[] {
  return families.flatMap((family) => [
    `${family}-analysis.json`,
    `${family}-comparison.json`,
    `${family}-presentation.json`,
  ]);
}
function eventPlacement(document: unknown): void {
  const analysis = document as {
    kind: string;
    stages: {
      planned: {
        representations: Array<{ id: string }>;
        contexts: Array<{ from: string; to: string; dimension: string; provenance: unknown[] }>;
        relations: Array<{ from: string; to: string; predicate: string; provenance: unknown[] }>;
      };
    };
  };
  assert(analysis.kind === "plan" && analysis.stages?.planned, "event analysis must be a plan");
  const stage = analysis.stages.planned;
  const rep = (address: string) => `representation:1:${address}`;
  const eventTopic = "azurerm_eventgrid_system_topic.docs";
  const busTopic = "azurerm_servicebus_topic.claims_events";
  const systemSubscriptions = [
    "docs_claims_events",
    "docs_fraud_scoring",
    "docs_intake",
    "docs_review_queue",
    "docs_scan_queue",
    "docs_telemetry",
  ].map((name) => `azurerm_eventgrid_system_topic_event_subscription.${name}`);
  const busSubscriptions = ["claims_events_fraud_audit", "claims_events_notifications"].map(
    (name) => `azurerm_servicebus_subscription.${name}`,
  );
  const genericSubscriptions: Array<[string, string]> = [
    ["claims_scored_review", "claims_scored"],
    ["claims_submitted_events", "claims_submitted"],
    ["claims_submitted_intake", "claims_submitted"],
    ["documents_processed_telemetry", "documents_processed"],
  ];
  const parentPairs: Array<[string, string]> = [
    ...systemSubscriptions.map((child) => [child, eventTopic] as [string, string]),
    ...busSubscriptions.map((child) => [child, busTopic] as [string, string]),
    ...genericSubscriptions.map(
      ([name, topic]) =>
        [
          `azurerm_eventgrid_event_subscription.${name}`,
          `azurerm_eventgrid_domain_topic.${topic}`,
        ] as [string, string],
    ),
    [eventTopic, "azurerm_resource_group.data"],
    [busTopic, "azurerm_servicebus_namespace.prod"],
    ["azurerm_servicebus_namespace.prod", "azurerm_resource_group.prod"],
  ];
  for (const [child, parent] of parentPairs) {
    const context = stage.contexts.find(
      (item) =>
        item.from === rep(child) &&
        item.to === rep(parent) &&
        item.dimension === "azure.context.ownership",
    );
    assert(context?.provenance.length, `${child}: ownership placement or provenance missing`);
  }
  for (const [child, parent] of parentPairs.slice(0, 12)) {
    const relation = stage.relations.find(
      (item) =>
        item.from === rep(child) &&
        item.to === rep(parent) &&
        item.predicate === "azure.relation.subscribes-to",
    );
    assert(relation?.provenance.length, `${child}: subscribes-to evidence missing`);
  }
  for (const child of systemSubscriptions) {
    const delivered = stage.relations.filter(
      (item) => item.from === rep(child) && item.predicate === "azure.relation.delivers-to",
    );
    assert(
      delivered.length === 1 && delivered[0]?.provenance.length,
      `${child}: delivery evidence missing`,
    );
  }
  const placed = new Set(stage.contexts.map((item) => item.from));
  assert(
    stage.representations.filter((item) => !placed.has(item.id)).length === 6,
    "event architecture changed its six expected root instances",
  );
}
function sourceFiles(root: string, family: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const side of sides) {
    const dir = join(root, "examples/playground", family, side);
    result[side] = {};
    for (const name of inputNames) {
      const path = join(dir, name);
      assert(existsSync(path), `${family}/${side}/${name} missing`);
      result[side][name] = hash(bytes(path));
    }
  }
  return result;
}
function run(binary: string, root: string, home: string, args: string[]): void {
  const result = Bun.spawnSync([binary, "run", ...args], {
    cwd: root,
    env: { ...process.env, ROOTFORM_HOME: home, ROOTFORM_SOURCE: root },
    stdout: "pipe",
    stderr: "pipe",
  });
  assert(
    result.exitCode === 0,
    `${args.join(" ")}: ${result.stderr.toString()}${result.stdout.toString()}`,
  );
}
function analyze(binary: string, root: string, home: string, family: string, out: string): void {
  const head = `examples/playground/${family}/head`;
  run(binary, root, home, [
    `${head}/plan.json`,
    "--plan-file",
    `${head}/plan.tfplan`,
    "--project",
    head,
    "--require-enrichment",
    "--no-serve",
    "-o",
    out,
  ]);
}
function compare(binary: string, root: string, home: string, family: string, out: string): void {
  const base = `examples/playground/${family}/base`;
  const head = `examples/playground/${family}/head`;
  run(binary, root, home, [
    `${base}/plan.json`,
    "--diff",
    `${head}/plan.json`,
    "--plan-file",
    `${base}/plan.tfplan`,
    "--diff-plan-file",
    `${head}/plan.tfplan`,
    "--project",
    head,
    "--require-enrichment",
    "--no-serve",
    "-o",
    out,
  ]);
}
export function generateVisualExamples(binary: string, root: string): string[] {
  const dir = join(root, "docs/assets/renderer");
  const home = mkdtempSync(join(tmpdir(), "rf-docs-home-"));
  const manifest: {
    format_version: "1";
    binary: { version: string; sha256: string };
    examples: Record<
      string,
      { inputs: Record<string, Record<string, string>>; documents: Record<string, string> }
    >;
  } = { format_version: "1", binary: { version: "", sha256: hash(bytes(binary)) }, examples: {} };
  const version = Bun.spawnSync([binary, "version"], { stdout: "pipe", stderr: "pipe" });
  assert(version.exitCode === 0, "binary version unavailable");
  manifest.binary.version = version.stdout.toString().trim();
  const interactive: { format_version: "1"; files: Record<string, string> } = {
    format_version: "1",
    files: {},
  };
  const presentationCatalog = buildRendererPresentation(root);
  for (const family of families) {
    const analysis = `${family}-analysis.json`;
    const comparison = `${family}-comparison.json`;
    const presentation = `${family}-presentation.json`;
    writeFileSync(join(dir, presentation), presentationCatalog);
    analyze(binary, root, home, family, join(dir, analysis));
    compare(binary, root, home, family, join(dir, comparison));
    const parsedAnalysis = JSON.parse(bytes(join(dir, analysis)).toString());
    const parsedComparison = JSON.parse(bytes(join(dir, comparison)).toString());
    assert(
      parsedAnalysis.kind === "plan" && parsedAnalysis.format_version === "1",
      `${analysis} invalid kind`,
    );
    assert(
      parsedComparison.kind === "comparison" && parsedComparison.format_version === "1",
      `${comparison} invalid kind`,
    );
    validateRendererPresentation(
      JSON.parse(bytes(join(dir, presentation)).toString()),
      presentation,
    );
    if (family === "event-driven-platform") eventPlacement(parsedAnalysis);
    const documents: Record<string, string> = {};
    for (const file of [analysis, comparison, presentation]) {
      const digest = hash(bytes(join(dir, file)));
      documents[file] = digest;
      interactive.files[file] = digest;
    }
    manifest.examples[family] = { inputs: sourceFiles(root, family), documents };
  }
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(dir, "interactive.json"), `${JSON.stringify(interactive, null, 2)}\n`);
  return documentFiles();
}
export async function verifyVisualExamples(binary: string, root: string): Promise<string[]> {
  const dir = join(root, "docs/assets/renderer");
  const manifest = JSON.parse(bytes(join(dir, "manifest.json")).toString());
  const interactive = JSON.parse(bytes(join(dir, "interactive.json")).toString());
  assert(manifest.format_version === "1" && interactive.format_version === "1", "format mismatch");
  assert(manifest.binary.sha256 === hash(bytes(binary)), "binary digest mismatch");
  assert(
    JSON.stringify(Object.keys(interactive.files).sort()) ===
      JSON.stringify(documentFiles().sort()),
    "interactive inventory mismatch",
  );
  for (const family of families) {
    const item = manifest.examples[family];
    assert(
      item && JSON.stringify(item.inputs) === JSON.stringify(sourceFiles(root, family)),
      `${family}: input digest changed`,
    );
    for (const [file, digest] of Object.entries(item.documents) as Array<[string, string]>) {
      assert(
        digest === hash(bytes(join(dir, file))) && interactive.files[file] === digest,
        `${file}: digest changed`,
      );
    }
    validateRendererPresentation(
      JSON.parse(bytes(join(dir, `${family}-presentation.json`)).toString()),
      family,
    );
    assert(
      bytes(join(dir, `${family}-presentation.json`)).toString() ===
        buildRendererPresentation(root),
      `${family}: presentation catalog changed`,
    );
  }
  eventPlacement(JSON.parse(bytes(join(dir, "event-driven-platform-analysis.json")).toString()));
  const scratch = mkdtempSync(join(tmpdir(), "rf-docs-verify-"));
  const home = join(scratch, "home");
  mkdirSync(home);
  for (const family of families) {
    const analysis = join(scratch, `${family}-analysis.json`);
    const comparison = join(scratch, `${family}-comparison.json`);
    analyze(binary, root, home, family, analysis);
    compare(binary, root, home, family, comparison);
    for (const file of [analysis, comparison]) {
      const expected = join(dir, file.split("/").at(-1) ?? "");
      assert(hash(bytes(file)) === hash(bytes(expected)), `${file}: binary output changed`);
    }
  }
  return [
    "six plan inputs and verified saved-plan pairs",
    "three analysis and three comparison documents",
    "nine pinned renderer inputs",
  ];
}
if (import.meta.main) {
  const binary = process.env.ROOTFORM_BIN;
  assert(binary && existsSync(binary), "ROOTFORM_BIN must name an executable");
  const root = join(import.meta.dir, "..");
  if (process.argv.includes("--generate"))
    console.log(generateVisualExamples(binary, root).join("\n"));
  else console.log((await verifyVisualExamples(binary, root)).join("\n"));
}
