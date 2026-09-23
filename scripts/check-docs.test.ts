import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

test("user documentation navigation follows the task-oriented structure", () => {
  type Item = { label: string; page?: string; items?: Item[] };
  type Group = { label: string; items: Item[] };
  const root = join(import.meta.dir, "..");
  const groups = JSON.parse(readFileSync(join(root, "docs/navigation.json"), "utf8")) as Group[];
  const group = (label: string) => {
    const found = groups.find((candidate) => candidate.label === label);
    expect(found).toBeDefined();
    return found as Group;
  };
  const labels = (label: string) => group(label).items.map((item) => item.label);
  const pages = (items: Item[]): string[] =>
    items.flatMap((item) => (item.page === undefined ? pages(item.items ?? []) : [item.page]));

  expect(groups.map((candidate) => candidate.label)).toEqual([
    "Get started",
    "Use Rootform",
    "Review and automate",
    "Project configuration",
    "Understand Rootform",
    "Rootform language",
    "Reference",
    "Security and troubleshooting",
    "Contribute",
  ]);
  expect(labels("Get started")).toEqual([
    "Overview",
    "Install Rootform",
    "Your first architecture",
  ]);
  expect(labels("Use Rootform")).toEqual([
    "Explore an architecture",
    "Choose an input",
    "Terraform and OpenTofu plans",
  ]);
  expect(labels("Review and automate")).toEqual([
    "Compare architectures",
    "Run checks",
    "Review a pull request",
    "Run in CI",
    "GitHub Actions",
  ]);
  expect(labels("Project configuration")).toEqual([
    "Select Dialects and Policy Packs",
    "Use external Dialects and Policy Packs",
    "Locks and vendored content",
    "Reproduce a build offline",
  ]);
  expect(labels("Understand Rootform")).toEqual([
    "Core concepts",
    "Dialects and RF Vocabulary",
    "Policies and Policy Packs",
    "Architecture Diff",
    "Architecture IR",
  ]);
  expect(pages(group("Rootform language").items)).toEqual([
    "language",
    "language/tour",
    "dialect-authoring",
    "language/write-policy-pack",
    "language/test-validate",
    "language/reference",
    "language/reference/syntax-files",
    "language/reference/symbols",
    "language/reference/dialects",
    "language/reference/rf-vocabulary",
    "language/reference/rules",
    "language/reference/emissions",
    "language/reference/composition",
    "language/reference/policy-packs",
    "language/reference/expressions",
    "language/reference/traversals",
    "language/reference/built-ins",
    "language/reference/evaluation",
    "language/reference/diagnostics",
  ]);

  const reference = group("Reference");
  expect(reference.items.map((item) => item.label)).toEqual([
    "Outputs and exit status",
    "CLI reference",
    "Container image",
    "Registry compatibility",
  ]);
  const cli = reference.items.find((item) => item.label === "CLI reference");
  expect(cli?.items?.[0]).toMatchObject({ label: "Overview", page: "reference/cli" });
  const documentedCliPages = pages(cli?.items ?? []).sort();
  const cliSourcePages = [
    ...new Bun.Glob("docs/reference/cli/**/*.md").scanSync({ cwd: root, onlyFiles: true }),
  ]
    .map((path) => deriveRoute(path))
    .sort();
  expect(documentedCliPages).toEqual(cliSourcePages);
});

test("input guides preserve configuration, saved-document, and plan boundaries", () => {
  const root = join(import.meta.dir, "..");
  const choice = readFileSync(join(root, "docs/inputs/index.md"), "utf8");
  const plans = readFileSync(join(root, "docs/inputs/plans.md"), "utf8");
  const explore = readFileSync(join(root, "docs/guides/explore-architecture.md"), "utf8");

  for (const command of [
    "rootform run ./infra",
    "rootform run architecture.json",
    "rootform run --plan tfplan.json",
  ]) {
    expect(choice).toContain(command);
  }
  expect(choice).toContain("not an isolated `.tf`");
  expect(choice).toContain("Two valid documents with different semantic environments");
  expect(choice).not.toContain("requires compatible semantic digests");

  for (const command of [
    "rootform run --plan tfplan.json",
    "rootform build --plan tfplan.json --output planned.json",
    "rootform diff --plan tfplan.json",
    "rootform check --plan tfplan.json",
  ]) {
    expect(plans).toContain(command);
  }
  expect(plans).toMatch(/project selection[\s\S]*current working directory/u);
  expect(plans).toMatch(/need neither `rootform\.lock` nor a\s+`\.rootform\/` directory/u);
  expect(plans).toContain("does not infer a project root");
  expect(plans).toMatch(/does not necessarily\s+mean the comparison failed/u);
  expect(plans.match(/<!-- docs-check:plan-/gu)?.length).toBe(3);

  expect(explore).toContain("rootform run architecture.json");
  expect(explore).toContain("rootform build . --format html --output architecture.html");
  expect(explore).not.toContain("beneficiary inspector rows");
  expect(explore).not.toContain("same resource ID");
});

