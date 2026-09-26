#!/usr/bin/env bun

// Qualifies the project selection lifecycle of one candidate Rootform binary
// against a live OCI Distribution registry. Every normal command is wrapped in
// a registry access-log window, so the network boundary is observed rather
// than assumed. The registry is started by the operator; see CONTRIBUTING.md.

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { writeRegistryQualificationProject } from "./qualify-registry.ts";

const OWNER = "e2e-portable";
const PACK = "e2e-guard";
const FILTER_PACK = "e2e-filter";
const PROVENANCE = [
  "--source-url",
  "https://github.com/rootform-dev/rootform",
  "--revision",
  "0000000000000000000000000000000000000000",
  "--documentation-url",
  "https://github.com/rootform-dev/rootform",
  "--licenses",
  "Apache-2.0",
];

export type SelectionOptions = {
  binary: string;
  caFile: string;
  evidence: string;
  registry: string;
  registryLog: string;
  root: string;
};

type Result = { exitCode: number; stderr: string; stdout: string };

// Expect is an exact exit status, any nonzero status, or any status.
type Expect = number | "fail" | "any";

type Row = {
  scenario: string;
  dialect: boolean;
  policyPack: boolean;
  local: boolean;
  ociTag: boolean;
  ociDigest: boolean;
  vendor: boolean;
  offline: boolean;
  proven: boolean;
  detail: string;
};

type Axes = Omit<Row, "scenario" | "proven" | "detail">;

const none: Axes = {
  dialect: false,
  policyPack: false,
  local: false,
  ociTag: false,
  ociDigest: false,
  vendor: false,
  offline: false,
};

function absolute(value: string, cwd: string): string {
  return isAbsolute(value) ? value : resolve(cwd, value);
}

export function parseSelectionArguments(
  arguments_: string[],
  cwd = process.cwd(),
): Omit<SelectionOptions, "root"> {
  const names = ["rootform-bin", "registry", "ca-file", "registry-log", "evidence"];
  const values = new Map<string, string>();
  for (let position = 0; position < arguments_.length; position++) {
    const argument = arguments_[position] ?? "";
    const name = names.find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown selection qualification argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate selection qualification argument: --${name}`);
    const value = argument.includes("=")
      ? argument.slice(argument.indexOf("=") + 1)
      : arguments_[++position];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  for (const name of names) {
    if (!values.has(name)) throw new Error(`--${name} is required`);
  }
  const registry = values.get("registry") as string;
  if (!/^[a-z0-9.-]+(?::[0-9]+)?$/u.test(registry)) {
    throw new Error("--registry must be a registry host with an optional port");
  }
  const binary = absolute(values.get("rootform-bin") as string, cwd);
  if (basename(binary) !== "rootform") {
    throw new Error("--rootform-bin must name an executable called rootform");
  }
  return {
    binary,
    caFile: absolute(values.get("ca-file") as string, cwd),
    evidence: absolute(values.get("evidence") as string, cwd),
    registry,
    registryLog: absolute(values.get("registry-log") as string, cwd),
  };
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

// treeDigest names every entry with its kind and content, so an added, removed,
// or changed file under a store, vendor tree, or project is always visible.
export function treeDigest(path: string): string {
  if (!existsSync(path)) return "absent";
  const hash = createHash("sha256");
  const walk = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory).sort()) {
      const full = join(directory, entry);
      const name = prefix + entry;
      const status = lstatSync(full);
      if (status.isSymbolicLink()) hash.update(`L ${name}\n`);
      else if (status.isDirectory()) {
        hash.update(`D ${name}\n`);
        walk(full, `${name}/`);
      } else hash.update(`F ${name} ${sha256(readFileSync(full))}\n`);
    }
  };
  walk(path, "");
  return hash.digest("hex");
}

function lockState(project: string): string {
  const path = join(project, "rootform.lock");
  if (!existsSync(path)) return "absent";
  return `${sha256(readFileSync(path))}@${statSync(path).mtimeMs}`;
}

function readLock(project: string): {
  dialects: Array<Record<string, unknown>>;
  policy_packs: Array<Record<string, unknown>>;
  excluded_owners: string[];
  replacements: string[];
} {
  return JSON.parse(readFileSync(join(project, "rootform.lock"), "utf8"));
}

function writeDialect(
  directory: string,
  owner: string,
  version: string,
  flavor: string,
  root: string,
  resource = "portable_service",
): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "dialect.rf.hcl"),
    'dialect "' +
      owner +
      '" {\n' +
      '  version = "' +
      version +
      '"\n' +
      '  provider "examplecorp/portable" { version = "= 0.1.0" }\n' +
      "}\n\n" +
      'concept "portable-service" {\n' +
      '  description = "Portable service for selection qualification (' +
      flavor +
      ')."\n' +
      "}\n\n" +
      'rule "portable-service" {\n' +
      '  match {\n    type = "' +
      resource +
      '"\n  }\n\n' +
      "  as = concept.portable-service\n" +
      "}\n",
  );
  writeFileSync(
    join(directory, "presentation.json"),
    '{"format_version":"1","resources":{},"rules":{},"concepts":{},"resource_labels":{},"rule_labels":{},"concept_labels":{}}\n',
  );
  cpSync(join(root, "LICENSE"), join(directory, "LICENSE"));
  writeFileSync(join(directory, "NOTICE"), "Rootform selection qualification fixture.\n");
}

function writePack(
  directory: string,
  name: string,
  version: string,
  policies: Array<{ name: string; assert: boolean; target: string }>,
  root: string,
): void {
  mkdirSync(join(directory, "policies"), { recursive: true });
  writeFileSync(
    join(directory, "pack.rf.hcl"),
    `policy_pack "${name}" {\n  version = "${version}"\n}\n`,
  );
  for (const policy of policies) {
    writeFileSync(
      join(directory, "policies", `${policy.name}.rf.hcl`),
      'policy "' +
        policy.name +
        '" {\n' +
        "  target {\n    concept = " +
        policy.target +
        "\n  }\n\n" +
        "  assert = " +
        String(policy.assert) +
        "\n\n" +
        '  message = "Selection qualification policy ' +
        policy.name +
        " " +
        version +
        '."\n' +
        "}\n",
    );
  }
  cpSync(join(root, "LICENSE"), join(directory, "LICENSE"));
  writeFileSync(join(directory, "NOTICE"), "Rootform selection qualification fixture.\n");
}

function findDigest(value: unknown): string | undefined {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.manifest_digest === "string") return record.manifest_digest;
    for (const child of Object.values(record)) {
      const found = findDigest(child);
      if (found) return found;
    }
  }
  return undefined;
}

class Qualification {
  readonly work: string;
  readonly repository: string;
  readonly alternate: string;
  readonly movable: string;
  readonly rows: Row[] = [];
  readonly network: Array<{ label: string; requests: number; allowed: boolean }> = [];
  readonly failures: string[] = [];
  readonly digests = new Map<string, string>();
  private readonly docker: string;
  private readonly ca: Buffer;

  constructor(readonly options: SelectionOptions) {
    this.work = mkdtempSync(join(tmpdir(), "rootform-selection-"));
    const run = `e2e-${Date.now().toString(36)}`;
    this.repository = `${options.registry}/${run}/units`;
    this.alternate = `${options.registry}/${run}/alternate`;
    this.movable = `${options.registry}/${run}/movable`;
    this.docker = join(this.work, "docker");
    mkdirSync(this.docker);
    writeFileSync(join(this.docker, "config.json"), "{}\n");
    this.ca = readFileSync(options.caFile);
  }

  path(...parts: string[]): string {
    return join(this.work, ...parts);
  }

  home(name: string): string {
    const home = this.path("homes", name);
    mkdirSync(home, { recursive: true });
    return home;
  }

  exec(
    arguments_: string[],
    cwd: string,
    home: string,
    extra: Record<string, string> = {},
  ): Result {
    const result = Bun.spawnSync([this.options.binary, ...arguments_], {
      cwd,
      env: { ...this.environment(home), ...extra },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    });
    return {
      exitCode: result.exitCode ?? -1,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    };
  }

  environment(home: string): Record<string, string> {
    return {
      PATH: `${dirname(this.options.binary)}:${process.env.PATH ?? ""}`,
      HOME: process.env.HOME ?? this.work,
      TMPDIR: tmpdir(),
      SSL_CERT_FILE: this.options.caFile,
      DOCKER_CONFIG: this.docker,
      ROOTFORM_HOME: home,
      ROOTFORM_INPUT: "0",
      NO_COLOR: "1",
    };
  }

  requests(): number {
    Bun.sleepSync(250);
    const log = readFileSync(this.options.registryLog, "utf8");
    return (log.match(/"(?:GET|HEAD|PUT|POST|PATCH|DELETE) \/v2\/[^"]* HTTP\/[0-9.]+"/gu) ?? [])
      .length;
  }

  // quiet runs a command that must not contact the registry and checks its
  // exit status. loud runs an explicit acquisition that may contact it.
  quiet(
    label: string,
    arguments_: string[],
    cwd: string,
    home: string,
    expect: Expect,
    extra: Record<string, string> = {},
  ): Result {
    const before = this.requests();
    const result = this.exec(arguments_, cwd, home, extra);
    const requests = this.requests() - before;
    this.network.push({ label, requests, allowed: false });
    if (requests !== 0) throw new Error(`${label} contacted the registry ${requests} times`);
    this.expectExit(label, result, expect);
    return result;
  }

  loud(
    label: string,
    arguments_: string[],
    cwd: string,
    home: string,
    expect: Expect,
    extra: Record<string, string> = {},
  ): Result & { requests: number } {
    const before = this.requests();
    const result = this.exec(arguments_, cwd, home, extra);
    const requests = this.requests() - before;
    this.network.push({ label, requests, allowed: true });
    this.expectExit(label, result, expect);
    return { ...result, requests };
  }

  expectExit(label: string, result: Result, expect: Expect): void {
    const ok =
      expect === "any" || (expect === "fail" ? result.exitCode !== 0 : result.exitCode === expect);
    if (!ok) {
      throw new Error(
        label +
          ": exit " +
          result.exitCode +
          ", expected " +
          expect +
          "\n" +
          result.stderr +
          result.stdout,
      );
    }
  }

  check(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
  }

  async scenario(
    scenario: string,
    axes: Partial<Axes>,
    body: () => Promise<string> | string,
  ): Promise<void> {
    const row: Row = { scenario, ...none, ...axes, proven: false, detail: "" };
    try {
      row.detail = await body();
      row.proven = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      row.detail = message.split("\n").slice(0, 6).join(" | ");
    }
    row.detail = row.detail
      .replaceAll(this.work, "<qualification-work>")
      .replaceAll(this.options.caFile, "<ca-file>")
      .replaceAll(this.options.binary, "<rootform-binary>");
    if (!row.proven) this.failures.push(`${scenario}: ${row.detail}`);
    this.rows.push(row);
    console.log(
      (row.proven ? "PASS " : "FAIL ") + scenario + (row.proven ? "" : ` :: ${row.detail}`),
    );
  }

  // serve starts a long-running command, waits until it prints its local
  // URL, stops it, and counts registry requests over the whole window.
  async serve(
    label: string,
    arguments_: string[],
    cwd: string,
    home: string,
  ): Promise<{ requests: number; started: boolean }> {
    const before = this.requests();
    const child = Bun.spawn([this.options.binary, ...arguments_], {
      cwd,
      env: this.environment(home),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    let output = "";
    const decoder = new TextDecoder();
    const read = async (stream: ReadableStream<Uint8Array>): Promise<void> => {
      for await (const chunk of stream) output += decoder.decode(chunk);
    };
    void read(child.stdout);
    void read(child.stderr);
    const deadline = Date.now() + 20_000;
    while (
      !/http:\/\/127\.0\.0\.1:[0-9]+/u.test(output) &&
      Date.now() < deadline &&
      child.exitCode === null
    ) {
      await Bun.sleep(100);
    }
    const started = /http:\/\/127\.0\.0\.1:[0-9]+/u.test(output);
    if (started)
      await fetch(output.match(/http:\/\/127\.0\.0\.1:[0-9]+/u)?.[0] ?? "").catch(() => undefined);
    child.kill();
    await child.exited;
    const requests = this.requests() - before;
    this.network.push({ label, requests, allowed: false });
    return { requests, started };
  }

  async registryFetch(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`https://${this.options.registry}${path}`, {
      ...init,
      tls: { ca: this.ca },
    } as RequestInit);
  }

  // moveTag points an existing tag at another manifest of the same repository,
  // which is what a publisher does when it re-tags a release.
  async moveTag(repository: string, tag: string, digest: string): Promise<void> {
    const name = repository.slice(this.options.registry.length + 1);
    const accept = "application/vnd.oci.image.manifest.v1+json";
    const manifest = await this.registryFetch(`/v2/${name}/manifests/${digest}`, {
      headers: { Accept: accept },
    });
    this.check(manifest.ok, `manifest ${digest} is unavailable for tag move`);
    const body = Buffer.from(await manifest.arrayBuffer());
    const put = await this.registryFetch(`/v2/${name}/manifests/${tag}`, {
      method: "PUT",
      headers: { "Content-Type": manifest.headers.get("content-type") ?? accept },
      body,
    });
    this.check(put.status === 201, `tag move failed with HTTP ${put.status}`);
  }
}

