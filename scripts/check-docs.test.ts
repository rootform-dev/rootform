import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkNavigation,
  checkPage,
  checkPages,
  collectNavigation,
  deriveRoute,
  findDuplicateRoutes,
  findPlaceholders,
  loadRenderedAnchors,
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
      "[fragment only](#section) targets this page.",
      "",
      "```md",
      "[hidden](../hidden.md)",
      "```",
    ].join("\n"),
  );
  expect(links).toEqual([
    { line: 1, target: "installation.md#checksum" },
    { line: 1, target: "../concepts.md" },
    { line: 3, target: "#section" },
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
  expect(resolveRepositoryLink("docs/cli.md", "#section")).toBe("docs/cli.md");
});

test("rendered HTML IDs validate cross-page and current-page fragments", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rootform-docs-anchors-"));
  try {
    mkdirSync(join(directory, "concepts", "diff"), { recursive: true });
    writeFileSync(
      join(directory, "concepts", "diff", "index.html"),
      '<main><h2 id="undetermined-preserves-uncertainty">Unknown</h2></main>',
    );
    mkdirSync(join(directory, "inputs"), { recursive: true });
    writeFileSync(
      join(directory, "inputs", "index.html"),
      '<main><h2 id="reuse-a-saved-architecture">Saved</h2></main>',
    );
    const sources = [
      { path: "docs/concepts/diff.md", text: "## Unknown" },
      {
        path: "docs/inputs/index.md",
        text: [
          "---",
          "title: Choose an input",
          "description: Select an input.",
          "---",
          "",
          "[valid](../concepts/diff.md#undetermined-preserves-uncertainty)",
          "[broken](../concepts/diff.md#semantic-changes-need-separate-review)",
          "[local](#reuse-a-saved-architecture)",
          "[local broken](#missing-local-section)",
        ].join("\n"),
      },
    ];
    const anchors = await loadRenderedAnchors(sources, directory);
    const issues = checkPage(
      sources[1]?.path ?? "",
      sources[1]?.text ?? "",
      new Set(sources.map((source) => source.path)),
      anchors,
    );
    expect(
      issues.filter((issue) => issue.kind === "fragment").map((issue) => issue.detail),
    ).toEqual([
      expect.stringContaining("semantic-changes-need-separate-review"),
      expect.stringContaining("missing-local-section"),
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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

test("navigation exposes plan and state workflow without retired command pages", () => {
  const root = join(import.meta.dir, "..");
  const navigation = readFileSync(join(root, "docs/navigation.json"), "utf8");
  expect(navigation).toContain("inputs/plans");
  expect(navigation).toContain("reference/cli/run");
  for (const retired of ["reference/cli/build", "reference/cli/check", "reference/cli/diff"]) {
    expect(navigation).not.toContain(retired);
  }
});

test("input and comparison pages distinguish drift from cross-input comparison", () => {
  const root = join(import.meta.dir, "..");
  const input = readFileSync(join(root, "docs/inputs/index.md"), "utf8");
  const plans = readFileSync(join(root, "docs/inputs/plans.md"), "utf8");
  const comparison = readFileSync(join(root, "docs/concepts/diff.md"), "utf8");
  expect(input).toContain("state JSON");
  expect(input).toContain("configuration directory is not an analysis input");
  expect(plans).toContain("recorded to refreshed");
  expect(plans).toContain("No drift reported in this plan");
  expect(comparison).toContain("cross-input comparison");
  expect(comparison).toContain("never drift");
});

test("public examples use the run command and preserve producer responsibility", () => {
  const root = join(import.meta.dir, "..");
  for (const name of [
    "docs/getting-started/first-architecture.md",
    "docs/workflows/index.md",
    "docs/integrations/ci/README.md",
    "docs/integrations/github-actions.md",
    "examples/playground/README.md",
  ]) {
    const page = readFileSync(join(root, name), "utf8");
    expect(page).toContain("rootform run");
    expect(page).not.toMatch(/rootform (?:build|check|diff)\b/u);
  }
  const ci = readFileSync(join(root, "docs/integrations/ci/README.md"), "utf8");
  expect(ci).toContain("terraform plan -input=false -out=plan.tfplan");
  expect(ci).toContain("terraform show -json plan.tfplan");
});

test("language reference names instance closure and sensitive evidence bounds", () => {
  const root = join(import.meta.dir, "..");
  const emissions = readFileSync(join(root, "docs/language/reference/emissions.md"), "utf8");
  const rules = readFileSync(join(root, "docs/language/reference/rules.md"), "utf8");
  const diagnostics = readFileSync(join(root, "docs/language/reference/diagnostics.md"), "utf8");
  for (const term of [
    "on_null",
    "on_empty",
    "last-segment",
    "uncomparable_candidate",
    "traversal",
    "Sensitive values",
  ]) {
    expect(emissions).toContain(term);
  }
  expect(rules).toContain("scope");
  for (const code of [
    "EMISSION_PATH_UNDEFINED",
    "VIA_VALUE_SHAPE",
    "DUPLICATE_IDENTITY",
    "EVIDENCE_CONFLICT",
  ]) {
    expect(diagnostics).toContain(code);
  }
});
