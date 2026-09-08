import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Import reviewed opaque capture output; never acquire or read producer source.
const input = process.argv[2];
if (!input)
  throw new Error("Usage: bun scripts/import-docs-renderer.ts /absolute/capture-directory");
const output = resolve(import.meta.dir, "../docs/assets/renderer");
const manifest = JSON.parse(readFileSync(resolve(output, "manifest.json"), "utf8"));
const files = [
  "azure-platform.json",
  "azure-platform-next.json",
  "multicloud.json",
  "azure-delta.json",
  "azure-platform-presentation.json",
  "multicloud-presentation.json",
];
const hashes: Record<string, string> = {};
const pending: [string, Buffer][] = [];
for (const file of files) {
  const bytes = readFileSync(resolve(input, file));
  if (bytes.length > 1024 * 1024) throw new Error(`Renderer evidence exceeds bound: ${file}`);
  const value = JSON.parse(bytes.toString("utf8"));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const expected =
    file === "azure-delta.json"
      ? manifest.comparison.sha256
      : manifest.fixtures[file.replace(/\.json$/u, "")]?.architecture_sha256;
  if (expected && hash !== expected)
    throw new Error(`Evidence differs from reviewed capture: ${file}`);
  if (file.endsWith("-presentation.json") && value.format_version !== "1")
    throw new Error(`Unknown presentation format: ${file}`);
  if (/\/Users\/|\/home\/|[A-Z]:\\\\/u.test(bytes.toString("utf8")))
    throw new Error(`Evidence contains a machine path: ${file}`);
  hashes[file] = hash;
  pending.push([file, bytes]);
}
for (const [file, bytes] of pending) writeFileSync(resolve(output, file), bytes);
writeFileSync(
  resolve(output, "interactive.json"),
  `${JSON.stringify({ format_version: "1", files: hashes }, null, 2)}\n`,
);
console.log(`Imported ${pending.length} reviewed renderer inputs.`);