type Fixtures = {
  dTag: (version: string, repository?: string) => string;
  dDigest: (version: string) => string;
  pTag: (version: string, repository?: string) => string;
  pDigest: (version: string) => string;
  project: (name: string) => string;
};

async function prepare(q: Qualification): Promise<Fixtures> {
  const root = q.options.root;
  const sources = q.path("sources");
  const packageHome = q.home("package");
  const publishHome = q.home("publish");
  const publish = (
    kind: "dialects" | "policy-packs",
    layout: string,
    repository: string,
  ): string => {
    const result = q.loud(
      `publish ${kind} ${basename(layout)} to ${repository}`,
      ["publish", kind, layout, "--to", repository, "--format", "json"],
      sources,
      publishHome,
      0,
    );
    const digest = findDigest(JSON.parse(result.stdout));
    q.check(
      digest && /^sha256:[0-9a-f]{64}$/u.test(digest),
      "publication reported no manifest digest",
    );
    return digest;
  };
  const packageUnit = (kind: "dialects" | "policy-packs", source: string, layout: string): void => {
    q.quiet(
      `package ${kind} ${basename(layout)}`,
      ["package", kind, source, "--to", layout, ...PROVENANCE],
      sources,
      packageHome,
      0,
    );
  };
  mkdirSync(sources, { recursive: true });
  for (const version of ["0.1.0", "0.2.0"]) {
    writeDialect(
      join(sources, `dialect-${version}`, OWNER),
      OWNER,
      version,
      `release ${version}`,
      root,
    );
    packageUnit(
      "dialects",
      join(sources, `dialect-${version}`),
      join(sources, `layout-dialect-${version}`),
    );
    q.digests.set(
      `d:${version}`,
      publish("dialects", join(sources, `layout-dialect-${version}`), q.repository),
    );
    q.digests.set(
      `m:${version}`,
      publish("dialects", join(sources, `layout-dialect-${version}`), q.movable),
    );
    writePack(
      join(sources, `pack-${version}`),
      PACK,
      version,
      [{ name: "service-present", assert: true, target: `${OWNER}.concept.portable-service` }],
      root,
    );
    packageUnit(
      "policy-packs",
      join(sources, `pack-${version}`),
      join(sources, `layout-pack-${version}`),
    );
    q.digests.set(
      `p:${version}`,
      publish("policy-packs", join(sources, `layout-pack-${version}`), q.repository),
    );
  }
  writeDialect(
    join(sources, "dialect-alternate", OWNER),
    OWNER,
    "0.1.0",
    "alternate content",
    root,
  );
  packageUnit(
    "dialects",
    join(sources, "dialect-alternate"),
    join(sources, "layout-dialect-alternate"),
  );
  q.digests.set(
    "d-alt:0.1.0",
    publish("dialects", join(sources, "layout-dialect-alternate"), q.alternate),
  );
  writePack(
    join(sources, "pack-alternate"),
    PACK,
    "0.1.0",
    [{ name: "service-alternate", assert: true, target: `${OWNER}.concept.portable-service` }],
    root,
  );
  packageUnit(
    "policy-packs",
    join(sources, "pack-alternate"),
    join(sources, "layout-pack-alternate"),
  );
  q.digests.set(
    "p-alt:0.1.0",
    publish("policy-packs", join(sources, "layout-pack-alternate"), q.alternate),
  );
  q.check(
    q.digests.get("d:0.1.0") !== q.digests.get("d-alt:0.1.0"),
    "alternate Dialect has the same manifest",
  );

  return {
    dTag: (version, repository = q.repository) => `${repository}:dialect-${OWNER}-${version}`,
    dDigest: (version) => `${q.repository}@${q.digests.get(`d:${version}`)}`,
    pTag: (version, repository = q.repository) => `${repository}:policy-pack-${PACK}-${version}`,
    pDigest: (version) => `${q.repository}@${q.digests.get(`p:${version}`)}`,
    project: (name) => {
      const project = q.path("projects", name);
      writeRegistryQualificationProject(project);
      writeDialect(join(project, "dialects", OWNER), OWNER, "0.3.0", "local source", root);
      writePack(
        join(project, "policies", PACK),
        PACK,
        "0.3.0",
        [{ name: "service-present", assert: true, target: `${OWNER}.concept.portable-service` }],
        root,
      );
      writePack(
        join(project, "policies", FILTER_PACK),
        FILTER_PACK,
        "0.1.0",
        [
          { name: "pass", assert: true, target: `${OWNER}.concept.portable-service` },
          { name: "fail", assert: false, target: `${OWNER}.concept.portable-service` },
        ],
        root,
      );
      writeDialect(join(project, "overrides", "dialect", OWNER), OWNER, "0.4.0", "override", root);
      writeDialect(
        join(project, "overrides", "dialect-twin", OWNER),
        OWNER,
        "0.5.0",
        "second override",
        root,
      );
      writePack(
        join(project, "overrides", "pack", PACK),
        PACK,
        "0.9.0",
        [{ name: "service-present", assert: true, target: `${OWNER}.concept.portable-service` }],
        root,
      );
      writePack(
        join(project, "overrides", "pack-twin", PACK),
        PACK,
        "0.9.1",
        [{ name: "service-present", assert: true, target: `${OWNER}.concept.portable-service` }],
        root,
      );
      writeDialect(
        join(project, "others", "e2e-other"),
        "e2e-other",
        "0.1.0",
        "other owner",
        root,
        "other_service",
      );
      writeDialect(join(project, "overrides", "aws"), "aws", "9.9.9", "embedded replacement", root);
      return project;
    },
  };
}

function active(
  q: Qualification,
  project: string,
  home: string,
  extra: string[] = [],
  env: Record<string, string> = {},
): { version: string; origin: string } {
  const listed = JSON.parse(
    q.quiet(
      `list dialects ${OWNER} ${extra.join(" ")}`,
      ["list", "dialects", OWNER, "-o", "json", ...extra],
      project,
      home,
      0,
      env,
    ).stdout,
  );
  q.check(Array.isArray(listed) && listed.length === 1, `expected exactly one active ${OWNER}`);
  return { version: listed[0].version, origin: listed[0].origin };
}

function _activePack(
  q: Qualification,
  project: string,
  home: string,
  extra: string[] = [],
  env: Record<string, string> = {},
): string {
  const listed = JSON.parse(
    q.quiet(
      `list policy-packs ${extra.join(" ")}`,
      ["list", "policy-packs", "-o", "json", ...extra],
      project,
      home,
      0,
      env,
    ).stdout,
  ) as Array<{ name: string; version: string }>;
  return listed
    .filter((entry) => entry.name === PACK)
    .map((entry) => entry.version)
    .join(",");
}

function installed(q: Qualification, home: string, family: "dialects" | "policy-packs"): string[] {
  const listed = JSON.parse(
    q.quiet(
      `list ${family} --installed`,
      ["list", family, "--installed", "-o", "json"],
      q.work,
      home,
      0,
    ).stdout,
  ) as Array<{ name: string; version: string; repository: string }>;
  return listed.map((entry) => `${entry.name}@${entry.version}<${entry.repository}`).sort();
}

type Report = {
  format_version?: string;
  kind?: string;
  semantics?: {
    owners?: Array<{ id: string; kind: string; version: string; content_digest: string }>;
  };
  diagnostics?: Array<{ code: string; message: string }>;
};

type Resolved = {
  exitCode: number;
  stderr: string;
  dialects: Record<string, string>;
  digests: Record<string, string>;
  packs: Record<string, string>;
  policies: string[];
  evaluations: number;
  status: string;
};

