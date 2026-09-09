#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type Frontmatter = {
  title?: string;
  description?: string;
};

export type Placeholder = {
  line: number;
  kind: "lorem" | "todo" | "coming-soon";
};

export type DocsIssue = {
  file: string;
  kind:
    | "frontmatter"
    | "title"
    | "description"
    | "empty-page"
    | "placeholder"
    | "punctuation"
    | "link"
    | "navigation"
    | "route";
  detail: string;
};

export type SourcePage = {
  path: string;
  text: string;
};

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;
const FENCE_PATTERN = /^```/u;
const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\(([^)\s]+)\)/gu;
const INLINE_CODE_PATTERN = /`[^`]*`/gu;
const TODO_PATTERN = /\bTODO\b/u;
const LOREM_PATTERN = /\blorem(?:\s+ipsum)?\b/iu;
const COMING_SOON_PATTERN = /\bcoming[- ]soon\b/iu;

export function deriveRoute(path: string): string {
  const parts = path
    .replaceAll("\\", "/")
    .replace(/^docs\//u, "")
    .replace(/\.md$/u, "")
    .split("/")
    .filter((part) => part.length > 0);
  const last = parts[parts.length - 1];
  if (last !== undefined && (last === "index" || last === "README")) {
    parts.pop();
  }
  return parts.join("/") || "index";
}

export function parseFrontmatter(text: string): Frontmatter | null {
  const match = FRONTMATTER_PATTERN.exec(text);
  if (match === null) return null;
  const body = match[1];
  if (body === undefined) return null;
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(body);
  } catch {
    throw new Error("frontmatter is not valid YAML");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("frontmatter is not a mapping");
  }
  const record = parsed as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const description = typeof record.description === "string" ? record.description.trim() : "";
  return {
    title: title.length > 0 ? title : undefined,
    description: description.length > 0 ? description : undefined,
  };
}

function linesOutsideFences(text: string): string[] {
  const lines = text.split(/\r?\n/u);
  let inFence = false;
  const visible: string[] = [];
  for (const line of lines) {
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) visible.push("");
    else visible.push(line.replace(INLINE_CODE_PATTERN, ""));
  }
  return visible;
}

export function findPlaceholders(text: string): Placeholder[] {
  const placeholders: Placeholder[] = [];
  const lines = linesOutsideFences(text);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined) continue;
    if (TODO_PATTERN.test(line)) placeholders.push({ line: index + 1, kind: "todo" });
    if (LOREM_PATTERN.test(line)) placeholders.push({ line: index + 1, kind: "lorem" });
    if (COMING_SOON_PATTERN.test(line)) {
      placeholders.push({ line: index + 1, kind: "coming-soon" });
    }
  }
  return placeholders;
}

export function parseRelativeMarkdownLinks(text: string): Array<{ line: number; target: string }> {
  const links: Array<{ line: number; target: string }> = [];
  const lines = text.split(/\r?\n/u);
  let inFence = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line === undefined) continue;
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const match of line.matchAll(MARKDOWN_LINK_PATTERN)) {
      const target = match[1];
      if (target === undefined) continue;
      const pathPart = target.split("#")[0];
      if (pathPart === undefined || pathPart.length === 0) continue;
      if (pathPart.startsWith("/")) continue;
      if (/^[a-z]+:/iu.test(pathPart)) continue;
      if (!/\.md$/iu.test(pathPart)) continue;
      links.push({ line: index + 1, target });
    }
  }
  return links;
}