test("local review guides preserve Diff, Policy, and Git boundaries", () => {
  const root = join(import.meta.dir, "..");
  const compare = readFileSync(join(root, "docs/guides/compare-architectures.md"), "utf8");
  const checks = readFileSync(join(root, "docs/guides/check-architecture.md"), "utf8");
  const review = readFileSync(join(root, "docs/workflows/index.md"), "utf8");

  expect(compare).toContain("rootform diff before.json after.json --format markdown");
  expect(compare).toMatch(/no CLI entry\s+point or HTML format for an interactive Diff/u);
  expect(compare).not.toMatch(/rootform diff[^\n]*(?:--format html|--html)/u);

  for (const marker of [
    "policy-violation",
    "policy-indeterminate",
    "policy-none",
    "policy-no-target",
  ]) {
    expect(checks).toContain(`<!-- docs-check:${marker} -->`);
  }
  expect(checks).toContain("not declared in source");
  expect(checks).toContain("aws_instance.subnet_id");
  expect(checks).toContain("aws_instance.implicit");
  expect(checks).not.toContain('resource "aws_subnet" "orphan"');
  expect(checks).toMatch(/accepts neither `--input` nor `--policy-pack`/u);

  for (const command of ["git merge-base", "git worktree add", "git worktree remove"]) {
    expect(review).toContain(command);
  }
  expect(review).not.toMatch(/git (?:reset|clean|checkout)/u);
  expect(review).not.toContain("rm -r");
  expect(review).toContain("Uncommitted modifications");
  expect(review).toContain("`.terraform/`");
  expect(review).toContain("rm -f");
  expect(review).toContain("HTML shows one architecture");
});

test("project configuration guides keep decision, adoption, mechanism, and transfer separate", () => {
  const root = join(import.meta.dir, "..");
  const selection = readFileSync(join(root, "docs/cli.md"), "utf8");
  const external = readFileSync(join(root, "docs/guides/external-content.md"), "utf8");
  const locks = readFileSync(join(root, "docs/offline-security.md"), "utf8");
  const replay = readFileSync(join(root, "docs/guides/reproduce-build.md"), "utf8");

  expect(selection).toContain("returns status\n`3`, not compliance");
  expect(selection).not.toContain("manifest_digest");
  expect(selection).not.toContain("$ROOTFORM_HOME/cache");

  for (const title of [
    'title="rootform.lock (local Policy Pack)"',
    'title="rootform.lock (local Dialect)"',
    'title="rootform.lock (combined replay selection)"',
    'title="rootform.lock (OCI template)"',
  ]) {
    expect(external).toContain(title);
  }
  expect(external).toContain("rootform list policy-packs --policy-pack");
  expect(external).toContain("rootform package dialects ./third-party/confluent");
  expect(external).toContain("Policies     1 selected");
  expect(external).not.toMatch(/rootform publish (?:dialects|policy-packs)/u);

  for (const heading of [
    "## What does rootform.lock fix?",
    "## How is this different from .terraform.lock.hcl?",
    "## What does init do?",
    "## How do --locked and --offline differ?",
    "## Where does Rootform read selected content?",
    "## What changes when vendor exists?",
  ]) {
    expect(locks).toContain(heading);
  }
  expect(locks).toContain("never create, normalize, or update the lock");

  for (const marker of [
    "offline-evidence-directory",
    "offline-embedded-source",
    "offline-embedded-replay",
    "offline-vendor-dialects",
    "offline-vendor-policy-packs",
    "offline-external-source",
    "offline-external-replay",
    "offline-governance-source",
    "offline-governance-replay",
  ]) {
    expect(replay).toContain(`<!-- docs-check:${marker} -->`);
  }
  expect(replay).toContain("Architecture unchanged");
  expect(replay).toContain("before-check.status");
  expect(replay).toContain('ROOTFORM_HOME="$governance_home" \\\n  rootform check');
  expect(replay).toContain("This build-only path needs no Policy Pack vendor");
  expect(replay).toContain("cmp -s");
  expect(replay).toContain("does not by itself prove network isolation");
  expect(replay).not.toContain("no architectural change");
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
  expect(page).toContain(
    "Supplied\n[Dialects](concepts/dialects.md) are included and need no additional Rootform\nconfiguration for your first architecture",
  );
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
  expect(workflow).toContain("`rootform package dialects` rejects it");
});

