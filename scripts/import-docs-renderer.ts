import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Import reviewed opaque capture output; never acquire or read producer source.
const input = process.argv[2];
if (!input)
  throw new Error("Usage: bun scripts/import-docs-renderer.ts /absolute/capture-directory");
const output = resolve(import.meta.dir, "../docs/assets/renderer");
const manifestBytes = readFileSync(resolve(input, "manifest.json"));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
if (manifest.format_version !== "1") throw new Error("Unknown renderer evidence format.");

const fixtures = ["azure-platform", "azure-platform-next", "multicloud-base", "multicloud"];
const comparisons = ["commerce-platform", "shared-data-platform"];
if (JSON.stringify(Object.keys(manifest.fixtures).sort()) !== JSON.stringify(fixtures.sort()))
  throw new Error("Unexpected renderer fixture inventory.");
if (JSON.stringify(Object.keys(manifest.comparisons).sort()) !== JSON.stringify(comparisons.sort()))
  throw new Error("Unexpected renderer comparison inventory.");

const files = [
  "azure-platform.json",
  "azure-platform-next.json",
  "multicloud-base.json",
  "multicloud.json",
  "azure-delta.json",
  "multicloud-delta.json",
  "azure-platform-presentation.json",
  "multicloud-presentation.json",
];
const architectureFixture: Record<string, string> = {
  "azure-platform.json": "azure-platform",
  "azure-platform-next.json": "azure-platform-next",
  "multicloud-base.json": "multicloud-base",
  "multicloud.json": "multicloud",
};
const diffComparison: Record<string, string> = {
  "azure-delta.json": "commerce-platform",
  "multicloud-delta.json": "shared-data-platform",
};
const hashes: Record<string, string> = {};
const pending: [string, Buffer][] = [];
for (const file of files) {
  const bytes = readFileSync(resolve(input, file));
  if (bytes.length > 1024 * 1024) throw new Error(`Renderer evidence exceeds bound: ${file}`);
  const value = JSON.parse(bytes.toString("utf8"));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const fixture = architectureFixture[file];
  const comparison = diffComparison[file];
  const expected = fixture
    ? manifest.fixtures[fixture]?.architecture_sha256
    : comparison
      ? manifest.comparisons[comparison]?.sha256
      : undefined;
  if (expected && hash !== expected)
    throw new Error(`Evidence differs from reviewed capture: ${file}`);
  if (file.endsWith("-presentation.json") && value.format_version !== "1")
    throw new Error(`Unknown presentation format: ${file}`);
  if (/\/Users\/|\/home\/|[A-Z]:\\\\/u.test(bytes.toString("utf8")))
    throw new Error(`Evidence contains a machine path: ${file}`);
  hashes[file] = hash;
  pending.push([file, bytes]);
}

const figures = Object.entries(manifest.figures) as [string, { sha256: string }][];
if (figures.length !== 20) throw new Error("Unexpected renderer figure inventory.");
for (const [file, evidence] of figures) {
  if (!/^[a-z-]+\.png$/u.test(file)) throw new Error(`Invalid renderer figure path: ${file}`);
  const bytes = readFileSync(resolve(input, file));
  if (bytes.length > 5 * 1024 * 1024) throw new Error(`Renderer figure exceeds bound: ${file}`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== evidence.sha256) throw new Error(`Renderer figure digest differs: ${file}`);
  pending.push([file, bytes]);
}

for (const [file, bytes] of pending) writeFileSync(resolve(output, file), bytes);
writeFileSync(resolve(output, "manifest.json"), manifestBytes);
writeFileSync(
  resolve(output, "interactive.json"),
  `${JSON.stringify({ format_version: "1", files: hashes }, null, 2)}\n`,
);
console.log(`Imported ${files.length} renderer inputs and ${figures.length} reviewed figures.`);