export function resolveRepositoryLink(fromRepositoryPath: string, target: string): string | null {
  const [pathPart] = target.split("#");
  if (pathPart === undefined || pathPart.length === 0) return null;
  const stack: string[] = [];
  for (const part of [...fromRepositoryPath.split("/").slice(0, -1), ...pathPart.split("/")]) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

export type NavigationShape = {
  leaves: string[];
  duplicatePages: string[];
  duplicateLabels: string[];
  shapeErrors: string[];
};

export function collectNavigation(nav: unknown): NavigationShape {
  const shape: NavigationShape = {
    leaves: [],
    duplicatePages: [],
    duplicateLabels: [],
    shapeErrors: [],
  };
  if (!Array.isArray(nav)) {
    shape.shapeErrors.push("navigation must be an array of groups");
    return shape;
  }
  const seenPages = new Map<string, number>();
  for (const group of nav) walkGroup(group, "navigation", shape, seenPages);
  for (const [page, count] of seenPages) {
    if (count > 1) shape.duplicatePages.push(`page "${page}" appears ${count} times`);
  }
  shape.leaves = [...seenPages.keys()].sort((left, right) => left.localeCompare(right, "en"));
  return shape;
}

function walkGroup(
  group: unknown,
  context: string,
  shape: NavigationShape,
  seenPages: Map<string, number>,
): void {
  if (typeof group !== "object" || group === null || Array.isArray(group)) {
    shape.shapeErrors.push(`${context}: group must be an object with label and items`);
    return;
  }
  const record = group as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (label.length === 0) {
    shape.shapeErrors.push(`${context}: group is missing a label`);
    return;
  }
  if (!Array.isArray(record.items)) {
    shape.shapeErrors.push(`${context} > ${label}: items must be an array`);
    return;
  }
  walkItems(record.items, `${context} > ${label}`, shape, seenPages);
}

function walkItems(
  items: unknown[],
  context: string,
  shape: NavigationShape,
  seenPages: Map<string, number>,
): void {
  const labels = new Set<string>();
  for (const item of items) {
    if (typeof item === "string") {
      if (item.length === 0) shape.shapeErrors.push(`${context}: empty page id`);
      else seenPages.set(item, (seenPages.get(item) ?? 0) + 1);
      continue;
    }
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      if (label.length === 0) {
        shape.shapeErrors.push(`${context}: entry is missing a label`);
        continue;
      }
      if (labels.has(label)) shape.duplicateLabels.push(`${context}: label "${label}" repeats`);
      labels.add(label);
      if (Array.isArray(record.items)) {
        walkItems(record.items, `${context} > ${label}`, shape, seenPages);
      } else if (typeof record.page === "string") {
        if (record.page.length === 0) {
          shape.shapeErrors.push(`${context} > ${label}: page id is empty`);
        } else {
          seenPages.set(record.page, (seenPages.get(record.page) ?? 0) + 1);
        }
      } else {
        shape.shapeErrors.push(`${context} > ${label}: entry must have items or a page`);
      }
      continue;
    }
    shape.shapeErrors.push(`${context}: entry must be a page id, a group, or a leaf`);
  }
}

export type NavigationResult = {
  leaves: string[];
  missingPages: string[];
  duplicates: string[];
  shapeErrors: string[];
};

export function checkNavigation(nav: unknown, routes: ReadonlySet<string>): NavigationResult {
  const shape = collectNavigation(nav);
  const missingPages = shape.leaves.filter((page) => !routes.has(page));
  return {
    leaves: shape.leaves,
    missingPages,
    duplicates: [...shape.duplicatePages, ...shape.duplicateLabels],
    shapeErrors: shape.shapeErrors,
  };
}

export function findDuplicateRoutes(paths: string[]): Array<{ route: string; files: string[] }> {
  const byRoute = new Map<string, string[]>();
  for (const path of paths) {
    const route = deriveRoute(path);
    const files = byRoute.get(route) ?? [];
    files.push(path);
    byRoute.set(route, files);
  }
  return [...byRoute.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([route, files]) => ({ route, files }))
    .sort((left, right) => left.route.localeCompare(right.route, "en"));
}

export function checkPage(
  path: string,
  text: string,
  existingMarkdown: ReadonlySet<string>,
): DocsIssue[] {
  const issues: DocsIssue[] = [];
  let frontmatter: Frontmatter | null;
  try {
    frontmatter = parseFrontmatter(text);
  } catch (error) {
    return [
      {
        file: path,
        kind: "frontmatter",
        detail: error instanceof Error ? error.message : "frontmatter is invalid",
      },
    ];
  }
  if (frontmatter === null) {
    issues.push({
      file: path,
      kind: "frontmatter",
      detail: "missing YAML frontmatter with title and description",
    });
  } else {
    if (frontmatter.title === undefined) {
      issues.push({ file: path, kind: "title", detail: "frontmatter title is missing or empty" });
    }
    if (frontmatter.description === undefined) {
      issues.push({
        file: path,
        kind: "description",
        detail: "frontmatter description is missing or empty",
      });
    }
  }
  const body = frontmatter === null ? text : text.replace(FRONTMATTER_PATTERN, "");
  if (body.trim().length === 0) {
    issues.push({ file: path, kind: "empty-page", detail: "page has no content" });
  }
  // CLI pages are generated from reference/cli.json and verified by check:cli.
  if (!path.replaceAll("\\", "/").startsWith("docs/reference/cli/")) {
    for (const [index, line] of text.split(/\r?\n/u).entries()) {
      if (line.includes("\u2014")) {
        issues.push({
          file: path,
          kind: "punctuation",
          detail: `line ${index + 1}: em dash (U+2014) is forbidden in authored Markdown; use a period, comma, colon, or parentheses`,
        });
      }
    }
  }
  for (const placeholder of findPlaceholders(body)) {
    issues.push({
      file: path,
      kind: "placeholder",
      detail: `line ${placeholder.line}: ${placeholder.kind} placeholder`,
    });
  }
  for (const link of parseRelativeMarkdownLinks(body)) {
    const resolved = resolveRepositoryLink(path, link.target);
    if (resolved === null) {
      issues.push({
        file: path,
        kind: "link",
        detail: `line ${link.line}: link \`${link.target}\` escapes the repository`,
      });
    } else if (!existingMarkdown.has(resolved)) {
      issues.push({
        file: path,
        kind: "link",
        detail: `line ${link.line}: \`${link.target}\` resolves to missing \`${resolved}\``,
      });
    }
  }
  return issues;
}