test("contribution guide keeps Policy Packs user-owned", () => {
  const page = readFileSync(join(import.meta.dir, "../docs/contributing/index.md"), "utf8");

  expect(page).not.toContain("## Contribute a Policy Pack");
  expect(page).not.toContain("Rootform Policy Packs");
  expect(page).toContain("[write their own Policy Packs](../language/write-policy-pack.md)");
  expect(page).toMatch(/\b(?:not|never)\s+(?:an?\s+)?official\b[\s\S]{0,80}\bcatalog\b/iu);
});

test("contribution destinations and licenses match repository ownership", () => {
  const root = join(import.meta.dir, "..");
  const guide = readFileSync(join(root, "docs/contributing/index.md"), "utf8");
  const contributing = readFileSync(join(root, "CONTRIBUTING.md"), "utf8");
  const security = readFileSync(join(root, "SECURITY.md"), "utf8");
  const links = new Set(
    [...guide.matchAll(/\]\(([^)]+)\)/gu)].flatMap((match) =>
      match[1] === undefined ? [] : [match[1]],
    ),
  );
  const destinationFor = (topic: RegExp): string | undefined => {
    const row = guide
      .split("\n")
      .find((line) => line.startsWith("|") && topic.test(line.split("|")[1] ?? ""));
    return row?.match(/\]\(([^)]+)\)/u)?.[1];
  };

  for (const destination of [
    "https://github.com/rootform-dev/rootform",
    "https://github.com/rootform-dev/rootform/issues",
    "https://github.com/rootform-dev/rootform/security/advisories/new",
    "https://github.com/rootform-dev/action",
    "https://github.com/rootform-dev/rootform/tree/dev/dialects",
    "https://github.com/rootform-dev/rootform/blob/dev/SECURITY.md",
    "https://github.com/rootform-dev/rootform/blob/dev/CONTRIBUTING.md",
    "https://github.com/rootform-dev/rootform/blob/dev/LICENSE",
    "https://github.com/rootform-dev/rootform/blob/dev/dialects/LICENSE",
    "https://github.com/rootform-dev/rootform/blob/dev/dependencies/ROOTFORM-BINARY-LICENSE.txt",
  ]) {
    expect(links).toContain(destination);
  }
  expect(destinationFor(/reproducible product/iu)).toBe(
    "https://github.com/rootform-dev/rootform/issues",
  );
  expect(destinationFor(/vulnerability/iu)).toBe(
    "https://github.com/rootform-dev/rootform/security/advisories/new",
  );
  expect(destinationFor(/official dialects/iu)).toBe(
    "https://github.com/rootform-dev/rootform/tree/dev/dialects",
  );
  for (const link of links) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/iu.test(link)) continue;
    expect(resolveRepositoryLink("docs/contributing/index.md", link)?.startsWith("docs/")).toBe(
      true,
    );
  }
  expect(guide).not.toContain("github.com/rootform-dev/dialects");
  expect(statSync(join(root, "dialects")).isDirectory()).toBe(true);
  expect(security).toMatch(/GitHub\s+private\s+vulnerability\s+reporting/iu);
  expect(security).toMatch(/do not open a public issue/iu);
  expect(contributing).toContain("dialects/LICENSE");
  expect(contributing).toContain("MPL-2.0");
  expect(readFileSync(join(root, "LICENSE"), "utf8").trimStart().startsWith("Apache License")).toBe(
    true,
  );
  expect(
    readFileSync(join(root, "dialects/LICENSE"), "utf8").startsWith(
      "Mozilla Public License Version 2.0",
    ),
  ).toBe(true);
  expect(readFileSync(join(root, "dependencies/ROOTFORM-BINARY-LICENSE.txt"), "utf8")).toContain(
    "SPDX-License-Identifier: Elastic-2.0",
  );
});