// Resolve selection through a format-1 plan and its SARIF policy results.
function resolved(
  q: Qualification,
  label: string,
  project: string,
  home: string,
  extra: string[] = [],
  expect: Expect = 0,
  env: Record<string, string> = {},
): Resolved {
  const output = mkdtempSync(q.path("resolved-"));
  const documentPath = join(output, "analysis.json");
  const sarifPath = join(output, "results.sarif");
  const selectedPacks = existsSync(join(project, "rootform.lock"))
    ? readLock(project).policy_packs.map((entry) => String(entry.name))
    : [];
  const policySelection = extra.includes("--policy")
    ? []
    : selectedPacks.flatMap((name) => ["--policy", `${name}/*`]);
  const result = q.quiet(
    label,
    [
      "run",
      "plan.json",
      "--project",
      ".",
      "--no-serve",
      "-o",
      documentPath,
      "-o",
      sarifPath,
      ...extra,
      ...policySelection,
    ],
    project,
    home,
    expect === 0 ? "any" : expect,
    env,
  );
  const out: Resolved = {
    exitCode: result.exitCode,
    stderr: result.stderr,
    dialects: {},
    digests: {},
    packs: {},
    policies: [],
    evaluations: -1,
    status: "",
  };
  let report: Report;
  try {
    report = JSON.parse(readFileSync(documentPath, "utf8")) as Report;
  } catch {
    if (expect === 0 && result.exitCode !== 0)
      throw new Error(`${label}: exit ${result.exitCode}, expected success\n${result.stderr}`);
    return out;
  }
  if (report.format_version !== "1" || report.kind !== "plan")
    throw new Error(`${label}: run did not produce a format-1 plan`);
  const messages = (report.diagnostics ?? []).map((diagnostic) => diagnostic.message);
  if (messages.length > 0) out.stderr = [result.stderr, ...messages].filter(Boolean).join("\n");
  for (const owner of report.semantics?.owners ?? []) {
    if (owner.kind === "dialect") out.dialects[owner.id] = owner.version;
    if (owner.kind === "dialect") out.digests[owner.id] = owner.content_digest;
  }
  const packOverrides = extra.flatMap((argument, index) =>
    argument === "--policy-pack" ? [extra[index + 1] ?? ""] : [],
  );
  const listed = JSON.parse(
    q.quiet(
      `${label} Policy Pack selection`,
      [
        "list",
        "policy-packs",
        "-o",
        "json",
        ...packOverrides.flatMap((path) => ["--policy-pack", path]),
      ],
      project,
      home,
      0,
      env,
    ).stdout,
  ) as Array<{ name: string; version: string }>;
  for (const pack of listed) out.packs[pack.name] = pack.version;
  const sarif = JSON.parse(readFileSync(sarifPath, "utf8")) as {
    version?: string;
    runs?: Array<{ results?: Array<{ ruleId?: string; kind?: string }> }>;
  };
  if (
    sarif.version !== "2.1.0" ||
    sarif.runs?.length !== 1 ||
    !Array.isArray(sarif.runs[0]?.results)
  )
    throw new Error(`${label}: invalid SARIF policy report`);
  const evaluations = sarif.runs[0].results;
  out.policies = [...new Set(evaluations.map((entry) => entry.ruleId ?? ""))].sort();
  out.evaluations = evaluations.length;
  out.status =
    evaluations.length === 0
      ? "not_evaluated"
      : result.exitCode === 0
        ? "passed"
        : result.exitCode === 1
          ? "violated"
          : "indeterminate";
  if (expect === 0 && result.exitCode !== 0) {
    throw new Error(`${label}: exit ${result.exitCode}, expected success\n${result.stderr}`);
  }
  return out;
}

