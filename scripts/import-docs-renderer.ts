import { createHash } from "node:crypto";
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Import reviewed opaque capture output; never acquire or read producer source.
const input = process.argv[2];
if (!input)
  throw new Error("Usage: bun scripts/import-docs-renderer.ts /absolute/capture-directory");
const output = resolve(import.meta.dir, "../docs/assets/renderer");
const manifestBytes = readFileSync(resolve(input, "manifest.json"));
const manifest = JSON.parse(manifestBytes.toString("utf8"));
if (manifest.format_version !== "1") throw new Error("Unknown renderer evidence format.");

const fixtures = [
  "commerce-platform-base",
  "commerce-platform-head",
  "event-driven-platform-base",
  "event-driven-platform-head",
  "shared-data-platform-base",
  "shared-data-platform-head",
];
const comparisons = ["commerce-platform", "event-driven-platform", "shared-data-platform"];
if (JSON.stringify(Object.keys(manifest.fixtures).sort()) !== JSON.stringify(fixtures.sort()))
  throw new Error("Unexpected renderer fixture inventory.");
if (JSON.stringify(Object.keys(manifest.comparisons).sort()) !== JSON.stringify(comparisons.sort()))
  throw new Error("Unexpected renderer comparison inventory.");

const files = [
  "commerce-platform-base.json",
  "commerce-platform-head.json",
  "commerce-platform-diff.json",
  "commerce-platform-presentation.json",
  "event-driven-platform-base.json",
  "event-driven-platform-head.json",
  "event-driven-platform-diff.json",
  "event-driven-platform-presentation.json",
  "shared-data-platform-base.json",
  "shared-data-platform-head.json",
  "shared-data-platform-diff.json",
  "shared-data-platform-presentation.json",
];
const architectureFixture: Record<string, string> = {
  "commerce-platform-base.json": "commerce-platform-base",
  "commerce-platform-head.json": "commerce-platform-head",
  "event-driven-platform-base.json": "event-driven-platform-base",
  "event-driven-platform-head.json": "event-driven-platform-head",
  "shared-data-platform-base.json": "shared-data-platform-base",
  "shared-data-platform-head.json": "shared-data-platform-head",
};
const diffComparison: Record<string, string> = {
  "commerce-platform-diff.json": "commerce-platform",
  "event-driven-platform-diff.json": "event-driven-platform",
  "shared-data-platform-diff.json": "shared-data-platform",
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

for (const stale of readdirSync(output).filter(
  (file) => file.endsWith(".json") && !files.includes(file) && file !== "interactive.json",
)) {
  unlinkSync(resolve(output, stale));
}
for (const [file, bytes] of pending) writeFileSync(resolve(output, file), bytes);
writeFileSync(resolve(output, "manifest.json"), manifestBytes);
writeFileSync(
  resolve(output, "interactive.json"),
  `${JSON.stringify({ format_version: "1", files: hashes }, null, 2)}\n`,
);
console.log(`Imported ${files.length} renderer inputs.`);
