#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { copyFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateRendererPresentation } from "./renderer-presentation.ts";

const source = process.argv[2];
if (!source)
  throw new Error("Usage: bun scripts/import-docs-renderer.ts /absolute/capture-directory");
const input = resolve(source);
const output = resolve(import.meta.dir, "../docs/assets/renderer");
const families = ["commerce-platform", "event-driven-platform", "shared-data-platform"];
const files = families.flatMap((family) => [
  `${family}-analysis.json`,
  `${family}-comparison.json`,
  `${family}-presentation.json`,
]);
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const manifest = JSON.parse(readFileSync(resolve(input, "manifest.json"), "utf8"));
const interactive = JSON.parse(readFileSync(resolve(input, "interactive.json"), "utf8"));
if (manifest.format_version !== "1" || interactive.format_version !== "1") {
  throw new Error("Unknown renderer input format");
}
if (JSON.stringify(Object.keys(interactive.files).sort()) !== JSON.stringify([...files].sort())) {
  throw new Error("Renderer input inventory differs from the nine expected files");
}
for (const family of families) {
  const entry = manifest.examples?.[family];
  if (!entry?.inputs?.base || !entry.inputs?.head)
    throw new Error(`${family}: missing source inputs`);
  for (const file of files.filter((name) => name.startsWith(`${family}-`))) {
    const path = resolve(input, file);
    const data = readFileSync(path);
    if (data.length > 16 * 1024 * 1024) throw new Error(`${file}: exceeds size limit`);
    const value = JSON.parse(data.toString("utf8"));
    if (file.endsWith("-presentation.json")) validateRendererPresentation(value, file);
    else if (
      value.format_version !== "1" ||
      value.kind !== (file.endsWith("-analysis.json") ? "plan" : "comparison")
    ) {
      throw new Error(`${file}: unexpected document kind`);
    }
    if (entry.documents?.[file] !== sha256(path) || interactive.files[file] !== sha256(path)) {
      throw new Error(`${file}: digest mismatch`);
    }
    if (/\/Users\/|\/home\/|[A-Z]:\\\\/u.test(data.toString("utf8"))) {
      throw new Error(`${file}: machine path in renderer input`);
    }
  }
}
for (const file of [...files, "manifest.json", "interactive.json"]) {
  copyFileSync(resolve(input, file), resolve(output, file));
}
console.log(`Imported ${files.length} renderer inputs.`);
