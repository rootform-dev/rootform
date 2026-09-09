import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkNavigation,
  checkPage,
  checkPages,
  collectNavigation,
  deriveRoute,
  findDuplicateRoutes,
  findPlaceholders,
  parseFrontmatter,
  parseRelativeMarkdownLinks,
  resolveRepositoryLink,
} from "./check-docs.ts";

test("deriveRoute maps documented page paths to page ids", () => {
  expect(deriveRoute("docs/index.md")).toBe("index");
  expect(deriveRoute("docs/README.md")).toBe("index");
  expect(deriveRoute("docs/foo/index.md")).toBe("foo");
  expect(deriveRoute("docs/foo/README.md")).toBe("foo");
  expect(deriveRoute("docs/cli.md")).toBe("cli");
  expect(deriveRoute("docs/guides/install.md")).toBe("guides/install");
  expect(deriveRoute("index.md")).toBe("index");
  expect(deriveRoute("README.md")).toBe("index");
});

test("findDuplicateRoutes reports index and directory route collisions", () => {
  const duplicates = findDuplicateRoutes([
    "docs/cli.md",
    "docs/index.md",
    "docs/README.md",
    "docs/guides/index.md",
    "docs/guides/README.md",
  ]);
  expect(duplicates.map((duplicate) => duplicate.route)).toEqual(["guides", "index"]);
  const index = duplicates.find((duplicate) => duplicate.route === "index");
  expect(index?.files).toEqual(["docs/index.md", "docs/README.md"]);
});

test("parseFrontmatter returns null without a frontmatter block", () => {
  expect(parseFrontmatter("# Title\n\nbody")).toBeNull();
});

test("parseFrontmatter reads title and description", () => {
  const frontmatter = parseFrontmatter(
    [
      "---",
      "title: Install Rootform",
      "description: Download the binary and verify its checksum.",
      "---",
      "",
      "# Install Rootform",
    ].join("\n"),
  );
  expect(frontmatter).toEqual({
    title: "Install Rootform",
    description: "Download the binary and verify its checksum.",
  });
});

test("parseFrontmatter rejects a non-mapping block", () => {
  expect(() => parseFrontmatter(["---", "- one", "- two", "---", ""].join("\n"))).toThrow(
    "frontmatter is not a mapping",
  );
});

test("parseFrontmatter rejects malformed YAML", () => {
  expect(() => parseFrontmatter(["---", "title: [unclosed", "---", ""].join("\n"))).toThrow(
    "frontmatter is not valid YAML",
  );
});

test("parseFrontmatter treats empty title and description as missing", () => {
  const frontmatter = parseFrontmatter(
    ["---", "title: ''", "description:   ", "---", ""].join("\n"),
  );
  expect(frontmatter?.title).toBeUndefined();
  expect(frontmatter?.description).toBeUndefined();
});

test("findPlaceholders flags todo, lorem, and coming soon outside code", () => {
  const text = [
    "TODO: write the example.",
    "This explains lorem ipsum text.",
    "The page is coming soon.",
    "A coming-soon variant.",
    "",
    "```sh",
    "TODO: not flagged inside a fence",
    "echo lorem ipsum",
    "```",
    "The `TODO` token inside inline code is not flagged.",
  ].join("\n");
  expect(findPlaceholders(text).map((placeholder) => placeholder.kind)).toEqual([
    "todo",
    "lorem",
    "coming-soon",
    "coming-soon",
  ]);
});

test("parseRelativeMarkdownLinks keeps relative markdown links with fragments", () => {
  const links = parseRelativeMarkdownLinks(
    [
      "See [install](installation.md#checksum) and [concepts](../concepts.md).",
      "Skip [external](https://example.com/page.md), [mail](mailto:x@example.com), " +
        "[root](/docs/cli.md), and [image](icon.png).",
      "[fragment only](#section) is skipped.",
      "",
      "```md",
      "[hidden](../hidden.md)",
      "```",
    ].join("\n"),
  );
  expect(links).toEqual([
    { line: 1, target: "installation.md#checksum" },
    { line: 1, target: "../concepts.md" },
  ]);
});

