#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const docPath = join(repoRoot, "docs", "getting-started", "first-architecture.md");
const buildRefPath = join(repoRoot, "docs", "reference", "cli", "build.md");
const examplePath = join(repoRoot, "examples", "aws-vpc", "main.tf");
const FENCE = "```";

function fail(message: string): never {
  throw new Error(message);
}

function requireFile(path: string, what: string): string {
  if (!existsSync(path)) {
    fail(`${what} is missing: ${path}`);
  }
  return path;
}

function resolveBinary(environment: Record<string, string | undefined> = process.env): string {
  const specified = environment.ROOTFORM_BIN?.trim();
  if (specified) {
    if (!isAbsolute(specified)) {
      fail(`ROOTFORM_BIN must be an absolute path, got: ${specified}`);
    }
    if (!existsSync(specified)) {
      fail(`ROOTFORM_BIN does not exist: ${specified}`);
    }
    return specified;
  }
  fail("ROOTFORM_BIN must name the checksum-verified Rootform executable");
}

type Captured = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

function run(binary: string, args: string[], cwd: string, home: string): Captured {
  const result = Bun.spawnSync({
    cmd: [binary, ...args],
    cwd,
    env: { ...process.env, ROOTFORM_HOME: home, DOCKER_CONFIG: join(home, "docker") },
    stderr: "pipe",
    stdout: "pipe",
  });
  if (result.exitCode === null) {
    fail(
      "rootform " +
        args.join(" ") +
        " was killed by a signal (" +
        (result.signalCode ?? "unknown") +
        ")",
    );
  }
  return {
    exitCode: result.exitCode,
    stderr: result.stderr?.toString("utf8") ?? "",
    stdout: result.stdout?.toString("utf8") ?? "",
  };
}

async function verifyLocalExplorer(binary: string, workspace: string, home: string): Promise<void> {
  const child = Bun.spawn(
    [
      binary,
      "run",
      ".",
      "--locked",
      "--offline",
      "--no-input",
      "--no-browser",
      "--no-watch",
      "--port",
      "0",
    ],
    {
      cwd: workspace,
      env: { ...process.env, ROOTFORM_HOME: home, DOCKER_CONFIG: join(home, "docker") },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  let stdout = "";
  let stderr = "";
  const read = async (stream: ReadableStream<Uint8Array>, append: (value: string) => void) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) append(decoder.decode(chunk, { stream: true }));
  };
  const readers = [
    read(child.stdout, (value) => {
      stdout += value;
    }),
    read(child.stderr, (value) => {
      stderr += value;
    }),
  ];
  try {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const address = stdout.match(/http:\/\/127\.0\.0\.1:\d+/u)?.[0];
      if (address) {
        const response = await fetch(address, { signal: AbortSignal.timeout(5_000) });
        if (!response.ok || !(await response.text()).toLowerCase().includes("<!doctype html")) {
          fail("local explorer did not serve its HTML interface");
        }
        return;
      }
      if (child.exitCode !== null) fail(`local explorer exited before serving: ${stderr}`);
      await Bun.sleep(50);
    }
    fail(`local explorer did not start: ${stderr}`);
  } finally {
    child.kill("SIGINT");
    const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
    await child.exited;
    clearTimeout(force);
    await Promise.all(readers);
  }
}

function normalizeLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/u, ""))
    .join("\n")
    .trim();
}

function normalizeOutput(text: string): string {
  return normalizeLines(text).replace(/\s+/gu, " ");
}

function extractFencedMainTf(page: string): string {
  const matches = [
    ...page.matchAll(
      new RegExp(`${FENCE}hcl\\s+title="main\\.tf"\\s*\\n([\\s\\S]*?)\\n${FENCE}`, "gu"),
    ),
  ];
  if (matches.length !== 1) {
    fail(
      "first-architecture.md must contain exactly one " +
        FENCE +
        'hcl title="main.tf"' +
        FENCE +
        " fence, found " +
        matches.length,
    );
  }
  const body = matches[0]?.[1];
  if (body === undefined) {
    fail("could not read the main.tf fence from first-architecture.md");
  }
  return `${body.replace(/\r\n/gu, "\n").replace(/\s+$/u, "")}\n`;
}

function displayedBuildOutput(page: string): string {
  const candidates: string[] = [];
  for (const match of page.matchAll(
    new RegExp(`${FENCE}text[^\\n]*\\n([\\s\\S]*?)\\n${FENCE}`, "gu"),
  )) {
    const body = match[1] ?? "";
    if (body.includes("Declarations detected")) {
      candidates.push(normalizeOutput(body));
    }
  }
  if (candidates.length !== 1) fail("the page must show exactly one declaration summary");
  return candidates[0] ?? fail("declaration summary is missing");
}

function flagTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const match of text.matchAll(/(--[a-z][a-z0-9-]*)/gu)) {
    tokens.add(match[1] ?? "");
  }
  return [...tokens].sort();
}

const steps: string[] = [];
function noted(label: string, value: string): void {
  steps.push(`${label}: ${value}`);
}

const binary = resolveBinary();
requireFile(binary, "Rootform binary");
requireFile(examplePath, "examples/aws-vpc/main.tf");
const page = readFileSync(
  requireFile(docPath, "docs/getting-started/first-architecture.md"),
  "utf8",
);
const buildReference = readFileSync(
  requireFile(buildRefPath, "docs/reference/cli/build.md"),
  "utf8",
);

const mainTf = extractFencedMainTf(page);
const exampleCode = readFileSync(examplePath, "utf8").replace(/\r\n/gu, "\n");
if (normalizeLines(mainTf) !== normalizeLines(exampleCode)) {
  fail("the fenced main.tf in first-architecture.md does not match examples/aws-vpc/main.tf");
}

const workspace = mkdtempSync(join(tmpdir(), "rootform-docs-example-"));
const home = mkdtempSync(join(tmpdir(), "rootform-docs-example-home-"));
try {
  mkdirSync(join(home, "docker"));
  writeFileSync(join(home, "docker/config.json"), "{}\n");
  writeFileSync(join(workspace, "main.tf"), mainTf);

  const version = run(binary, ["version"], repoRoot, home);
  if (version.exitCode !== 0) {
    fail(`rootform version failed: ${version.stderr.trim()}`);
  }
  const binaryVersion = version.stdout.trim().replace(/^rootform\s+/u, "");

  const first = run(
    binary,
    ["build", ".", "--no-input", "--output", "architecture.json"],
    workspace,
    home,
  );
  if (first.exitCode !== 0) {
    fail(`first build failed (exit ${first.exitCode}):\n${first.stderr}`);
  }
  const lockPath = join(workspace, "rootform.lock");
  if (!existsSync(lockPath)) {
    fail("first build did not write rootform.lock");
  }
  const lockBytes = readFileSync(lockPath);
  const archPath = join(workspace, "architecture.json");
  const archBytes = readFileSync(archPath);

  type ArchitectureDocument = {
    format_version?: string;
    generator?: { name?: string; version?: string };
    source?: { declarations?: Array<{ address?: string; outcome?: { kind?: string } }> };
    architecture?: { contexts?: Array<{ dimension?: string; from?: string; to?: string }> };
    semantics?: { dialects?: Array<{ id?: string; version?: string }> };
  };
  let architecture: ArchitectureDocument;
  try {
    architecture = JSON.parse(archBytes.toString("utf8")) as ArchitectureDocument;
  } catch {
    fail("architecture.json is not valid JSON");
  }
  if (architecture.format_version !== "0.1.0") {
    fail(`architecture format_version is ${architecture.format_version}, expected 0.1.0`);
  }
  if (architecture.generator?.name !== "rootform") {
    fail("architecture generator is not rootform");
  }
  if (architecture.generator?.version !== binaryVersion) {
    fail(
      "architecture generator version " +
        (architecture.generator?.version ?? "missing") +
        " does not match binary version " +
        binaryVersion,
    );
  }

  const declarations = architecture.source?.declarations;
  if (!Array.isArray(declarations)) {
    fail("architecture.source.declarations is missing");
  }
  const outcomes = new Map<string, string>();
  for (const declaration of declarations) {
    const address = declaration.address;
    if (address === undefined) {
      continue;
    }
    outcomes.set(address, declaration.outcome?.kind ?? "");
  }
  for (const required of ["aws_vpc.main", "aws_subnet.application"]) {
    const actual = outcomes.get(required);
    if (actual !== "represented") {
      fail(`declaration ${required} is not represented (got ${actual ?? "missing"})`);
    }
  }
  for (const [address, kind] of outcomes) {
    if (kind === "unsupported" || kind === "failed") {
      fail(`declaration ${address} has outcome ${kind}`);
    }
  }

  const contexts = architecture.architecture?.contexts;
  if (!Array.isArray(contexts)) {
    fail("architecture.architecture.contexts is missing");
  }
  const networkContext = contexts.find(
    (context) =>
      context.dimension === "core/network" &&
      context.from === "scope:aws_subnet.application" &&
      context.to === "scope:aws_vpc.main",
  );
  if (networkContext === undefined) {
    fail("missing context core/network from aws_subnet.application to aws_vpc.main");
  }

  const dialectIds = (architecture.semantics?.dialects ?? [])
    .map((dialect) => dialect.id ?? "")
    .filter((id) => id !== "");
  for (const required of ["aws", "core"]) {
    if (!dialectIds.includes(required)) {
      fail(`semantics do not include ${required} (got ${dialectIds.join(", ") || "none"})`);
    }
  }

  const repeated = run(
    binary,
    ["build", ".", "--locked", "--offline", "--no-input", "--output", "repeated.json"],
    workspace,
    home,
  );
  if (repeated.exitCode !== 0) {
    fail(`offline rebuild failed (exit ${repeated.exitCode}):\n${repeated.stderr}`);
  }
  const repeatedBytes = readFileSync(join(workspace, "repeated.json"));
  if (!repeatedBytes.equals(archBytes)) {
    fail("offline locked rebuild is not byte-identical to the first architecture");
  }
  if (!readFileSync(lockPath).equals(lockBytes)) {
    fail("rootform.lock bytes changed between builds");
  }

  type LockDocument = { entries?: Array<{ name?: string; version?: string }> };
  const lock = JSON.parse(lockBytes.toString("utf8")) as LockDocument;
  const lockEntries = (lock.entries ?? [])
    .map((entry) => entry.name ?? "")
    .filter((name) => name !== "");
  for (const required of ["aws", "core"]) {
    if (!lockEntries.includes(required)) {
      fail(
        "rootform.lock does not pin " +
          required +
          " (got " +
          (lockEntries.join(", ") || "none") +
          ")",
      );
    }
  }

  const html = run(
    binary,
    [
      "build",
      ".",
      "--format",
      "html",
      "--locked",
      "--offline",
      "--no-input",
      "--output",
      "architecture.html",
    ],
    workspace,
    home,
  );
  if (html.exitCode !== 0) {
    fail(`html build failed (exit ${html.exitCode}):\n${html.stderr}`);
  }
  if (!readFileSync(lockPath).equals(lockBytes)) {
    fail("rootform.lock bytes changed after the html build");
  }
  const htmlBody = readFileSync(join(workspace, "architecture.html"), "utf8");
  if (!htmlBody.trimStart().toLowerCase().startsWith("<!doctype html")) {
    fail("architecture.html is not an HTML document");
  }
  if (/(?:src|href)="(?:https?:)?\/\//u.test(htmlBody)) {
    fail("architecture.html contains a remote src or href reference");
  }

  await verifyLocalExplorer(binary, workspace, home);

  const help = run(binary, ["build", "--help"], repoRoot, home);
  if (help.exitCode !== 0) {
    fail("rootform build --help failed");
  }
  const documentedFlags = flagTokens(buildReference);
  const missing = documentedFlags.filter((flag) => !help.stdout.includes(flag));
  if (missing.length > 0) {
    fail(`reference/cli/build.md documents flags missing from build --help: ${missing.join(", ")}`);
  }

  const summaryStart = first.stderr.indexOf("Declarations detected");
  if (summaryStart < 0) fail("the real build did not print declaration accounting");
  const summary = normalizeOutput(first.stderr.slice(summaryStart));
  for (const document of [page, buildReference]) {
    if (displayedBuildOutput(document) !== summary) {
      fail("displayed declaration summary does not match the real build");
    }
  }

  noted(
    "binary",
    "rootform " +
      binaryVersion +
      ", sha256:" +
      createHash("sha256").update(readFileSync(binary)).digest("hex"),
  );
  noted("main.tf fence", "matches examples/aws-vpc/main.tf");
  noted("first build", "implicit preparation from empty home, exit 0");
  noted("offline rebuild", "byte-identical to first build, --locked --offline");
  noted(
    "representations",
    "aws_vpc.main, aws_subnet.application represented; no unsupported/failed",
  );
  noted("context", "core/network from aws_subnet.application to aws_vpc.main");
  noted("semantics", dialectIds.sort().join(", "));
  noted("rootform.lock", `bytes preserved; pins ${lockEntries.sort().join(", ")}`);
  noted("html", "self-contained, no remote src/href");
  noted("run", "serves the local HTML explorer with locked offline semantics");
  noted("build flags", `${documentedFlags.length} documented flags all present in build --help`);
  noted("displayed stderr", "tutorial and reference match the real first build");

  console.log(`first-architecture.md proof: PASS (${steps.length} checks)`);
  for (const step of steps) {
    console.log(`  - ${step}`);
  }
  console.log(`Execution platform: ${process.platform}/${process.arch}`);
} finally {
  rmSync(workspace, { force: true, recursive: true });
  rmSync(home, { force: true, recursive: true });
}