export type PagesResult = {
  issues: DocsIssue[];
  routeDuplicates: Array<{ route: string; files: string[] }>;
};

export function checkPages(
  sources: SourcePage[],
  existingMarkdown: ReadonlySet<string>,
): PagesResult {
  const issues: DocsIssue[] = [];
  const routeDuplicates = findDuplicateRoutes(sources.map((source) => source.path));
  for (const duplicate of routeDuplicates) {
    issues.push({
      file: duplicate.files[0] ?? "",
      kind: "route",
      detail: `route "${duplicate.route}" collides: ${duplicate.files.join(", ")}`,
    });
  }
  for (const source of sources) {
    issues.push(...checkPage(source.path, source.text, existingMarkdown));
  }
  return { issues, routeDuplicates };
}

function main(): void {
  const root =
    process.argv[2] === undefined ? join(import.meta.dir, "..") : resolve(process.argv[2]);
  const sources: SourcePage[] = [];
  const pagesGlob = new Bun.Glob("docs/**/*.md");
  for (const relative of pagesGlob.scanSync({ cwd: root, onlyFiles: true })) {
    const path = relative.replaceAll("\\", "/");
    sources.push({ path, text: readFileSync(join(root, path), "utf8") });
  }
  const existingMarkdown = new Set<string>();
  const existingGlob = new Bun.Glob("**/*.md");
  for (const relative of existingGlob.scanSync({ cwd: root, onlyFiles: true })) {
    const path = relative.replaceAll("\\", "/");
    if (path.startsWith("node_modules/") || path.startsWith(".git/")) continue;
    existingMarkdown.add(path);
  }
  const issues: DocsIssue[] = [];
  const pages = checkPages(sources, existingMarkdown);
  issues.push(...pages.issues);
  let groups = 0;
  let leaves = 0;
  const navigationPath = join(root, "docs", "navigation.json");
  if (!existsSync(navigationPath)) {
    issues.push({
      file: "docs/navigation.json",
      kind: "navigation",
      detail: "navigation file is missing",
    });
  } else {
    let nav: unknown;
    try {
      nav = JSON.parse(readFileSync(navigationPath, "utf8"));
    } catch {
      issues.push({
        file: "docs/navigation.json",
        kind: "navigation",
        detail: "navigation file is not valid JSON",
      });
    }
    if (nav !== undefined) {
      const routes = new Set(sources.map((source) => deriveRoute(source.path)));
      const navigation = checkNavigation(nav, routes);
      groups = Array.isArray(nav) ? nav.length : 0;
      leaves = navigation.leaves.length;
      if (Array.isArray(nav) && !navigation.leaves.includes("index")) {
        issues.push({
          file: "docs/navigation.json",
          kind: "navigation",
          detail: 'navigation has no home leaf "index"',
        });
      }
      for (const page of navigation.missingPages) {
        issues.push({
          file: "docs/navigation.json",
          kind: "navigation",
          detail: `leaf "${page}" has no matching page`,
        });
      }
      for (const duplicate of navigation.duplicates) {
        issues.push({ file: "docs/navigation.json", kind: "navigation", detail: duplicate });
      }
      for (const shapeError of navigation.shapeErrors) {
        issues.push({ file: "docs/navigation.json", kind: "navigation", detail: shapeError });
      }
    }
  }
  issues.sort((left, right) =>
    left.file === right.file
      ? left.detail.localeCompare(right.detail, "en")
      : left.file.localeCompare(right.file, "en"),
  );
  const counts: Record<string, number> = {};
  for (const issue of issues) counts[issue.kind] = (counts[issue.kind] ?? 0) + 1;
  const summary = [
    `${sources.length} pages`,
    `${groups} groups`,
    `${leaves} leaves`,
    `${pages.routeDuplicates.length} route conflicts`,
    `${counts.navigation ?? 0} navigation`,
    `${counts.link ?? 0} dangling links`,
    `${counts.placeholder ?? 0} placeholders`,
    `${counts.punctuation ?? 0} punctuation`,
    `${(counts.frontmatter ?? 0) + (counts.title ?? 0) + (counts.description ?? 0) + (counts["empty-page"] ?? 0)} frontmatter or content`,
  ];
  console.log(`docs check: ${summary.join(", ")}`);
  if (issues.length === 0) {
    console.log("docs check passed");
    return;
  }
  for (const issue of issues) {
    console.log(`  ${issue.file}: ${issue.kind}: ${issue.detail}`);
  }
  console.log(`docs check failed: ${issues.length} problem(s)`);
  process.exit(1);
}

if (import.meta.main) main();
