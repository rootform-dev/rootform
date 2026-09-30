import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  documentationFiles,
  findDownloads,
  pinDownloads,
  releaseTag,
  unpinnedDownloads,
} from "./pin-docs-downloads.ts";

const root = join(import.meta.dir, "..");
const plan = "https://raw.githubusercontent.com/rootform-dev/rootform/dev/examples/plan.json";

test("release tags follow the exact release version", () => {
  expect(releaseTag("0.1.0")).toBe("v0.1.0");
  expect(releaseTag("0.2.0-rc.1")).toBe("v0.2.0-rc.1");
  expect(() => releaseTag("v0.1.0")).toThrow("invalid release version");
});

test("pinning moves every repository download to the release tag", () => {
  const text = [
    "```sh",
    `curl -fsSLO ${plan}`,
    "curl -fsSLO https://raw.githubusercontent.com/rootform-dev/rootform/v0.0.9/examples/plan.tfplan",
    "curl -fsSLO https://raw.githubusercontent.com/rootform-dev/action/dev/README.md",
    "```",
  ].join("\n");
  const pinned = pinDownloads(text, "v0.1.0");
  expect(pinned).toContain(
    "https://raw.githubusercontent.com/rootform-dev/rootform/v0.1.0/examples/plan.json",
  );
  expect(pinned).toContain(
    "https://raw.githubusercontent.com/rootform-dev/rootform/v0.1.0/examples/plan.tfplan",
  );
  expect(pinned).toContain("https://raw.githubusercontent.com/rootform-dev/action/dev/README.md");
  expect(unpinnedDownloads(findDownloads("page.md", pinned), "v0.1.0")).toEqual([]);
  expect(pinDownloads(pinned, "v0.1.0")).toBe(pinned);
});

test("the check names each download that still follows a branch", () => {
  const downloads = findDownloads("docs/page.md", `intro\n\ncurl -fsSLO ${plan}\n`);
  expect(unpinnedDownloads(downloads, "v0.1.0")).toEqual([
    { file: "docs/page.md", line: 3, path: "examples/plan.json", ref: "dev" },
  ]);
});

test("documentation downloads name files this repository tracks", () => {
  const downloads = documentationFiles(root).flatMap((file) =>
    findDownloads(file, readFileSync(join(root, file), "utf8")),
  );
  expect(downloads.length).toBeGreaterThan(0);
  for (const { file, line, path } of downloads) {
    expect(existsSync(join(root, path)), `${file}:${line} downloads ${path}`).toBeTrue();
  }
});
