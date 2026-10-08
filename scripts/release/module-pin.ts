import { spawnSync } from "node:child_process";
import type { RuntimeComponent } from "./runtime-licenses.ts";

// A released executable takes two trees from this repository: the public
// command line module it is built with and the official Dialects it embeds.
// Its Go build information records the module at a pseudo-version, which
// names one commit of this repository. A candidate is assembled only while
// both trees stand exactly as they stood at that commit.
const FROZEN_TREES = ["cli", "dialects"];

// DEPENDENCY matches the build information line of the public CLI module and
// the replacement line that follows it when a replace directive redirected
// the module.
const DEPENDENCY =
  /(?:^|\n)dep\tgithub\.com\/rootform-dev\/rootform\/cli\t([^\t\n]+)\t[^\t\n]*\n(=>\t)?/gu;

// PSEUDO_VERSION matches the three Go pseudo-version forms. Their last two
// elements are the UTC commit time and the 12-character commit prefix.
const PSEUDO_VERSION =
  /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*\.)?([0-9]{14})-([0-9a-f]{12})$/u;

export type CliModulePin = {
  // prefix is the 12-character commit prefix the pseudo-version names.
  prefix: string;
  // time is the UTC commit time the pseudo-version names, as yyyymmddhhmmss.
  time: string;
  version: string;
};

export type PinnedExecutable = { body: Buffer; file: string };

export type PinnedComponent = Pick<RuntimeComponent, "kind" | "version">;

export type FrozenPinVerifier = (
  root: string,
  executables: PinnedExecutable[],
  components: PinnedComponent[],
) => void;

// cliModulePin reads the public CLI module version one Go executable records
// in its build information. The executable carries that information more
// than once; every copy must agree.
export function cliModulePin(body: Buffer, file: string): CliModulePin {
  const versions = new Set<string>();
  for (const match of body.toString("latin1").matchAll(DEPENDENCY)) {
    if (match[2] !== undefined) {
      throw new Error(`handoff target replaces the public CLI module: ${file}`);
    }
    versions.add(match[1] ?? "");
  }
  const version = [...versions][0];
  if (versions.size !== 1 || version === undefined) {
    throw new Error(`handoff target does not record one public CLI module version: ${file}`);
  }
  const pseudo = PSEUDO_VERSION.exec(version);
  const time = pseudo?.[1];
  const prefix = pseudo?.[2];
  if (time === undefined || prefix === undefined) {
    throw new Error(`handoff target public CLI module version names no commit: ${file}`);
  }
  return { prefix, time, version };
}

function git(root: string, arguments_: string[]): { status: number; stdout: string } {
  const result = spawnSync("git", arguments_, { cwd: root, encoding: "utf8" });
  if (result.error) throw new Error(`git could not run: ${result.error.message}`);
  if (result.status === null) throw new Error("git stopped before it answered");
  return { status: result.status, stdout: result.stdout.trim() };
}

// answer runs a git command whose exit status 0 or 1 is a yes or a no.
function answer(root: string, arguments_: string[]): boolean {
  const { status } = git(root, arguments_);
  if (status > 1) throw new Error(`git ${arguments_[0]} failed with status ${status}`);
  return status === 0;
}

// pinnedCommit resolves the commit a pseudo-version names and proves the
// pseudo-version carries its exact commit time.
function pinnedCommit(root: string, pin: CliModulePin): string {
  const resolved = git(root, ["rev-parse", "--verify", "--quiet", `${pin.prefix}^{commit}`]);
  const commit = resolved.stdout;
  if (resolved.status !== 0 || !/^[0-9a-f]{40}$/u.test(commit) || !commit.startsWith(pin.prefix)) {
    throw new Error(`public CLI module version names no commit of this repository: ${pin.version}`);
  }
  const object = git(root, ["cat-file", "commit", commit]);
  const seconds = /^committer .* ([0-9]+) [+-][0-9]{4}$/mu.exec(object.stdout)?.[1];
  if (object.status !== 0 || seconds === undefined) {
    throw new Error(`pinned Rootform commit is unreadable: ${commit}`);
  }
  const time = new Date(Number(seconds) * 1000).toISOString().replace(/[-:T]/gu, "").slice(0, 14);
  if (time !== pin.time) {
    throw new Error(
      `public CLI module version ${pin.version} does not match the time of ${commit}`,
    );
  }
  return commit;
}

// verifyFrozenPins proves that the handoff executables were built from the
// trees the distribution commit holds: every target records one public CLI
// module version, which names a commit of this repository at its exact time;
// that commit is an ancestor of the distribution commit, neither the module
// nor the Dialects changed since, and the runtime license inventory records
// the Dialects of that commit. Every other Dialect bundle the inventory
// records, such as the presentation catalogs of the explorer, comes from an
// earlier commit whose Dialects the distribution still holds unchanged.
export function verifyFrozenPins(
  root: string,
  executables: PinnedExecutable[],
  components: PinnedComponent[],
): string {
  const pins = new Map<string, CliModulePin>();
  for (const { body, file } of executables) {
    const pin = cliModulePin(body, file);
    pins.set(pin.version, pin);
  }
  const pin = [...pins.values()][0];
  if (pins.size !== 1 || pin === undefined) {
    throw new Error("handoff targets do not record one public CLI module version");
  }
  const commit = pinnedCommit(root, pin);
  if (!answer(root, ["merge-base", "--is-ancestor", commit, "HEAD"])) {
    throw new Error(`pinned Rootform commit is not an ancestor of the distribution: ${commit}`);
  }
  if (!answer(root, ["diff-tree", "--quiet", commit, "HEAD", "--", ...FROZEN_TREES])) {
    throw new Error(`cli or dialects changed since the pinned Rootform commit: ${commit}`);
  }
  const bundles = components.filter(({ kind }) => kind === "dialect-bundle");
  if (!bundles.some(({ version }) => version === commit)) {
    throw new Error("runtime license inventory records no Dialects of the pinned Rootform commit");
  }
  for (const { version } of bundles) {
    if (
      !/^[0-9a-f]{40}$/u.test(version) ||
      git(root, ["cat-file", "-e", `${version}^{commit}`]).status !== 0 ||
      !answer(root, ["merge-base", "--is-ancestor", version, "HEAD"]) ||
      !answer(root, ["diff-tree", "--quiet", version, "HEAD", "--", "dialects"])
    ) {
      throw new Error(
        `runtime license inventory records Dialects the distribution no longer holds: ${version}`,
      );
    }
  }
  return commit;
}