test("sidebar uses approved user-facing labels and placement", () => {
  const navigation = JSON.parse(
    readFileSync(join(import.meta.dir, "../docs/navigation.json"), "utf8"),
  ) as Array<{
    label: string;
    items: Array<string | { label: string; page?: string; items?: unknown[] }>;
  }>;
  const labels = (group: string) =>
    navigation
      .find(({ label }) => label === group)
      ?.items.map((item) => (typeof item === "string" ? item : item.label));

  expect(labels("Get started")).toEqual([
    "Overview",
    "Install Rootform",
    "Your first architecture",
  ]);
  expect(labels("Understand Rootform")).toEqual([
    "Core concepts",
    "Dialects and RF Vocabulary",
    "Policies and Policy Packs",
    "Architecture Diff",
    "Architecture IR",
  ]);
  expect(labels("Use Rootform")).toEqual([
    "Explore an architecture",
    "Choose an input",
    "Terraform and OpenTofu plans",
  ]);
  expect(labels("Review and automate")).toEqual([
    "Compare architectures",
    "Run checks",
    "Review a pull request",
    "Run in CI",
    "GitHub Actions",
  ]);
  expect(labels("Project configuration")).toEqual([
    "Select Dialects and Policy Packs",
    "Use external Dialects and Policy Packs",
    "Locks and vendored content",
    "Reproduce a build offline",
  ]);
  expect(labels("Security and troubleshooting")).toEqual([
    "Security and data handling",
    "Limitations",
    "Troubleshooting",
  ]);
  expect(labels("Reference")).toEqual([
    "Outputs and exit status",
    "CLI reference",
    "Container image",
    "Registry compatibility",
  ]);
  expect(labels("Contribute")).toEqual(["Contribute to Rootform", "Writing for Rootform"]);
  expect(navigation.map(({ label }) => label)).not.toContain("Explore the renderer");
  expect(JSON.stringify(navigation)).not.toMatch(/Survey|Focus|Inspector|"page":"renderer/u);
  expect([
    ...new Bun.Glob("renderer/**/*.md").scanSync({ cwd: join(import.meta.dir, "../docs") }),
  ]).toEqual([]);
});

test("public docs distinguish Dialects from semantics", () => {
  const forbidden = [
    "provider semantics",
    "semantic package",
    "semantic input",
    "semantic source",
    "semantics store",
    "selected semantics",
    "installed semantics",
    "prepared semantics",
    "vendored semantics",
    "current-project semantics",
    "acquire semantics",
    "acquires no semantics",
    "supply reviewed semantics",
  ];
  const pages = [
    ...new Bun.Glob("**/*.md").scanSync({
      cwd: join(import.meta.dir, "../docs"),
      absolute: true,
    }),
  ];

  for (const page of pages) {
    if (page.endsWith("/contributing/writing.md")) continue;
    const prose = readFileSync(page, "utf8").toLowerCase();
    for (const phrase of forbidden) {
      expect(prose, `${page} uses Dialect alias ${JSON.stringify(phrase)}`).not.toContain(phrase);
    }
  }
});

test("operations pages keep network, offline, and diagnosis boundaries explicit", () => {
  const root = join(import.meta.dir, "../docs");
  const page = (name: string) => readFileSync(join(root, name), "utf8");
  const image = page("integrations/oci-image.md");
  const registry = page("integrations/registry-compatibility.md");
  const security = page("security/index.md");
  const limitations = page("limitations.md");
  const troubleshooting = page("troubleshooting/index.md");

  for (const marker of [
    "## Run against a project",
    "--pull never",
    "--network none",
    "--tmpfs /tmp:uid=65532,gid=65532,mode=0700",
    "--tmpfs /home/rootform/.rootform:uid=65532,gid=65532,mode=0700",
    '--volume "$PWD:/workspace:ro"',
    "--env DOCKER_CONFIG=/run/docker-config",
  ]) {
    expect(image).toContain(marker);
  }
  expect(registry).toContain("## Qualified registry paths");
  expect(registry).toContain("Anonymous pull and private-package access are not established");
  expect(registry).toContain("`manifest_digest`");
  expect(registry).toContain("`layer_digest`");
  expect(registry).toContain("`content_digest`");

  for (const operation of [
    "| `rootform init` |",
    "| `rootform vendor dialects` and `rootform vendor policy-packs` |",
    "| `rootform publish dialects` and `rootform publish policy-packs` |",
    "| `rootform package` |",
    "| `rootform run` |",
  ]) {
    expect(security).toContain(operation);
  }
  expect(security).toContain("This is possible with or without `--locked`");
  expect(security).toContain("No raw values does not mean anonymized");

  for (const question of [
    "## Does Rootform see deployed infrastructure?",
    "## Is configuration analysis the same as a plan?",
    "## What happens with count, for_each, .tfvars, and modules?",
    "## Does a resource disappear without a Rule?",
    "## Why was a policy not evaluated or indeterminate?",
    "## Why does Diff differ from Terraform actions?",
    "## What does offline guarantee?",
    "## Where does the Rootform language stop?",
  ]) {
    expect(limitations).toContain(question);
  }
  expect(limitations).toContain("does not necessarily have a permanent,");
  expect(troubleshooting).toContain("## A Representation has no standalone card");
  expect(troubleshooting).toContain("## Diff cannot complete at all");
  expect(troubleshooting).toContain("Do not rely on\n`rootform list`");
});