test("resolveRepositoryLink strips fragments and normalizes within the repository", () => {
  expect(resolveRepositoryLink("docs/guides/install.md", "../concepts.md#intro")).toBe(
    "docs/concepts.md",
  );
  expect(resolveRepositoryLink("docs/guides/install.md", "./usage.md")).toBe(
    "docs/guides/usage.md",
  );
  expect(resolveRepositoryLink("docs/cli.md", "README.md")).toBe("docs/README.md");
  expect(resolveRepositoryLink("docs/guides/install.md", "../../README.md")).toBe("README.md");
  expect(resolveRepositoryLink("docs/cli.md", "../../../escape.md")).toBeNull();
});

test("checkPage flags missing frontmatter, placeholders, and dangling links", () => {
  const issues = checkPage(
    "docs/cli.md",
    ["# Cli", "", "TODO: describe exit codes.", "See [missing](missing.md)."].join("\n"),
    new Set(["docs/cli.md"]),
  );
  expect(issues.some((issue) => issue.kind === "frontmatter")).toBe(true);
  expect(issues.some((issue) => issue.kind === "placeholder")).toBe(true);
  const link = issues.find((issue) => issue.kind === "link");
  expect(link?.detail).toContain("missing.md");
});

test("checkPage flags links that escape the repository", () => {
  const issues = checkPage(
    "docs/cli.md",
    ["---", "title: Cli", "description: Commands.", "---", "", "[out](../../../out.md)"].join("\n"),
    new Set(),
  );
  const link = issues.find((issue) => issue.kind === "link");
  expect(link?.detail).toContain("escapes");
});

test("checkPage passes a conforming page", () => {
  const issues = checkPage(
    "docs/cli.md",
    [
      "---",
      "title: CLI",
      "description: Rootform command reference.",
      "---",
      "",
      "# CLI",
      "",
      "See [concepts](../docs/concepts.md) for context.",
    ].join("\n"),
    new Set(["docs/cli.md", "docs/concepts.md"]),
  );
  expect(issues).toEqual([]);
});

test("checkPage flags an empty page and empty frontmatter values", () => {
  const issues = checkPage(
    "docs/empty.md",
    ["---", "title: ''", "description: ''", "---"].join("\n"),
    new Set(),
  );
  expect(issues.map((issue) => issue.kind).sort()).toEqual(["description", "empty-page", "title"]);
});

test("collectNavigation reports shape errors, duplicate labels, and duplicate pages", () => {
  const shape = collectNavigation([
    { label: "Start", items: ["index"] },
    {
      label: "Reference",
      items: [
        { label: "Commands", items: ["cli", "check"] },
        { label: "CLI", page: "cli" },
        { label: "CLI", page: "cli" },
      ],
    },
    { label: "Broken", items: [42] },
  ]);
  expect(shape.leaves).toEqual(["check", "cli", "index"]);
  expect(shape.duplicatePages).toEqual(['page "cli" appears 3 times']);
  expect(shape.duplicateLabels).toEqual(['navigation > Reference: label "CLI" repeats']);
  expect(shape.shapeErrors).toEqual([
    "navigation > Broken: entry must be a page id, a group, or a leaf",
  ]);
});

test("collectNavigation rejects a non-array root and malformed groups", () => {
  const shape = collectNavigation({ label: "Not a list", items: [] });
  expect(shape.shapeErrors).toContain("navigation must be an array of groups");
  const malformed = collectNavigation([
    { label: "No items" },
    { items: ["index"] },
    { label: 5, items: [] },
  ]);
  expect(malformed.shapeErrors).toEqual([
    "navigation > No items: items must be an array",
    "navigation: group is missing a label",
    "navigation: group is missing a label",
  ]);
});

test("checkNavigation reports leaves without a matching page", () => {
  const result = checkNavigation(
    [
      { label: "Start", items: ["index"] },
      { label: "Tools", items: ["cli", "phantom"] },
    ],
    new Set(["index", "cli"]),
  );
  expect(result.missingPages).toEqual(["phantom"]);
});

test("checkPages reports duplicate routes and per-page issues together", () => {
  const result = checkPages(
    [
      {
        path: "docs/index.md",
        text: ["---", "title: Home", "description: Start here.", "---", "", "Home."].join("\n"),
      },
      {
        path: "docs/README.md",
        text: ["# Readme", "", "no frontmatter"].join("\n"),
      },
    ],
    new Set(["docs/index.md", "docs/README.md"]),
  );
  const route = result.issues.find((issue) => issue.kind === "route");
  expect(route?.detail).toContain('route "index" collides');
  expect(result.issues.some((issue) => issue.kind === "frontmatter")).toBe(true);
});