function lockText(project: string): string {
  const path = join(project, "rootform.lock");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function lockDialect(project: string, owner = OWNER): Record<string, unknown> | undefined {
  return readLock(project).dialects.find((entry) => entry.owner === owner);
}

function lockPack(project: string, name = PACK): Record<string, unknown> | undefined {
  return readLock(project).policy_packs.find((entry) => entry.name === name);
}

function ociDigest(entry: Record<string, unknown> | undefined): string {
  const source = entry?.source as { oci?: { manifest_digest?: string } } | undefined;
  return source?.oci?.manifest_digest ?? "";
}

function localPath(entry: Record<string, unknown> | undefined): string {
  const source = entry?.source as { local?: { path?: string } } | undefined;
  return source?.local?.path ?? "";
}

let aside = 0;

// away moves a path out of reach and returns the function that restores it.
function away(path: string): () => void {
  const moved = `${path}.away-${String(++aside)}`;
  renameSync(path, moved);
  return () => {
    // A command may recreate the path meanwhile, for example a home holding
    // only the derived linked Policy Pack cache. Keep it beside the original.
    if (existsSync(path)) renameSync(path, `${moved}.created`);
    renameSync(moved, path);
  };
}

function firstLine(text: string): string {
  return text.trim().split("\n")[0] ?? "";
}

async function installScenarios(q: Qualification, f: Fixtures): Promise<void> {
  await q.scenario(
    "install by tag and digest selects nothing",
    { dialect: true, policyPack: true, ociTag: true, ociDigest: true },
    () => {
      const home = q.home("install");
      const bare = f.project("install-bare");
      const selected = f.project("install-selected");
      q.quiet(
        "select local dialect",
        ["add", "dialects", `./dialects/${OWNER}`],
        selected,
        home,
        0,
      );
      q.quiet(
        "select local pack",
        ["add", "policy-packs", `./policies/${PACK}`],
        selected,
        home,
        0,
      );
      const before = [treeDigest(bare), treeDigest(selected), lockState(selected)];
      q.quiet(
        "baseline run",
        ["run", "plan.json", "--project", ".", "--no-serve", "-o", q.path("install-before.json")],
        bare,
        home,
        0,
      );
      const tag = q.loud(
        "install dialect by tag",
        ["install", "dialects", f.dTag("0.1.0")],
        selected,
        home,
        0,
      );
      q.check(tag.requests > 0, "install by tag made no registry request");
      q.loud(
        "install dialect by digest",
        ["install", "dialects", f.dDigest("0.2.0")],
        bare,
        home,
        0,
      );
      q.loud(
        "install packs by tag and digest",
        ["install", "policy-packs", f.pTag("0.1.0"), f.pDigest("0.2.0")],
        bare,
        home,
        0,
      );
      const dialects = installed(q, home, "dialects");
      q.check(
        JSON.stringify(dialects) ===
          JSON.stringify([`${OWNER}@0.1.0<${q.repository}`, `${OWNER}@0.2.0<${q.repository}`]),
        `installed Dialects differ: ${dialects.join(",")}`,
      );
      q.check(
        installed(q, home, "policy-packs").length === 2,
        "both Policy Pack versions must be installed",
      );
      q.quiet(
        "run after install",
        ["run", "plan.json", "--project", ".", "--no-serve", "-o", q.path("install-after.json")],
        bare,
        home,
        0,
      );
      q.check(
        readFileSync(q.path("install-before.json")).equals(
          readFileSync(q.path("install-after.json")),
        ),
        "install changed project run output",
      );
      q.check(
        JSON.stringify(before) ===
          JSON.stringify([treeDigest(bare), treeDigest(selected), lockState(selected)]),
        "install changed a project tree or lock",
      );
      const active = resolved(q, "selected project after install", selected, home);
      q.check(
        active.dialects[OWNER] === "0.3.0" && active.packs[PACK] === "0.3.0",
        "install changed the active set",
      );
      q.check(
        !(OWNER in resolved(q, "bare project after install", bare, home).dialects),
        "installed Dialect became active",
      );
      return "2 versions per family installed side by side; lock bytes+mtime and trees unchanged; active set unchanged";
    },
  );

  await q.scenario(
    "install --offline: tag refused, missing digest refused, installed digest reused",
    { dialect: true, policyPack: true, ociTag: true, ociDigest: true, offline: true },
    () => {
      const home = q.home("install-offline");
      const project = f.project("install-offline");
      const tag = q.quiet(
        "offline install by tag",
        ["install", "dialects", f.dTag("0.1.0"), "--offline"],
        project,
        home,
        "fail",
      );
      const missing = q.quiet(
        "offline install of missing digest",
        ["install", "dialects", f.dDigest("0.1.0"), "--offline"],
        project,
        home,
        "fail",
      );
      q.check(installed(q, home, "dialects").length === 0, "offline refusal installed content");
      q.loud(
        "install digest online",
        ["install", "dialects", f.dDigest("0.1.0")],
        project,
        home,
        0,
      );
      const store = treeDigest(home);
      q.quiet(
        "offline install of installed digest",
        ["install", "dialects", f.dDigest("0.1.0"), "--offline"],
        project,
        home,
        0,
      );
      q.check(treeDigest(home) === store, "offline reinstall changed the store");
      q.quiet(
        "offline add of installed digest",
        ["add", "dialects", f.dDigest("0.1.0"), "--offline"],
        project,
        home,
        0,
      );
      q.check(
        ociDigest(lockDialect(project)) === q.digests.get("d:0.1.0"),
        "offline add recorded another digest",
      );
      const lock = lockState(project);
      const packTag = q.quiet(
        "offline add by tag",
        ["add", "policy-packs", f.pTag("0.1.0"), "--offline"],
        project,
        home,
        "fail",
      );
      const env = q.quiet(
        "ROOTFORM_OFFLINE add by tag",
        ["add", "policy-packs", f.pTag("0.1.0")],
        project,
        home,
        "fail",
        { ROOTFORM_OFFLINE: "1" },
      );
      q.check(lockState(project) === lock, "refused offline add changed the lock");
      return (
        "offline tag exit " +
        tag.exitCode +
        ", offline missing digest exit " +
        missing.exitCode +
        ", offline add tag exit " +
        packTag.exitCode +
        ", ROOTFORM_OFFLINE=1 add tag exit " +
        env.exitCode +
        "; installed digest reused offline with 0 requests"
      );
    },
  );

  await q.scenario(
    "install same name@version from another repository is refused (REQ-008)",
    { dialect: true, policyPack: true, ociTag: true },
    () => {
      const home = q.home("install-immutable");
      const project = f.project("install-immutable");
      q.loud("install dialect 0.1.0", ["install", "dialects", f.dTag("0.1.0")], project, home, 0);
      q.loud("install pack 0.1.0", ["install", "policy-packs", f.pTag("0.1.0")], project, home, 0);
      const store = treeDigest(home);
      const dialect = q.loud(
        "install alternate dialect 0.1.0",
        ["install", "dialects", f.dTag("0.1.0", q.alternate)],
        project,
        home,
        1,
      );
      const pack = q.loud(
        "install alternate pack 0.1.0",
        ["install", "policy-packs", f.pTag("0.1.0", q.alternate)],
        project,
        home,
        1,
      );
      q.check(treeDigest(home) === store, "refused install changed the store");
      for (const result of [dialect, pack]) {
        q.check(
          result.stderr.includes("uninstall"),
          `refusal does not name uninstall: ${result.stderr}`,
        );
        q.check(
          result.stderr.includes(q.repository),
          `refusal does not name the installed origin: ${result.stderr}`,
        );
      }
      const add = q.loud(
        "add alternate dialect",
        ["add", "dialects", f.dTag("0.1.0", q.alternate)],
        project,
        home,
        1,
      );
      q.check(
        treeDigest(home) === store && !existsSync(join(project, "rootform.lock")),
        "refused add wrote state",
      );
      q.loud(
        "reinstall same origin",
        ["install", "dialects", f.dDigest("0.1.0")],
        project,
        home,
        0,
      );
      q.check(treeDigest(home) === store, "same-origin reinstall changed the store");
      return (
        "both families exit 1, store byte-identical, stderr names " +
        q.repository +
        " and uninstall; add refused the same way (" +
        firstLine(add.stderr) +
        ")"
      );
    },
  );

  await q.scenario(
    "install multi-operand with a missing reference, and usage errors",
    { dialect: true, ociTag: true, ociDigest: true },
    () => {
      const home = q.home("install-multi");
      const project = f.project("install-multi");
      const failed = q.loud(
        "install good then missing",
        ["install", "dialects", f.dTag("0.2.0"), `${q.repository}:dialect-${OWNER}-9.9.9`],
        project,
        home,
        1,
      );
      const left = installed(q, home, "dialects");
      const both = q.loud(
        "install two digests",
        ["install", "dialects", f.dDigest("0.1.0"), f.dDigest("0.2.0")],
        project,
        home,
        0,
      );
      q.check(
        installed(q, home, "dialects").length === 2,
        "two-operand install did not install both",
      );
      const path = q.quiet(
        "install local path",
        ["install", "dialects", `./dialects/${OWNER}`],
        project,
        home,
        2,
      );
      const untagged = q.quiet(
        "install untagged repository",
        ["install", "dialects", q.repository],
        project,
        home,
        2,
      );
      q.check(!existsSync(join(project, "rootform.lock")), "install wrote a lock");
      return (
        "missing operand exit " +
        failed.exitCode +
        " (" +
        firstLine(failed.stderr) +
        "); store after failure: [" +
        left.join(", ") +
        "]; two-digest install ok (" +
        both.requests +
        " requests); local path and untagged repository exit 2 with 0 requests (" +
        firstLine(path.stderr) +
        " / " +
        firstLine(untagged.stderr) +
        ")"
      );
    },
  );
}

async function addScenarios(q: Qualification, f: Fixtures): Promise<void> {
  await q.scenario(
    "add local Dialect and Policy Pack: path recorded, nothing installed, idempotent",
    { dialect: true, policyPack: true, local: true },
    () => {
      const home = q.home("add-local");
      const project = f.project("add-local");
      q.quiet("add local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("add local pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      q.check(
        localPath(lockDialect(project)) === `dialects/${OWNER}`,
        `local Dialect path differs: ${lockText(project)}`,
      );
      q.check(
        localPath(lockPack(project)) === `policies/${PACK}`,
        "local Policy Pack path differs",
      );
      q.check(
        installed(q, home, "dialects").length === 0 &&
          installed(q, home, "policy-packs").length === 0,
        "local add installed content",
      );
      const lock = lockState(project);
      const again = q.quiet(
        "re-add local dialect",
        ["add", "dialects", `./dialects/${OWNER}`],
        project,
        home,
        0,
      );
      q.quiet("re-add local pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      q.check(lockState(project) === lock, "identical add rewrote the lock");
      const active = resolved(q, "run local selection", project, home);
      q.check(
        active.dialects[OWNER] === "0.3.0" &&
          active.packs[PACK] === "0.3.0" &&
          active.evaluations === 1,
        "local selection not active",
      );
      return (
        "lock records dialects/" +
        OWNER +
        " and policies/" +
        PACK +
        "; list --installed empty; re-add is a no-op (" +
        firstLine(again.stdout) +
        ")"
      );
    },
  );

  await q.scenario(
    "add OCI tag Dialect and digest Policy Pack: tagless lock, installed, idempotent",
    { dialect: true, policyPack: true, ociTag: true, ociDigest: true },
    () => {
      const home = q.home("add-oci");
      const project = f.project("add-oci");
      q.loud("add dialect by tag", ["add", "dialects", f.dTag("0.1.0")], project, home, 0);
      q.loud("add pack by digest", ["add", "policy-packs", f.pDigest("0.1.0")], project, home, 0);
      q.check(
        ociDigest(lockDialect(project)) === q.digests.get("d:0.1.0"),
        "Dialect manifest digest differs",
      );
      q.check(
        ociDigest(lockPack(project)) === q.digests.get("p:0.1.0"),
        "Policy Pack manifest digest differs",
      );
      q.check(
        !lockText(project).includes(":dialect-") && !lockText(project).includes(":policy-pack-"),
        "lock contains a tag",
      );
      q.check(
        installed(q, home, "dialects").length === 1 &&
          installed(q, home, "policy-packs").length === 1,
        "OCI add did not install",
      );
      const lock = lockState(project);
      const byDigest = q.loud(
        "re-add dialect by digest",
        ["add", "dialects", f.dDigest("0.1.0")],
        project,
        home,
        0,
      );
      const byTag = q.loud(
        "re-add dialect by tag",
        ["add", "dialects", f.dTag("0.1.0")],
        project,
        home,
        0,
      );
      q.loud("re-add pack by tag", ["add", "policy-packs", f.pTag("0.1.0")], project, home, 0);
      q.check(lockState(project) === lock, "identical OCI add rewrote the lock");
      const active = resolved(q, "run OCI selection", project, home);
      q.check(
        active.dialects[OWNER] === "0.1.0" && active.packs[PACK] === "0.1.0",
        "OCI selection not active",
      );
      return (
        "lock holds repository + manifest/layer digests only; re-add by digest (" +
        byDigest.requests +
        " req) and tag (" +
        byTag.requests +
        " req) leave lock bytes+mtime unchanged"
      );
    },
  );

  await q.scenario(
    "add multi-operand: all-or-nothing project write",
    { dialect: true, policyPack: true, local: true, ociTag: true },
    () => {
      const home = q.home("add-multi");
      const project = f.project("add-multi");
      const missing = q.quiet(
        "add local + missing path",
        ["add", "dialects", `./dialects/${OWNER}`, "./missing"],
        project,
        home,
        "fail",
      );
      q.check(!existsSync(join(project, "rootform.lock")), "failed local multi-add wrote a lock");
      const oci = q.loud(
        "add OCI + missing tag",
        ["add", "dialects", f.dTag("0.2.0"), `${q.repository}:dialect-${OWNER}-9.9.9`],
        project,
        home,
        1,
      );
      q.check(!existsSync(join(project, "rootform.lock")), "failed OCI multi-add wrote a lock");
      const left = installed(q, home, "dialects");
      const duplicate = q.quiet(
        "add same owner twice",
        ["add", "dialects", `./dialects/${OWNER}`, `./overrides/dialect/${OWNER}`],
        project,
        home,
        "fail",
      );
      q.check(!existsSync(join(project, "rootform.lock")), "duplicate-owner add wrote a lock");
      q.loud(
        "add local + OCI in one request",
        ["add", "dialects", "./others/e2e-other", f.dDigest("0.2.0")],
        project,
        home,
        0,
      );
      q.check(readLock(project).dialects.length === 2, "mixed multi-add did not select both");
      q.quiet(
        "add two local packs",
        ["add", "policy-packs", `./policies/${PACK}`, `./policies/${FILTER_PACK}`],
        project,
        home,
        0,
      );
      q.check(readLock(project).policy_packs.length === 2, "two-pack add did not select both");
      const lock = lockState(project);
      const packFail = q.quiet(
        "add pack + missing path",
        ["add", "policy-packs", `./overrides/pack-twin/${PACK}`, "./missing"],
        project,
        home,
        "fail",
      );
      q.check(lockState(project) === lock, "failed pack multi-add changed the lock");
      return (
        "local missing exit " +
        missing.exitCode +
        "; OCI missing exit " +
        oci.exitCode +
        ", lock absent, store kept [" +
        left.join(", ") +
        "] (allowed: selects nothing); duplicate owner exit " +
        duplicate.exitCode +
        "; local+OCI and 2 packs committed together; pack failure exit " +
        packFail.exitCode
      );
    },
  );

  await q.scenario(
    "add an owner already selected with another identity fails and names update",
    { dialect: true, policyPack: true, local: true, ociTag: true },
    () => {
      const home = q.home("add-conflict");
      const project = f.project("add-conflict");
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("select local pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      const lock = lockState(project);
      const dialect = q.loud(
        "add OCI for selected owner",
        ["add", "dialects", f.dTag("0.1.0")],
        project,
        home,
        1,
      );
      const pack = q.quiet(
        "add other local pack source",
        ["add", "policy-packs", `./overrides/pack/${PACK}`],
        project,
        home,
        1,
      );
      q.check(lockState(project) === lock, "conflicting add changed the lock");
      q.check(
        dialect.stderr.includes("update") && pack.stderr.includes("update"),
        "conflict does not name update",
      );
      return (
        "exit 1 for both families, lock unchanged, stderr names update (" +
        firstLine(dialect.stderr) +
        ")"
      );
    },
  );

  await q.scenario(
    "add --dry-run writes nothing, including when a later operand fails",
    { dialect: true, policyPack: true, local: true, ociTag: true },
    () => {
      const home = q.home("add-dry");
      const project = f.project("add-dry");
      const tree = treeDigest(project);
      q.quiet(
        "dry-run local",
        ["add", "dialects", `./dialects/${OWNER}`, "--dry-run"],
        project,
        home,
        0,
      );
      const oci = q.loud(
        "dry-run OCI",
        ["add", "dialects", f.dTag("0.2.0"), "--dry-run"],
        project,
        home,
        0,
      );
      q.loud(
        "dry-run OCI + missing",
        ["add", "dialects", f.dTag("0.1.0"), `${q.repository}:dialect-${OWNER}-9.9.9`, "--dry-run"],
        project,
        home,
        1,
      );
      q.check(treeDigest(project) === tree, "dry-run changed the project");
      const store =
        installed(q, home, "policy-packs").length + installed(q, home, "dialects").length;
      q.check(store === 0, "dry-run installed content");
      return (
        "project tree and ROOTFORM_HOME unchanged; OCI dry-run resolved with " +
        oci.requests +
        " requests"
      );
    },
  );
}

async function overrideScenarios(q: Qualification, f: Fixtures): Promise<void> {
  const dialectOverride = ["--dialect", `./overrides/dialect/${OWNER}`];
  const packOverride = ["--policy-pack", `./overrides/pack/${PACK}`];

  await q.scenario(
    "override against no selection: Dialect and Policy Pack, lock untouched",
    { dialect: true, policyPack: true, local: true },
    () => {
      const home = q.home("override-none");
      const project = f.project("override-none");
      const tree = treeDigest(project);
      const used = resolved(q, "run with overrides", project, home, [
        ...dialectOverride,
        ...packOverride,
      ]);
      q.check(
        used.dialects[OWNER] === "0.4.0" && used.packs[PACK] === "0.9.0",
        `overrides not used: ${JSON.stringify(used)}`,
      );
      q.check(used.stderr.length > 0, "override notice missing on standard error");
      q.check(
        active(q, project, home, dialectOverride).version === "0.4.0",
        "list ignores --dialect",
      );
      q.quiet(
        "run with override",
        [
          "run",
          "plan.json",
          "--project",
          ".",
          "--no-serve",
          ...dialectOverride,
          "-o",
          q.path("override-none.json"),
        ],
        project,
        home,
        0,
      );
      q.check(
        treeDigest(project) === tree && !existsSync(join(project, "rootform.lock")),
        "override wrote project state",
      );
      return `run and list use 0.4.0 + pack 0.9.0; stderr notice: ${firstLine(used.stderr)}`;
    },
  );

  await q.scenario(
    "override replaces a local selection by name",
    { dialect: true, policyPack: true, local: true },
    () => {
      const home = q.home("override-local");
      const project = f.project("override-local");
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("select local pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      q.quiet(
        "select filter pack",
        ["add", "policy-packs", `./policies/${FILTER_PACK}`],
        project,
        home,
        0,
      );
      const lock = lockState(project);
      const base = resolved(q, "run selection", project, home, [], "fail");
      const used = resolved(
        q,
        "run with overrides",
        project,
        home,
        [...dialectOverride, ...packOverride],
        "fail",
      );
      q.check(
        base.dialects[OWNER] === "0.3.0" && base.packs[PACK] === "0.3.0",
        "selection not active",
      );
      q.check(
        used.dialects[OWNER] === "0.4.0" && used.packs[PACK] === "0.9.0",
        "override did not replace",
      );
      q.check(
        used.packs[FILTER_PACK] === "0.1.0",
        "Policy Pack override dropped another selected pack",
      );
      q.check(lockState(project) === lock, "override changed the lock");
      return (
        "0.3.0 -> 0.4.0 and pack 0.3.0 -> 0.9.0 by name; " +
        FILTER_PACK +
        " kept (overlay); lock unchanged"
      );
    },
  );

  await q.scenario(
    "override replaces an OCI selection without resolving or verifying it",
    { dialect: true, policyPack: true, ociTag: true, ociDigest: true },
    () => {
      const home = q.home("override-oci");
      const project = f.project("override-oci");
      q.loud("select OCI dialect", ["add", "dialects", f.dTag("0.1.0")], project, home, 0);
      q.loud("select OCI pack", ["add", "policy-packs", f.pDigest("0.1.0")], project, home, 0);
      const restore = away(home);
      mkdirSync(home);
      const missing = resolved(q, "run without installed copies", project, home, [], "fail");
      const used = resolved(q, "run with both overrides and empty home", project, home, [
        ...dialectOverride,
        ...packOverride,
      ]);
      q.check(
        used.dialects[OWNER] === "0.4.0" && used.packs[PACK] === "0.9.0",
        "overrides not used",
      );
      renameSync(home, `${home}.empty`);
      restore();
      return (
        "empty home: plain run exit " +
        missing.exitCode +
        " (" +
        firstLine(missing.stderr) +
        "); with overrides exit 0 using 0.4.0/0.9.0"
      );
    },
  );

  await q.scenario(
    "override replaces a vendored selection",
    { dialect: true, policyPack: true, local: true, vendor: true },
    () => {
      const home = q.home("override-vendor");
      const project = f.project("override-vendor");
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("select local pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      q.quiet("vendor", ["vendor"], project, home, 0);
      const vendor = treeDigest(join(project, ".rootform"));
      const used = resolved(q, "run vendored with overrides", project, home, [
        ...dialectOverride,
        ...packOverride,
      ]);
      q.check(
        used.dialects[OWNER] === "0.4.0" && used.packs[PACK] === "0.9.0",
        "override did not replace vendored units",
      );
      q.check(
        treeDigest(join(project, ".rootform")) === vendor,
        "override changed the vendor tree",
      );
      return "vendored 0.3.0 replaced by 0.4.0/0.9.0 for one run; .rootform unchanged";
    },
  );

  await q.scenario("override replaces an embedded owner", { dialect: true, local: true }, () => {
    const home = q.home("override-embedded");
    const project = f.project("override-embedded");
    const base = resolved(q, "run embedded", project, home);
    const used = resolved(q, "run with embedded override", project, home, [
      "--dialect",
      "./overrides/aws",
    ]);
    q.check(
      base.dialects.aws !== "9.9.9" && used.dialects.aws === "9.9.9",
      "embedded override not used",
    );
    return `embedded aws ${base.dialects.aws} -> 9.9.9 for one run`;
  });

  await q.scenario(
    "override duplicates and --locked are rejected before any work",
    { dialect: true, policyPack: true, local: true },
    () => {
      const home = q.home("override-reject");
      const project = f.project("override-reject");
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      const lock = lockState(project);
      const twins = q.quiet(
        "two Dialect overrides, same owner",
        [
          "run",
          "plan.json",
          "--project",
          ".",
          "--no-serve",
          ...dialectOverride,
          "--dialect",
          `./overrides/dialect-twin/${OWNER}`,
        ],
        project,
        home,
        "fail",
      );
      const packs = q.quiet(
        "two Policy Pack overrides, same name",
        [
          "run",
          "plan.json",
          "--project",
          ".",
          "--no-serve",
          ...packOverride,
          "--policy-pack",
          `./overrides/pack-twin/${PACK}`,
        ],
        project,
        home,
        "fail",
      );
      const locked = q.quiet(
        "override with --locked",
        ["run", "plan.json", "--project", ".", "--no-serve", "--locked", ...dialectOverride],
        project,
        home,
        "fail",
      );
      const lockedPack = q.quiet(
        "pack override with --locked",
        ["run", "plan.json", "--project", ".", "--no-serve", "--locked", ...packOverride],
        project,
        home,
        "fail",
      );
      const lockedBuild = q.quiet(
        "run override with --locked",
        ["run", "plan.json", "--project", ".", "--no-serve", "--locked", ...dialectOverride],
        project,
        home,
        "fail",
      );
      q.check(lockState(project) === lock, "rejected override changed the lock");
      return (
        "duplicate Dialect exit " +
        twins.exitCode +
        " (" +
        firstLine(twins.stderr) +
        "); duplicate pack exit " +
        packs.exitCode +
        "; --locked with --dialect exit " +
        locked.exitCode +
        ", with --policy-pack exit " +
        lockedPack.exitCode +
        ", run exit " +
        lockedBuild.exitCode
      );
    },
  );
}

async function updateScenarios(q: Qualification, f: Fixtures): Promise<void> {
  await q.scenario(
    "update re-records drifted local Dialect and Policy Pack",
    { dialect: true, policyPack: true, local: true },
    () => {
      const home = q.home("update-drift");
      const project = f.project("update-drift");
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("select local pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      const recorded = String(lockDialect(project)?.content_digest);
      const dialectFile = join(project, "dialects", OWNER, "dialect.rf.hcl");
      writeFileSync(
        dialectFile,
        readFileSync(dialectFile, "utf8").replace("(local source)", "(edited)"),
      );
      const packFile = join(project, "policies", PACK, "policies", "service-present.rf.hcl");
      writeFileSync(packFile, readFileSync(packFile, "utf8").replace("0.3.0.", "0.3.0 edited."));
      const lock = lockState(project);
      const drift = resolved(q, "run drifted", project, home, [], "fail");
      const run = q.quiet(
        "run drifted",
        ["run", "plan.json", "--project", ".", "--no-serve"],
        project,
        home,
        "fail",
      );
      q.check(
        drift.stderr.includes("rootform update") && drift.stderr.includes("--dialect"),
        `drift diagnostic incomplete: ${drift.stderr}`,
      );
      q.check(lockState(project) === lock, "drift changed the lock");
      const dry = q.quiet(
        "update --dry-run",
        ["update", "dialect", OWNER, "--dry-run"],
        project,
        home,
        0,
      );
      q.check(lockState(project) === lock, "dry-run update changed the lock");
      q.quiet("update dialect", ["update", "dialect", OWNER], project, home, 0);
      const packDrift = resolved(q, "run with pack still drifted", project, home, [], "fail");
      q.quiet("update pack", ["update", "policy-pack", PACK], project, home, 0);
      q.check(
        String(lockDialect(project)?.content_digest) !== recorded,
        "update kept the old digest",
      );
      resolved(q, "run after update", project, home, ["--locked"]);
      return (
        "drift: run exit " +
        drift.exitCode +
        ", run exit " +
        run.exitCode +
        " (" +
        firstLine(drift.stderr) +
        "); dry-run no write (" +
        firstLine(dry.stdout) +
        "); pack drift alone exit " +
        packDrift.exitCode +
        "; after update run --locked exit 0"
      );
    },
  );

  await q.scenario(
    "update OCI A to B by tag and back by digest; no operand fails",
    { dialect: true, policyPack: true, ociTag: true, ociDigest: true },
    () => {
      const home = q.home("update-oci");
      const project = f.project("update-oci");
      q.loud("select OCI dialect 0.1.0", ["add", "dialects", f.dTag("0.1.0")], project, home, 0);
      q.loud("select OCI pack 0.1.0", ["add", "policy-packs", f.pTag("0.1.0")], project, home, 0);
      q.loud(
        "update dialect to 0.2.0 tag",
        ["update", "dialect", OWNER, f.dTag("0.2.0")],
        project,
        home,
        0,
      );
      q.loud(
        "update pack to 0.2.0 digest",
        ["update", "policy-pack", PACK, f.pDigest("0.2.0")],
        project,
        home,
        0,
      );
      let used = resolved(q, "run after update", project, home);
      q.check(
        used.dialects[OWNER] === "0.2.0" && used.packs[PACK] === "0.2.0",
        "update did not switch to 0.2.0",
      );
      q.check(
        ociDigest(lockDialect(project)) === q.digests.get("d:0.2.0"),
        "Dialect digest differs",
      );
      q.loud(
        "update dialect back by digest",
        ["update", "dialect", OWNER, f.dDigest("0.1.0")],
        project,
        home,
        0,
      );
      used = resolved(q, "run after downgrade", project, home);
      q.check(used.dialects[OWNER] === "0.1.0", "downgrade by digest failed");
      const lock = lockState(project);
      const bare = q.quiet(
        "update OCI without operand",
        ["update", "dialect", OWNER],
        project,
        home,
        2,
      );
      const barePack = q.quiet(
        "update OCI pack without operand",
        ["update", "policy-pack", PACK],
        project,
        home,
        2,
      );
      const unselected = q.quiet(
        "update unselected owner",
        ["update", "dialect", "e2e-other", "./others/e2e-other"],
        project,
        home,
        "fail",
      );
      q.check(lockState(project) === lock, "refused update changed the lock");
      return (
        "0.1.0 -> 0.2.0 (tag) -> 0.1.0 (digest); no operand exit " +
        bare.exitCode +
        "/" +
        barePack.exitCode +
        " (" +
        firstLine(bare.stderr) +
        "); unselected exit " +
        unselected.exitCode
      );
    },
  );

  await q.scenario(
    "update refuses a rename and switches local <-> OCI",
    { dialect: true, policyPack: true, local: true, ociTag: true },
    () => {
      const home = q.home("update-switch");
      const project = f.project("update-switch");
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("select local pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      const lock = lockState(project);
      const rename = q.quiet(
        "update to another owner",
        ["update", "dialect", OWNER, "./others/e2e-other"],
        project,
        home,
        1,
      );
      const renamePack = q.quiet(
        "update to another pack",
        ["update", "policy-pack", PACK, `./policies/${FILTER_PACK}`],
        project,
        home,
        1,
      );
      q.check(lockState(project) === lock, "rename changed the lock");
      q.loud(
        "local -> OCI dialect",
        ["update", "dialect", OWNER, f.dTag("0.2.0")],
        project,
        home,
        0,
      );
      q.loud(
        "local -> OCI pack",
        ["update", "policy-pack", PACK, f.pTag("0.2.0")],
        project,
        home,
        0,
      );
      q.check(
        ociDigest(lockDialect(project)) === q.digests.get("d:0.2.0") &&
          localPath(lockDialect(project)) === "",
        "local -> OCI incomplete",
      );
      q.quiet(
        "OCI -> local dialect",
        ["update", "dialect", OWNER, `./dialects/${OWNER}`],
        project,
        home,
        0,
      );
      q.quiet(
        "OCI -> local pack",
        ["update", "policy-pack", PACK, `./policies/${PACK}`],
        project,
        home,
        0,
      );
      q.check(
        lockState(project).split("@")[0] === lock.split("@")[0],
        "round trip did not restore the original lock bytes",
      );
      return (
        "rename exit " +
        rename.exitCode +
        "/" +
        renamePack.exitCode +
        " (" +
        firstLine(rename.stderr) +
        "); local -> OCI -> local restores identical lock bytes"
      );
    },
  );
}

async function removeScenarios(q: Qualification, f: Fixtures): Promise<void> {
  await q.scenario(
    "remove selections; linking blocks removal of a needed Dialect",
    { dialect: true, policyPack: true, local: true },
    () => {
      const home = q.home("remove");
      const project = f.project("remove");
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("select local pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      const lock = lockState(project);
      const blocked = q.quiet(
        "remove needed dialect",
        ["remove", "dialects", OWNER],
        project,
        home,
        1,
      );
      q.check(lockState(project) === lock, "blocked remove changed the lock");
      q.check(
        blocked.stderr.includes(PACK),
        `link failure does not name the pack: ${blocked.stderr}`,
      );
      const unlinked = q.quiet(
        "add pack needing unselected dialect",
        ["add", "policy-packs", `./policies/${FILTER_PACK}`],
        f.project("remove-unlinked"),
        home,
        1,
      );
      q.quiet("remove pack", ["remove", "policy-packs", PACK], project, home, 0);
      q.quiet("remove dialect", ["remove", "dialects", OWNER], project, home, 0);
      const empty = readLock(project);
      q.check(
        empty.dialects.length === 0 && empty.policy_packs.length === 0,
        "remove left selections",
      );
      const after = lockState(project);
      q.quiet("repeat remove", ["remove", "dialects", OWNER], project, home, 0);
      q.check(lockState(project) === after, "repeated remove rewrote the lock");
      return (
        "needed Dialect remove exit " +
        blocked.exitCode +
        " naming " +
        PACK +
        " (" +
        firstLine(blocked.stderr) +
        "); unlinkable add exit " +
        unlinked.exitCode +
        "; repeated remove is a no-op"
      );
    },
  );

  await q.scenario(
    "embedded owner: exclude, re-add, replace, restore",
    { dialect: true, local: true },
    () => {
      const home = q.home("embedded");
      const project = f.project("embedded");
      q.quiet("exclude aws", ["remove", "dialects", "aws", "--embedded"], project, home, 0);
      q.check(
        JSON.stringify(readLock(project).excluded_owners) === JSON.stringify(["aws"]),
        "exclusion not recorded",
      );
      q.check(
        !("aws" in resolved(q, "run without aws", project, home).dialects),
        "excluded owner still active",
      );
      q.quiet("re-add bare aws", ["add", "dialects", "aws"], project, home, 0);
      q.check(readLock(project).excluded_owners.length === 0, "bare add kept the exclusion");
      const embedded = resolved(q, "run with aws", project, home).dialects.aws;
      const noReplace = q.quiet(
        "add aws without --replace",
        ["add", "dialects", "./overrides/aws"],
        project,
        home,
        "fail",
      );
      q.quiet("replace aws", ["add", "dialects", "./overrides/aws", "--replace"], project, home, 0);
      q.check(
        JSON.stringify(readLock(project).replacements) === JSON.stringify(["aws"]),
        "replacement not recorded",
      );
      q.check(
        resolved(q, "run replaced aws", project, home).dialects.aws === "9.9.9",
        "replacement not active",
      );
      const lock = lockState(project);
      const excludeReplaced = q.quiet(
        "exclude replaced aws",
        ["remove", "dialects", "aws", "--embedded"],
        project,
        home,
        "fail",
      );
      const wrongReplace = q.quiet(
        "--replace on non-embedded owner",
        ["add", "dialects", `./dialects/${OWNER}`, "--replace"],
        project,
        home,
        1,
      );
      const unknown = q.quiet(
        "exclude non-embedded owner",
        ["remove", "dialects", OWNER, "--embedded"],
        project,
        home,
        "fail",
      );
      q.check(lockState(project) === lock, "refused embedded change altered the lock");
      const restored = q.quiet(
        "remove replacing aws",
        ["remove", "dialects", "aws"],
        project,
        home,
        0,
      );
      q.check(readLock(project).replacements.length === 0, "replacement kept after remove");
      q.check(
        resolved(q, "run restored aws", project, home).dialects.aws === embedded,
        "embedded aws not restored",
      );
      return (
        "exclude/re-add/replace/restore ok; add without --replace exit " +
        noReplace.exitCode +
        "; exclude replaced exit " +
        excludeReplaced.exitCode +
        "; --replace non-embedded exit " +
        wrongReplace.exitCode +
        "; exclude non-embedded exit " +
        unknown.exitCode +
        "; remove says: " +
        firstLine(restored.stdout)
      );
    },
  );

  await q.scenario(
    "excluding an embedded owner a pack needs is blocked",
    { dialect: true, policyPack: true, local: true },
    () => {
      const home = q.home("embedded-link");
      const project = f.project("embedded-link");
      writePack(
        join(project, "policies", "aws-guard"),
        "aws-guard",
        "0.1.0",
        [{ name: "bucket", assert: true, target: "aws.concept.api-gateway" }],
        q.options.root,
      );
      const added = q.quiet(
        "select pack using aws",
        ["add", "policy-packs", "./policies/aws-guard"],
        project,
        home,
        "any",
      );
      if (added.exitCode !== 0)
        return `fixture concept aws.concept.api-gateway not linkable: ${firstLine(added.stderr)}`;
      const lock = lockState(project);
      const blocked = q.quiet(
        "exclude needed aws",
        ["remove", "dialects", "aws", "--embedded"],
        project,
        home,
        1,
      );
      q.check(lockState(project) === lock, "blocked exclusion changed the lock");
      return `exclusion exit ${blocked.exitCode} (${firstLine(blocked.stderr)})`;
    },
  );
}

async function uninstallScenarios(q: Qualification, f: Fixtures): Promise<void> {
  await q.scenario(
    "uninstall exact, multi, duplicate, missing; init restores",
    { dialect: true, policyPack: true, ociTag: true, ociDigest: true },
    () => {
      const home = q.home("uninstall");
      const project = f.project("uninstall");
      q.loud(
        "install two dialects",
        ["install", "dialects", f.dDigest("0.1.0"), f.dDigest("0.2.0")],
        project,
        home,
        0,
      );
      q.loud("select OCI dialect 0.1.0", ["add", "dialects", f.dDigest("0.1.0")], project, home, 0);
      q.loud(
        "select OCI pack 0.1.0",
        ["add", "policy-packs", f.pDigest("0.1.0")],
        project,
        home,
        0,
      );
      const lock = lockState(project);
      const store = treeDigest(home);
      const missing = q.quiet(
        "uninstall existing + missing",
        ["uninstall", "dialects", `${OWNER}@0.2.0`, `${OWNER}@9.9.9`],
        project,
        home,
        1,
      );
      q.check(treeDigest(home) === store, "partial uninstall deleted content");
      const syntax = q.quiet(
        "uninstall without version",
        ["uninstall", "dialects", OWNER],
        project,
        home,
        2,
      );
      const duplicate = q.quiet(
        "uninstall duplicate operand",
        ["uninstall", "dialects", `${OWNER}@0.2.0`, `${OWNER}@0.2.0`],
        project,
        home,
        "any",
      );
      const duplicateStore = treeDigest(home) === store ? "store unchanged" : "0.2.0 deleted once";
      if (duplicate.exitCode === 0) {
        q.loud("reinstall 0.2.0", ["install", "dialects", f.dDigest("0.2.0")], project, home, 0);
      }
      q.quiet(
        "uninstall exact selected",
        ["uninstall", "dialects", `${OWNER}@0.1.0`],
        project,
        home,
        0,
      );
      q.quiet(
        "uninstall exact pack",
        ["uninstall", "policy-packs", `${PACK}@0.1.0`],
        project,
        home,
        0,
      );
      q.check(lockState(project) === lock, "uninstall changed the lock");
      const broken = resolved(q, "run after uninstall", project, home, [], "fail");
      q.check(
        /init/u.test(broken.stderr),
        `missing content does not point to init: ${broken.stderr}`,
      );
      q.loud("init restores", ["init", ".", "--locked", "--no-input"], project, home, 0);
      const restored = resolved(q, "run after init", project, home);
      q.check(
        restored.dialects[OWNER] === "0.1.0" && restored.packs[PACK] === "0.1.0",
        "init did not restore",
      );
      q.check(lockState(project) === lock, "init changed the lock");
      const left = installed(q, home, "dialects");
      q.quiet(
        "uninstall two",
        ["uninstall", "dialects", `${OWNER}@0.1.0`, `${OWNER}@0.2.0`],
        project,
        home,
        0,
      );
      q.check(installed(q, home, "dialects").length === 0, "multi uninstall left versions");
      return (
        "missing operand exit " +
        missing.exitCode +
        " with nothing deleted; no version exit " +
        syntax.exitCode +
        "; duplicate exit " +
        duplicate.exitCode +
        " (" +
        duplicateStore +
        "); after uninstall run exit " +
        broken.exitCode +
        " (" +
        firstLine(broken.stderr) +
        "); init restored exact digests; before multi: [" +
        left.join(", ") +
        "]"
      );
    },
  );
}

function vendorUnit(project: string, family: "dialects" | "policy-packs", name: string): string {
  return join(project, ".rootform", family, name);
}

async function vendorScenarios(q: Qualification, f: Fixtures): Promise<void> {
  const prepareVendored = (name: string, home: string): string => {
    const project = f.project(name);
    q.loud("select OCI dialect", ["add", "dialects", f.dDigest("0.1.0")], project, home, 0);
    q.quiet("select local dialect", ["add", "dialects", "./others/e2e-other"], project, home, 0);
    q.loud("select OCI pack", ["add", "policy-packs", f.pDigest("0.1.0")], project, home, 0);
    q.quiet("vendor all", ["vendor"], project, home, 0);
    return project;
  };

  await q.scenario(
    "vendor lifecycle: exclusive source, follows add/update/remove",
    { dialect: true, policyPack: true, local: true, ociDigest: true, vendor: true, offline: true },
    () => {
      const home = q.home("vendor");
      const project = prepareVendored("vendor", home);
      q.check(
        existsSync(vendorUnit(project, "dialects", OWNER)) &&
          existsSync(vendorUnit(project, "dialects", "e2e-other")),
        "Dialects not vendored",
      );
      q.check(existsSync(vendorUnit(project, "policy-packs", PACK)), "Policy Pack not vendored");
      const restoreHome = away(home);
      const restoreSource = away(join(project, "others"));
      const used = resolved(q, "run from vendor only", project, home, ["--locked"]);
      q.check(
        used.dialects[OWNER] === "0.1.0" &&
          used.dialects["e2e-other"] === "0.1.0" &&
          used.packs[PACK] === "0.1.0",
        "vendor tree not used",
      );
      q.quiet(
        "init offline from vendor only",
        ["init", ".", "--locked", "--offline", "--no-input"],
        project,
        home,
        0,
      );
      restoreSource();
      restoreHome();
      q.loud(
        "update vendored dialect",
        ["update", "dialect", OWNER, f.dDigest("0.2.0")],
        project,
        home,
        0,
      );
      q.check(
        readFileSync(
          join(vendorUnit(project, "dialects", OWNER), "dialect.rf.hcl"),
          "utf8",
        ).includes("0.2.0"),
        "update did not revendor",
      );
      q.quiet("remove vendored pack", ["remove", "policy-packs", PACK], project, home, 0);
      q.check(
        !existsSync(join(project, ".rootform", "policy-packs")),
        "removing the last pack kept its family tree",
      );
      // The family tree went away with its last pack and Git keeps no empty
      // directory, so a new pack is not vendored implicitly; add says how.
      const readd = q.quiet(
        "add local pack while vendored",
        ["add", "policy-packs", `./policies/${PACK}`],
        project,
        home,
        0,
      );
      q.check(
        !existsSync(vendorUnit(project, "policy-packs", PACK)) &&
          readd.stdout.includes("rootform vendor policy-packs"),
        `add did not name vendor for the unvendored family: ${readd.stdout}`,
      );
      q.quiet("vendor policy-packs", ["vendor", "policy-packs"], project, home, 0);
      q.check(
        existsSync(vendorUnit(project, "policy-packs", PACK)),
        "vendor policy-packs did not vendor the new pack",
      );
      const leftovers = readdirSync(join(project, ".rootform")).filter((entry) =>
        entry.startsWith(".rootform-vendor"),
      );
      q.check(leftovers.length === 0, `staging residue left: ${leftovers.join(",")}`);
      return "home and local source moved away: run --locked and init --offline read .rootform only; update revendored 0.2.0; removing last pack removed family; add named vendor policy-packs, which vendored the new pack; no residue";
    },
  );

  const corruptions: Array<{ name: string; apply: (project: string) => void }> = [
    {
      name: "missing unit",
      apply: (project) => {
        renameSync(vendorUnit(project, "dialects", "e2e-other"), join(project, "e2e-other.moved"));
      },
    },
    {
      name: "extra unit",
      apply: (project) => {
        cpSync(
          vendorUnit(project, "dialects", "e2e-other"),
          vendorUnit(project, "dialects", "e2e-extra"),
          { recursive: true },
        );
      },
    },
    {
      name: "modified file",
      apply: (project) => {
        const file = join(vendorUnit(project, "dialects", OWNER), "dialect.rf.hcl");
        writeFileSync(file, `${readFileSync(file, "utf8")}\n`);
      },
    },
    {
      name: "wrong version",
      apply: (project) => {
        const source = q.path("sources", "dialect-0.2.0", OWNER);
        for (const entry of readdirSync(source))
          cpSync(join(source, entry), join(vendorUnit(project, "dialects", OWNER), entry));
      },
    },
    {
      name: "modified Policy Pack file",
      apply: (project) => {
        const file = join(vendorUnit(project, "policy-packs", PACK), "pack.rf.hcl");
        writeFileSync(file, `${readFileSync(file, "utf8")}\n`);
      },
    },
    {
      name: "marker removed",
      apply: (project) => {
        renameSync(
          join(vendorUnit(project, "dialects", OWNER), ".rootform-vendor.json"),
          join(project, "marker.moved"),
        );
      },
    },
  ];
  for (const corruption of corruptions) {
    await q.scenario(
      `vendor corruption fails closed then vendor repairs: ${corruption.name}`,
      {
        dialect: true,
        policyPack: true,
        local: true,
        ociDigest: true,
        vendor: true,
        offline: true,
      },
      () => {
        const home = q.home(`vendor-${corruption.name.replaceAll(" ", "-")}`);
        const project = prepareVendored(`vendor-${corruption.name.replaceAll(" ", "-")}`, home);
        const lock = lockState(project);
        corruption.apply(project);
        const failed = resolved(q, "run corrupted vendor", project, home, [], "fail");
        const init = q.quiet(
          "init corrupted vendor",
          ["init", ".", "--locked", "--offline", "--no-input"],
          project,
          home,
          "fail",
        );
        const run = q.quiet(
          "run corrupted vendor",
          ["run", "plan.json", "--project", ".", "--no-serve"],
          project,
          home,
          "any",
        );
        const mutate = q.quiet(
          "mutation on corrupted vendor",
          ["add", "policy-packs", `./policies/${FILTER_PACK}`],
          project,
          home,
          "any",
        );
        q.quiet("vendor --offline repairs", ["vendor", "--offline"], project, home, 0);
        resolved(q, "run repaired vendor", project, home, ["--locked"]);
        q.check(lockState(project) === lock || mutate.exitCode === 0, "repair changed the lock");
        return (
          "run exit " +
          failed.exitCode +
          " (" +
          firstLine(failed.stderr) +
          "); init --offline exit " +
          init.exitCode +
          "; run exit " +
          run.exitCode +
          "; add during corruption exit " +
          mutate.exitCode +
          "; vendor --offline repaired, run --locked exit 0"
        );
      },
    );
  }

  await q.scenario(
    "one family vendored: the other family reads its own sources",
    { dialect: true, policyPack: true, ociDigest: true, vendor: true },
    () => {
      const home = q.home("vendor-half");
      const project = f.project("vendor-half");
      q.loud("select OCI dialect", ["add", "dialects", f.dDigest("0.1.0")], project, home, 0);
      q.loud("select OCI pack", ["add", "policy-packs", f.pDigest("0.1.0")], project, home, 0);
      q.quiet("vendor dialects only", ["vendor", "dialects"], project, home, 0);
      q.check(
        !existsSync(join(project, ".rootform", "policy-packs")),
        "vendor dialects wrote packs",
      );
      const store = join(home, "policy-packs");
      const restore = away(store);
      const packMissing = resolved(q, "run with pack store gone", project, home, [], "fail");
      restore();
      const restoreDialects = away(join(home, "dialects"));
      const ok = resolved(q, "run with Dialect store gone", project, home);
      restoreDialects();
      q.check(
        ok.dialects[OWNER] === "0.1.0" && ok.packs[PACK] === "0.1.0",
        "half-vendored project not resolved",
      );
      return (
        "Dialects from .rootform (store not needed), pack from store; pack store gone -> run exit " +
        packMissing.exitCode
      );
    },
  );
}

async function sentinelScenarios(q: Qualification, f: Fixtures): Promise<void> {
  await q.scenario(
    "stale rootform.lock.new blocks add, update, remove, vendor",
    { dialect: true, policyPack: true, local: true, vendor: true },
    () => {
      const home = q.home("sentinel");
      const project = f.project("sentinel");
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("vendor", ["vendor"], project, home, 0);
      writeFileSync(join(project, "rootform.lock.new"), "");
      mkdirSync(join(project, ".rootform", ".rootform-vendor-old-1"));
      const tree = treeDigest(project);
      const codes = [
        q.quiet(
          "add under sentinel",
          ["add", "policy-packs", `./policies/${PACK}`],
          project,
          home,
          "fail",
        ),
        q.quiet("update under sentinel", ["update", "dialect", OWNER], project, home, "fail"),
        q.quiet("remove under sentinel", ["remove", "dialects", OWNER], project, home, "fail"),
        q.quiet("vendor under sentinel", ["vendor"], project, home, "fail"),
        q.quiet(
          "vendor family under sentinel",
          ["vendor", "dialects", "--offline"],
          project,
          home,
          "fail",
        ),
      ];
      q.check(treeDigest(project) === tree, "a command changed the project under a sentinel");
      for (const result of codes)
        q.check(
          result.stderr.includes("rootform.lock.new"),
          `refusal does not name the sentinel: ${result.stderr}`,
        );
      const read = resolved(q, "run under sentinel", project, home);
      renameSync(join(project, "rootform.lock.new"), q.path("sentinel.moved"));
      q.quiet("vendor after sentinel removal", ["vendor"], project, home, 0);
      q.check(
        !existsSync(join(project, ".rootform", ".rootform-vendor-old-1")),
        "vendor did not clear residue once it owned the sentinel",
      );
      return (
        "add/update/remove/vendor/vendor dialects exit " +
        codes.map((result) => result.exitCode).join("/") +
        ", project byte-identical incl. backup residue; run still exit " +
        read.exitCode +
        "; after removal vendor clears residue"
      );
    },
  );
}

async function networkScenarios(q: Qualification, f: Fixtures): Promise<void> {
  await q.scenario(
    "normal commands make zero registry requests",
    { dialect: true, policyPack: true, ociTag: true, ociDigest: true },
    async () => {
      const home = q.home("network");
      const project = f.project("network");
      q.loud("select OCI dialect", ["add", "dialects", f.dTag("0.1.0")], project, home, 0);
      q.loud("select OCI pack", ["add", "policy-packs", f.pDigest("0.1.0")], project, home, 0);
      const commands: Array<[string, string[]]> = [
        [
          "run",
          [
            "run",
            "plan.json",
            "--project",
            ".",
            "--no-serve",
            "--locked",
            "-o",
            q.path("network.json"),
          ],
        ],
        [
          "run policies",
          ["run", "plan.json", "--project", ".", "--no-serve", "--locked", "--policy", `${PACK}/*`],
        ],
        ["list dialects", ["list", "dialects", OWNER]],
        ["list policy-packs", ["list", "policy-packs"]],
        ["list --installed", ["list", "dialects", "--installed"]],
        ["show dialect", ["show", OWNER]],
        ["show policy", ["show", "policy", `${PACK}.policy.service-present`]],
        ["explain semantics", ["explain", "semantics", `${OWNER}.rule.portable-service`]],
        ["explain architecture", ["explain", "architecture", "portable_service.main"]],
        ["explain policy", ["explain", "policy", `${PACK}.policy.service-present`]],
        ["init installed", ["init", ".", "--locked", "--no-input"]],
        ["init --offline", ["init", ".", "--locked", "--offline", "--no-input"]],
        ["vendor --offline", ["vendor", "--offline"]],
        ["remove", ["remove", "policy-packs", PACK, "--dry-run"]],
      ];
      const codes: string[] = [];
      for (const [label, arguments_] of commands)
        codes.push(`${label}=${q.quiet(label, arguments_, project, home, "any").exitCode}`);
      const served = await q.serve(
        "run",
        ["run", "plan.json", "--project", ".", "--no-browser", "--port", "0"],
        project,
        home,
      );
      q.check(served.requests === 0, `run contacted the registry ${served.requests} times`);
      codes.push(`run=${served.started ? "served" : "no url"}`);
      // vendor --offline above created .rootform; set it aside so the build
      // must find the selection in the empty home.
      const vendored = join(project, ".rootform");
      renameSync(vendored, `${vendored}.away`);
      const restore = away(home);
      mkdirSync(home);
      const missing = q.quiet(
        "run with empty home",
        ["run", "plan.json", "--project", ".", "--no-serve", "--locked"],
        project,
        home,
        "fail",
      );
      renameSync(home, `${home}.empty`);
      restore();
      renameSync(`${vendored}.away`, vendored);
      return (
        "0 requests each: " +
        codes.join(", ") +
        "; empty home run exit " +
        missing.exitCode +
        " without fetching (" +
        firstLine(missing.stderr) +
        ")"
      );
    },
  );

  await q.scenario(
    "moved tag: lock pins digest, only an explicit update follows the tag",
    { dialect: true, ociTag: true, ociDigest: true, offline: true },
    async () => {
      const home = q.home("tag-move");
      const project = f.project("tag-move");
      q.loud(
        "select movable tag",
        ["add", "dialects", f.dTag("0.1.0", q.movable)],
        project,
        home,
        0,
      );
      const lock = lockState(project);
      await q.moveTag(q.movable, `dialect-${OWNER}-0.1.0`, q.digests.get("m:0.2.0") as string);
      const used = resolved(q, "run after tag move", project, home, ["--locked"]);
      q.quiet("init after tag move", ["init", ".", "--locked", "--no-input"], project, home, 0);
      q.check(
        used.dialects[OWNER] === "0.1.0" && lockState(project) === lock,
        "tag move changed the selection",
      );
      const restore = away(home);
      mkdirSync(home);
      const fetched = q.loud(
        "init fetches pinned digest",
        ["init", ".", "--locked", "--no-input"],
        project,
        home,
        0,
      );
      q.check(
        resolved(q, "run refetched", project, home).dialects[OWNER] === "0.1.0",
        "init followed the moved tag",
      );
      renameSync(home, `${home}.refetched`);
      restore();
      const moved = q.loud(
        "update follows tag",
        ["update", "dialect", OWNER, f.dTag("0.1.0", q.movable)],
        project,
        home,
        0,
      );
      const after = resolved(q, "run after explicit update", project, home);
      return (
        "run/init keep 0.1.0 digest after tag move (0 requests); empty-home init refetched pinned digest (" +
        fetched.requests +
        " requests); explicit update now selects " +
        after.dialects[OWNER] +
        " (" +
        moved.requests +
        " requests)"
      );
    },
  );
}

async function policyScenarios(q: Qualification, f: Fixtures): Promise<void> {
  await q.scenario(
    "--policy pack/name and pack/* keep exactly that subset",
    { dialect: true, policyPack: true, local: true },
    () => {
      const home = q.home("policy");
      const project = f.project("policy");
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("select guard pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      q.quiet(
        "select filter pack",
        ["add", "policy-packs", `./policies/${FILTER_PACK}`],
        project,
        home,
        0,
      );
      const all = resolved(q, "run all", project, home, [], "fail");
      const pass = resolved(q, "run pass only", project, home, ["--policy", `${FILTER_PACK}/pass`]);
      const fail = resolved(
        q,
        "run fail only",
        project,
        home,
        ["--policy", `${FILTER_PACK}/fail`],
        "fail",
      );
      const pack = resolved(
        q,
        "run filter pack",
        project,
        home,
        ["--policy", `${FILTER_PACK}/*`],
        "fail",
      );
      const guard = resolved(q, "run guard pack", project, home, ["--policy", `${PACK}/*`]);
      const unknown = q.quiet(
        "run unknown policy",
        ["run", "plan.json", "--project", ".", "--no-serve", "--policy", `${FILTER_PACK}/missing`],
        project,
        home,
        "fail",
      );
      const unknownPack = q.quiet(
        "run unknown pack",
        ["run", "plan.json", "--project", ".", "--no-serve", "--policy", "absent/*"],
        project,
        home,
        "fail",
      );
      const prefix = (name: string) => `${name}/`;
      q.check(
        JSON.stringify(pass.policies) === JSON.stringify([`${prefix(FILTER_PACK)}pass`]) &&
          pass.evaluations === 1,
        `pack/name kept other results: ${JSON.stringify(pass)}`,
      );
      q.check(
        JSON.stringify(fail.policies) === JSON.stringify([`${prefix(FILTER_PACK)}fail`]),
        "fail subset differs",
      );
      q.check(
        JSON.stringify(pack.policies) ===
          JSON.stringify([`${prefix(FILTER_PACK)}fail`, `${prefix(FILTER_PACK)}pass`]) &&
          pack.evaluations === 2,
        "pack/* subset differs",
      );
      q.check(
        JSON.stringify(guard.policies) === JSON.stringify([`${prefix(PACK)}service-present`]),
        "guard subset differs",
      );
      q.check(all.evaluations === 3, "unfiltered evaluations differ");
      return (
        "all=3 evaluations exit " +
        all.exitCode +
        "; " +
        FILTER_PACK +
        "/pass=1 exit 0; /fail=1 exit " +
        fail.exitCode +
        "; /*=2 exit " +
        pack.exitCode +
        "; " +
        PACK +
        "/*=1 exit 0; unknown policy exit " +
        unknown.exitCode +
        ", unknown pack exit " +
        unknownPack.exitCode
      );
    },
  );
}

async function precedenceScenarios(q: Qualification, f: Fixtures): Promise<void> {
  await q.scenario(
    "precedence: local selection ignores installed copies of the same owner",
    { dialect: true, policyPack: true, local: true, ociTag: true },
    () => {
      const home = q.home("precedence-local");
      const project = f.project("precedence-local");
      q.loud(
        "install OCI versions",
        ["install", "dialects", f.dDigest("0.1.0"), f.dDigest("0.2.0")],
        project,
        home,
        0,
      );
      q.loud("install OCI pack", ["install", "policy-packs", f.pDigest("0.1.0")], project, home, 0);
      q.quiet("select local dialect", ["add", "dialects", `./dialects/${OWNER}`], project, home, 0);
      q.quiet("select local pack", ["add", "policy-packs", `./policies/${PACK}`], project, home, 0);
      const used = resolved(q, "run local over store", project, home);
      q.check(
        used.dialects[OWNER] === "0.3.0" && used.packs[PACK] === "0.3.0",
        "store shadowed the local selection",
      );
      const restore = away(join(project, "dialects"));
      const gone = resolved(q, "run with local source gone", project, home, [], "fail");
      restore();
      return (
        "local 0.3.0 used while 0.1.0/0.2.0 installed; local source gone -> exit " +
        gone.exitCode +
        " without store fallback (" +
        firstLine(gone.stderr) +
        ")"
      );
    },
  );

  await q.scenario(
    "precedence: OCI selection reads its exact installed version",
    { dialect: true, ociDigest: true },
    () => {
      const home = q.home("precedence-oci");
      const project = f.project("precedence-oci");
      q.loud(
        "install both versions",
        ["install", "dialects", f.dDigest("0.1.0"), f.dDigest("0.2.0")],
        project,
        home,
        0,
      );
      q.loud("select 0.1.0", ["add", "dialects", f.dDigest("0.1.0")], project, home, 0);
      const used = resolved(q, "run exact installed version", project, home);
      q.check(used.dialects[OWNER] === "0.1.0", "wrong installed version used");
      const file = join(home, "dialects", OWNER, "0.1.0");
      const entries = existsSync(file) ? readdirSync(file) : [];
      const target = entries.find((entry) => entry.endsWith(".hcl")) ?? entries[0];
      let tamper = "store layout not recognized";
      if (target) {
        const path = join(file, target);
        const original = readFileSync(path);
        writeFileSync(path, Buffer.concat([original, Buffer.from("\n")]));
        const tampered = resolved(q, "run tampered store", project, home, [], "any");
        tamper = `tampered store exit ${tampered.exitCode} (${firstLine(tampered.stderr)})`;
        writeFileSync(path, original);
      }
      return `0.1.0 used while 0.2.0 installed; ${tamper}`;
    },
  );

  await q.scenario(
    "precedence: vendor tree wins and never falls back",
    { dialect: true, policyPack: true, ociDigest: true, vendor: true },
    () => {
      const home = q.home("precedence-vendor");
      const project = f.project("precedence-vendor");
      q.loud("select OCI dialect", ["add", "dialects", f.dDigest("0.1.0")], project, home, 0);
      q.quiet("vendor", ["vendor"], project, home, 0);
      const file = join(vendorUnit(project, "dialects", OWNER), "dialect.rf.hcl");
      const original = readFileSync(file);
      writeFileSync(file, Buffer.concat([original, Buffer.from("\n")]));
      const failed = resolved(q, "run drifted vendor with good store", project, home, [], "fail");
      writeFileSync(file, original);
      const restore = away(home);
      const ok = resolved(q, "run vendor without home", project, home);
      restore();
      return (
        "drifted vendor + intact store -> exit " +
        failed.exitCode +
        " (no fallback); vendor without home -> " +
        ok.dialects[OWNER]
      );
    },
  );
}

export async function qualifySelection(options: SelectionOptions): Promise<Qualification> {
  const q = new Qualification(options);
  const fixtures = await prepare(q);
  for (const group of [
    installScenarios,
    addScenarios,
    overrideScenarios,
    updateScenarios,
    removeScenarios,
    uninstallScenarios,
    vendorScenarios,
    sentinelScenarios,
    networkScenarios,
    policyScenarios,
    precedenceScenarios,
  ]) {
    await group(q, fixtures);
  }
  mkdirSync(dirname(options.evidence), { recursive: true });
  writeFileSync(
    options.evidence,
    `${JSON.stringify(
      {
        binary: options.binary,
        binary_sha256: sha256(readFileSync(options.binary)),
        registry: options.registry,
        repositories: { units: q.repository, alternate: q.alternate, movable: q.movable },
        digests: Object.fromEntries(q.digests),
        rows: q.rows,
        network: q.network,
        failures: q.failures,
      },
      null,
      2,
    )}\n`,
  );
  return q;
}

if (import.meta.main) {
  const parsed = parseSelectionArguments(Bun.argv.slice(2));
  const q = await qualifySelection({ ...parsed, root: resolve(import.meta.dir, "..") });
  const quietCommands = q.network.filter((entry) => !entry.allowed).length;
  console.log(
    q.rows.filter((row) => row.proven).length +
      "/" +
      q.rows.length +
      " scenarios proven; " +
      quietCommands +
      " normal commands made 0 registry requests; evidence: " +
      parsed.evidence,
  );
  if (q.failures.length > 0) process.exit(1);
}
