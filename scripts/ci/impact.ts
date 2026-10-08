/** Public, dependency-free contribution policy. Run the BASE revision of this
 * file when classifying a pull request. Missing data is never a docs-only pass. */
export const lanes = [
  "docs",
  "cli",
  "dialects",
  "policies",
  "examples",
  "distribution",
  "tooling",
  "generated",
] as const;
export type Lane = (typeof lanes)[number];
export type Change = {
  path: string;
  previousPath?: string;
  before?: string | null;
  after?: string | null;
};
export type Impact = {
  version: 1;
  lanes: Record<Lane, boolean>;
  preview: boolean;
  scenarios: boolean;
  core: boolean;
  registry: boolean;
  reasons: string[];
};

export function fullImpact(reason: string): Impact {
  return {
    version: 1,
    lanes: Object.fromEntries(lanes.map((lane) => [lane, true])) as Record<Lane, boolean>,
    preview: true,
    scenarios: true,
    core: true,
    registry: true,
    reasons: [reason],
  };
}

/** Compare executable/documented contracts, not paragraph whitespace. Includes
 * fences, command inline code and markers. Unbalanced fences fail conservatively. */
export function executableContent(text: string): string[] | null {
  const parts: string[] = [];
  let fence: { char: string; length: number } | undefined;
  let block: string[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const start = /^\s{0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    if (!fence && start) {
      fence = { char: start[1]?.[0] ?? "`", length: start[1]?.length ?? 3 };
      block = [start[2]?.trim() ?? ""];
    } else if (fence) {
      if (
        start &&
        start[1]?.[0] === fence.char &&
        start[1].length >= fence.length &&
        !start[2]?.trim()
      ) {
        parts.push(block.join("\n"));
        fence = undefined;
      } else block.push(line);
    } else {
      for (const match of line.matchAll(
        /`([^`]*(?:rootform|terraform|tofu|--[a-z]|rf\.|\.rf\.hcl)[^`]*)`/gu,
      ))
        parts.push(match[1] ?? "");
      for (const match of line.matchAll(/<!--\s*docs-(?:check|output):[^>]+-->/gu))
        parts.push(match[0]);
    }
  }
  return fence ? null : parts;
}

export function classifyChanges(changes: readonly Change[]): Impact {
  if (!changes.length || changes.length > 5000)
    return fullImpact("Missing or oversized change inventory");
  const impact: Impact = {
    version: 1,
    lanes: Object.fromEntries(lanes.map((lane) => [lane, false])) as Record<Lane, boolean>,
    preview: false,
    scenarios: false,
    core: false,
    registry: false,
    reasons: [],
  };
  const select = (reason: string, ...selected: Lane[]) => {
    for (const lane of selected) impact.lanes[lane] = true;
    impact.reasons.push(reason);
  };
  for (const change of changes) {
    for (const path of new Set([
      change.path,
      ...(change.previousPath ? [change.previousPath] : []),
    ])) {
      if (!/^[A-Za-z0-9_./-]+$/u.test(path) || path.split("/").includes(".."))
        return fullImpact("Unknown path encoding");
      if (path.startsWith("docs/")) {
        select(`${path}: documentation`, "docs");
        impact.preview = true;
        if (path.endsWith(".md")) {
          if (change.before === undefined || change.after === undefined)
            return fullImpact(`${path}: incomplete Markdown diff`);
          const before = executableContent(change.before ?? "");
          const after = executableContent(change.after ?? "");
          if (!before || !after || JSON.stringify(before) !== JSON.stringify(after))
            select(`${path}: executable documentation changed`, "examples");
          if (
            (!before || !after || JSON.stringify(before) !== JSON.stringify(after)) &&
            [change.before, change.after].some((text) =>
              /<!--\s*docs-check:(?:external-content-2|external-add-oci|external-update-oci|docs-dialect-authoring-4|authoring-add-published|docs-language-write-policy-pack-4|policy-authoring-add-published)\s*-->/u.test(
                text ?? "",
              ),
            )
          )
            impact.registry = true;
          if (
            [change.before, change.after].some(
              (text) =>
                text &&
                /<!--\s*(?:BEGIN GENERATED (?:CLI|ACTION)|Generated (?:from (?:contracts\/)?reference\/cli\.json|by scripts\/generate-provider-coverage\.ts))/u.test(
                  text,
                ),
            )
          )
            select(`${path}: generated documentation content`, "generated");
        } else if (path !== "docs/navigation.json" && !/^docs\/assets\//u.test(path)) {
          select(`${path}: executable recipe or documentation data`, "examples");
        }
        if (/^docs\/reference\/(?:cli|github-actions|provider-coverage)\.md$/u.test(path))
          select(`${path}: generated reference`, "generated");
      } else if (
        path.endsWith(".md") &&
        !/^(?:scripts|contracts|schemas|reference)\//u.test(path) &&
        !/(?:^|\/)(?:LICENSE|NOTICE)(?:\.|$)/iu.test(path)
      ) {
        if (change.before === undefined || change.after === undefined)
          return fullImpact(`${path}: incomplete Markdown diff`);
        const before = executableContent(change.before ?? "");
        const after = executableContent(change.after ?? "");
        if (!before || !after || JSON.stringify(before) !== JSON.stringify(after))
          select(`${path}: documented command changed`, "examples");
      } else if (path.startsWith("cli/")) {
        select(`${path}: public CLI module`, "cli", "generated", "examples");
        impact.core = true;
        if (
          /^cli\/(?:form|policyresult|detect|backend|internal\/(?:architecture|document|policy))\//u.test(
            path,
          )
        )
          select(
            `${path}: shared runtime model or backend contract`,
            "dialects",
            "policies",
            "distribution",
          );
      } else if (path.startsWith("dialects/")) {
        select(`${path}: official Dialects and evidence`, "dialects", "generated");
        impact.core = true;
      } else if (path.startsWith("policy-packs/")) {
        select(`${path}: Policy Packs`, "policies", "examples");
        impact.core = true;
      } else if (path.startsWith("examples/")) {
        select(`${path}: examples`, "examples");
        impact.scenarios ||= path.startsWith("examples/playground/");
      } else if (
        /^(?:contracts|schemas|reference)\//u.test(path) ||
        path === "public-export.json"
      ) {
        select(`${path}: shared contract`, ...lanes);
        impact.preview = true;
        impact.scenarios = true;
        impact.core = true;
      } else if (
        /^(?:distribution|installers|oci|dependencies)\//u.test(path) ||
        path === ".trivyignore.yaml"
      ) {
        select(`${path}: distribution`, "distribution", "tooling");
      } else {
        // Includes workflow/policy edits, dependencies, generators and unknown paths.
        return fullImpact(`${path}: shared tooling or unclassified path`);
      }
    }
  }
  return impact;
}