test("installation documentation keeps supported methods in recommendation order", () => {
  const page = readFileSync(join(import.meta.dir, "../docs/installation.md"), "utf8");
  const section = (start: string, end: string) => {
    const from = page.indexOf(start);
    const to = page.indexOf(end, from + start.length);
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThan(from);
    return page.slice(from, to);
  };
  const expectOrder = (text: string, values: string[]) => {
    const positions = values.map((value) => text.indexOf(value));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  };

  expectOrder(section("<!-- rootform:tab macOS -->", "<!-- rootform:tab Linux -->"), [
    "**Recommended**",
    "curl -fsSL https://rootform.dev/install | sh",
    "**Verify**",
    "rootform version",
    "**Other options**",
    "brew install --cask rootform",
  ]);
  expectOrder(section("<!-- rootform:tab Linux -->", "<!-- rootform:tab Windows -->"), [
    "**Recommended**",
    "curl -fsSL https://rootform.dev/install | sh",
    "**Verify**",
    "rootform version",
  ]);
  expectOrder(section("<!-- rootform:tab Windows -->", "<!-- rootform:tab Container -->"), [
    "**Recommended**",
    "Invoke-RestMethod https://rootform.dev/install.ps1 | Invoke-Expression",
    "**Verify**",
    "rootform version",
    "**Other options**",
    "winget install --id Rootform.Rootform --exact",
  ]);
  expectOrder(section("<!-- rootform:tab Container -->", "<!-- rootform:endtabs -->"), [
    "**Recommended**",
    "docker pull ghcr.io/rootform-dev/rootform:0.1.0",
    "**Verify**",
    "docker run --rm ghcr.io/rootform-dev/rootform:0.1.0 rootform version",
    "[Container usage →](integrations/oci-image.md)",
  ]);
  expectOrder(page, [
    "<!-- rootform:endtabs -->",
    "## Manual installation",
    "SHA256SUMS",
    "[your first architecture →](getting-started/first-architecture.md)",
  ]);
  expect(page.match(/<!-- rootform:tabs /gu)).toHaveLength(1);
  expect(page.match(/<!-- rootform:tab /gu)).toHaveLength(4);
  expect(page.match(/\*\*Recommended\*\*/gu)).toHaveLength(4);
  expect(page.match(/\*\*Verify\*\*/gu)).toHaveLength(4);
  expect(page.match(/\*\*Other options\*\*/gu)).toHaveLength(2);
  expect(page.match(/^## Manual installation$/gmu)).toHaveLength(1);
  expect(page).not.toMatch(/^## (?:macOS|Linux|Windows|Container)$/gmu);
  expect(page).not.toContain("## Manual downloads");
  expect(page).not.toContain("Manual download →");
  expect(page).not.toContain("installation/manual.md");
  expect(page).not.toContain("A successful verification prints");
  expect(page).not.toContain("rootform.dev/install.sh");
  expect(page).not.toMatch(/Node\.js|Python/u);
  expect(page).toContain("first run may need network access to download any required\n[Dialects]");
});

test("Dialect authoring keeps presentation, publication, and use in one numbered workflow", () => {
  const page = readFileSync(join(import.meta.dir, "../docs/dialect-authoring.md"), "utf8");
  const start = page.indexOf("<!-- rootform:steps -->");
  const end = page.indexOf("<!-- rootform:endsteps -->");
  const workflow = page.slice(start, end);
  const headings = [
    "## Keep presentation separate",
    "## Package and publish a Dialect",
    "## Use a published Dialect",
  ];

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const positions = headings.map((heading) => workflow.indexOf(heading));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
  expect(workflow).toContain('```json title="aws/presentation.json"');
  expect(workflow).toContain('"format_version": "1"');
  expect(workflow).toContain('"rules": {');
  expect(workflow).toContain('"concepts": {}');
  expect(workflow).toContain('"rule_labels": {');
  expect(workflow).toContain('"concept_labels": {}');
  expect(workflow).toContain("`rootform package dialects` is strict");
});
