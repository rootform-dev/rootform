#!/usr/bin/env bun

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { normalizeVersion } from "./release/contract.ts";

export type TargetLabel =
  | "linux-amd64"
  | "linux-arm64"
  | "macos-amd64"
  | "macos-arm64"
  | "windows-amd64";

export const TARGET_LABELS: readonly TargetLabel[] = [
  "linux-amd64",
  "linux-arm64",
  "macos-amd64",
  "macos-arm64",
  "windows-amd64",
];

export type Host = { arch: string; platform: NodeJS.Platform };

const TARGET_HOSTS: Readonly<Record<TargetLabel, Host>> = {
  "linux-amd64": { arch: "x64", platform: "linux" },
  "linux-arm64": { arch: "arm64", platform: "linux" },
  "macos-amd64": { arch: "x64", platform: "darwin" },
  "macos-arm64": { arch: "arm64", platform: "darwin" },
  "windows-amd64": { arch: "x64", platform: "win32" },
};

export type JourneyStep = { detail?: string; name: string; ok: boolean };

export type PolicyVerdict = "passed" | "violated" | "indeterminate";

export type PolicyVerdictEvidence = {
  evaluations: number | null;
  exit_code: number | null;
  status: string | null;
  violations: number | null;
};

export type RefusalEvidence = { code: string | null; exit_code: number | null };

// PolicySemanticsMismatchEvidence records the documented fail-closed refusal
// of a compiled Policy Pack evaluated against a Form whose semantics differ:
// the machine code, the refused Pack's linked digest and pinned owner count,
// and the absence of any evaluation.
export type PolicySemanticsMismatchEvidence = {
  code: string | null;
  evaluations: number | null;
  exit_code: number | null;
  form_origin: string | null;
  linked_digest: string | null;
  pins: number | null;
  violations: number | null;
};

export type JourneyEvidence = {
  binary: string;
  executable_sha256: string | null;
  run_sha256: string | null;
  lock_absence_preserved: boolean;
  lock_unchanged: boolean;
  empty_vendor_rejected: boolean;
  offline_inspection_no_credentials: boolean;
  online_offline_identical: boolean;
  passed: boolean;
  local_policy_pack_inspection: boolean;
  steps: JourneyStep[];
  supplied_dialects_not_installed: boolean;
  supplied_release_set_offline: boolean;
  target: TargetLabel;
  version: string | null;
  explorer: { port_conflict: boolean; served_loopback: boolean };
  input_refusals: {
    incomplete: RefusalEvidence;
    invalid_json: RefusalEvidence;
    oversized: RefusalEvidence;
    unreadable: RefusalEvidence;
  };
  policy_verdicts: Record<PolicyVerdict, PolicyVerdictEvidence>;
  policy_semantics_mismatch: PolicySemanticsMismatchEvidence;
  process_environment_allowlisted: boolean;
  usage_refusal: RefusalEvidence;
};

export type RuntimeArguments = {
  binary: string;
  evidence?: string;
  target: TargetLabel;
  version: string;
};

export function targetHost(target: TargetLabel): Host {
  return TARGET_HOSTS[target];
}

export function assertTargetMatchesHost(
  target: TargetLabel,
  platform = process.platform,
  arch: string = process.arch,
): void {
  const host = targetHost(target);
  if (host.platform !== platform || host.arch !== arch) {
    throw new Error(`target ${target} cannot run on ${platform}/${arch}`);
  }
}

type Redaction = { path: string; placeholder: string };

// Child processes receive an explicit allowlist instead of the ambient
// environment: a verification run must never hand credentials, tokens or
// personal paths to the binary it exercises.
const CHILD_ENVIRONMENT_ALLOWLIST = [
  "PATH",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "SystemRoot",
  "windir",
  "ComSpec",
  "PATHEXT",
  "SystemDrive",
  "PROCESSOR_ARCHITECTURE",
  "NUMBER_OF_PROCESSORS",
] as const;

export function childEnvironment(
  overrides: Record<string, string> = {},
  source: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const name of CHILD_ENVIRONMENT_ALLOWLIST) {
    const value = source[name];
    if (value !== undefined) environment[name] = value;
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
      throw new Error(`invalid child environment name: ${name}`);
    }
    environment[name] = value;
  }
  return environment;
}

export function redact(text: string, redactions: readonly Redaction[]): string {
  let result = text;
  for (const entry of [...redactions].sort((left, right) => right.path.length - left.path.length)) {
    const quotedPath = JSON.stringify(entry.path).slice(1, -1);
    result = result
      .replaceAll(quotedPath, entry.placeholder)
      .replaceAll(entry.path, entry.placeholder);
  }
  return result;
}

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

export function parseArguments(arguments_: string[], cwd = process.cwd()): RuntimeArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    const name = ["binary", "evidence", "target", "version"].find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown platform runtime argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate platform runtime argument: --${name}`);
    const inline = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++index];
    if (!inline || inline.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, inline);
  }
  const binary = values.get("binary");
  if (!binary) throw new Error("--binary is required");
  const targetValue = values.get("target");
  if (!targetValue) throw new Error("--target is required");
  const target = TARGET_LABELS.find((label) => label === targetValue);
  if (!target) throw new Error(`unsupported platform runtime target: ${targetValue}`);
  const version = values.get("version");
  if (!version) throw new Error("--version is required");
  const evidence = values.get("evidence");
  return {
    binary: absolute(binary, cwd),
    evidence: evidence === undefined ? undefined : absolute(evidence, cwd),
    target,
    version: normalizeVersion(version),
  };
}

export function requireRegularFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`);
  }
  if (status.size < 1) throw new Error(`${label} has zero size`);
}

export class JourneyError extends Error {
  constructor(
    readonly step: string,
    message: string,
  ) {
    super(message);
    this.name = "JourneyError";
  }
}

export type SpawnOutcome = { exitCode: number; stderr: string; stdout: string };

export function runBinaryStatus(
  binary: string,
  arguments_: string[],
  options: { cwd: string; environment: Record<string, string>; redactions: readonly Redaction[] },
): SpawnOutcome {
  const result = Bun.spawnSync({
    cmd: [binary, ...arguments_],
    cwd: options.cwd,
    env: childEnvironment(options.environment),
    stderr: "pipe",
    stdout: "pipe",
  });
  const stdout = redact(result.stdout.toString("utf8"), options.redactions);
  const stderr = redact(result.stderr.toString("utf8"), options.redactions);
  return { exitCode: result.exitCode, stderr, stdout };
}

export function runBinary(
  binary: string,
  arguments_: string[],
  options: { cwd: string; environment: Record<string, string>; redactions: readonly Redaction[] },
): Omit<SpawnOutcome, "exitCode"> {
  const result = runBinaryStatus(binary, arguments_, options);
  if (result.exitCode !== 0) {
    const { exitCode, stderr, stdout } = result;
    const suffix = stderr.trim() === "" ? stdout.trim() : stderr.trim();
    throw new Error(
      `rootform ${arguments_[0] ?? "(command)"} failed (exit ${String(exitCode)}): ${suffix}`,
    );
  }
  return { stderr: result.stderr, stdout: result.stdout };
}

export function assertNoTargetPolicyResult(body: string): void {
  const result = JSON.parse(body) as {
    format_version?: string;
    status?: string;
    selection?: { policies?: string[] };
    architectures?: {
      kind?: string;
      stage?: string;
      status?: string;
      summary?: {
        policies?: { no_target?: number; selected?: number };
        evaluations?: { total?: number };
      };
      evaluations?: unknown[];
    }[];
  };
  const architecture = result.architectures?.[0];
  const selected = architecture?.summary?.policies?.selected;
  if (
    result.format_version !== "1" ||
    result.status !== "no_decision" ||
    !Array.isArray(result.architectures) ||
    result.architectures.length !== 1 ||
    architecture?.kind !== "plan" ||
    architecture.stage !== "planned" ||
    architecture.status !== "no_decision" ||
    !Number.isSafeInteger(selected) ||
    !selected ||
    selected < 1 ||
    result.selection?.policies?.length !== selected ||
    architecture.summary?.policies?.no_target !== selected ||
    architecture.summary.evaluations?.total !== 0 ||
    !Array.isArray(architecture.evaluations) ||
    architecture.evaluations.length !== 0
  ) {
    throw new Error("policy without target did not produce a no_decision result");
  }
}

const POLICY_STATUSES = ["passed", "violated", "indeterminate", "no_decision", "failed"] as const;

const EVALUATION_OUTCOMES = ["passed", "violated", "indeterminate"] as const;

const POLICY_OUTCOMES = [...EVALUATION_OUTCOMES, "no_target"] as const;

const VERDICT_EXITS: Readonly<Record<PolicyVerdict, number>> = {
  indeterminate: 3,
  passed: 0,
  violated: 1,
};

type PolicyResultDocument = {
  format_version?: unknown;
  status?: unknown;
  selection?: { policies?: unknown };
  architectures?: {
    evaluations?: unknown;
    policies?: unknown;
    status?: unknown;
    summary?: {
      evaluations?: {
        indeterminate?: unknown;
        passed?: unknown;
        total?: unknown;
        violated?: unknown;
      };
      policies?: { selected?: unknown };
    };
    violations?: unknown;
  }[];
};

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function outcomeCount(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Policy result ${label} is not a count`);
  }
  return value as number;
}

function nameList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry === "")) {
    throw new Error(`Policy result ${label} is not a list of names`);
  }
  return value as string[];
}

// assertPolicyOutcome reads one check verdict and refuses to let a violation,
// an undecided evaluation or a stopped check pass for a demonstrated result.
export function assertPolicyOutcome(
  outcome: SpawnOutcome,
  expectation: { exitCode: number; verdict: PolicyVerdict },
): PolicyVerdictEvidence {
  const expectedExit = VERDICT_EXITS[expectation.verdict];
  if (expectation.exitCode !== expectedExit) {
    throw new Error(
      expectation.verdict +
        " must exit " +
        String(expectedExit) +
        ", not " +
        String(expectation.exitCode),
    );
  }
  if (outcome.exitCode !== expectedExit) {
    throw new Error(
      "check exited " +
        String(outcome.exitCode) +
        " where " +
        expectation.verdict +
        " exits " +
        String(expectedExit),
    );
  }
  const result = JSON.parse(outcome.stdout) as PolicyResultDocument;
  if (result.format_version !== "1") {
    throw new Error("Policy result is not a format-1 document");
  }
  if (!isOneOf(POLICY_STATUSES, result.status)) {
    throw new Error(
      `Policy result status ${String(result.status)} is outside the documented verdicts`,
    );
  }
  if (result.status !== expectation.verdict) {
    throw new Error(`Policy result status ${result.status} is not ${expectation.verdict}`);
  }
  const architectures = result.architectures;
  if (!Array.isArray(architectures) || architectures.length !== 1) {
    throw new Error("Policy result does not describe exactly one architecture");
  }
  const architecture = architectures[0] ?? {};
  if (architecture.status !== result.status) {
    throw new Error("architecture status differs from the overall status");
  }
  const selected = outcomeCount(architecture.summary?.policies?.selected, "selected Policies");
  if (selected < 1) throw new Error("Policy result selected no Policy");
  if (nameList(result.selection?.policies, "selection").length !== selected) {
    throw new Error("Policy result selection differs from its selected count");
  }
  const evaluations = architecture.evaluations;
  if (!Array.isArray(evaluations)) throw new Error("Policy result has no evaluation list");
  const total = outcomeCount(architecture.summary?.evaluations?.total, "total evaluations");
  const passed = outcomeCount(architecture.summary?.evaluations?.passed, "passed evaluations");
  const violated = outcomeCount(
    architecture.summary?.evaluations?.violated,
    "violated evaluations",
  );
  const indeterminate = outcomeCount(
    architecture.summary?.evaluations?.indeterminate,
    "indeterminate evaluations",
  );
  if (total !== evaluations.length || passed + violated + indeterminate !== total) {
    throw new Error("Policy result evaluation summary is inconsistent");
  }
  const observed = { passed: 0, violated: 0, indeterminate: 0 };
  for (const entry of evaluations as { outcome?: unknown; reasons?: unknown }[]) {
    if (!isOneOf(EVALUATION_OUTCOMES, entry.outcome)) {
      throw new Error(
        `evaluation outcome ${String(entry.outcome)} is outside the documented outcomes`,
      );
    }
    observed[entry.outcome]++;
    if (
      entry.outcome === "indeterminate" &&
      nameList(entry.reasons, "evaluation reasons").length < 1
    ) {
      throw new Error("indeterminate evaluation states no reason");
    }
  }
  if (
    observed.passed !== passed ||
    observed.violated !== violated ||
    observed.indeterminate !== indeterminate
  )
    throw new Error("Policy result evaluation summary differs from its recorded outcomes");
  const policies = architecture.policies;
  if (!Array.isArray(policies) || policies.length !== selected) {
    throw new Error("Policy result does not describe every selected Policy");
  }
  for (const entry of policies as { outcome?: unknown }[]) {
    if (!isOneOf(POLICY_OUTCOMES, entry.outcome)) {
      throw new Error(`Policy outcome ${String(entry.outcome)} is outside the documented outcomes`);
    }
  }
  const violations = architecture.violations;
  if (!Array.isArray(violations)) throw new Error("Policy result has no violation list");
  for (const entry of violations as { address?: unknown; message?: unknown; policy?: unknown }[]) {
    for (const [label, value] of [
      ["policy", entry.policy],
      ["address", entry.address],
      ["message", entry.message],
    ] as const) {
      if (typeof value !== "string" || value === "") {
        throw new Error(`violation states no ${label}`);
      }
    }
  }
  if (expectation.verdict === "passed") {
    if (total < 1) throw new Error("passed Policy result holds no evaluation");
    if (passed !== total || violated !== 0 || indeterminate !== 0 || violations.length !== 0) {
      throw new Error("passed Policy result carries a violation or an undecided evaluation");
    }
    for (const entry of policies as { outcome?: unknown }[]) {
      if (entry.outcome !== "passed") {
        throw new Error(`passed Policy result holds a ${String(entry.outcome)} Policy`);
      }
    }
  }
  if (expectation.verdict === "violated") {
    if (violated < 1 || violations.length < 1) {
      throw new Error("violated Policy result carries no violated evaluation");
    }
  }
  if (expectation.verdict === "indeterminate") {
    if (indeterminate < 1) {
      throw new Error("indeterminate Policy result holds no indeterminate evaluation");
    }
    if (violated !== 0 || violations.length !== 0) {
      throw new Error("indeterminate Policy result carries a violation");
    }
  }
  return {
    evaluations: total,
    exit_code: outcome.exitCode,
    status: result.status,
    violations: violations.length,
  };
}

type FailedPolicyResult = {
  architectures?: unknown;
  diagnostics?: { code?: unknown; severity?: unknown }[];
  format_version?: unknown;
  status?: unknown;
};

function failedPolicyResult(body: string): FailedPolicyResult {
  let result: FailedPolicyResult;
  try {
    result = JSON.parse(body) as FailedPolicyResult;
  } catch {
    throw new Error("refused command did not write a failed result document");
  }
  if (result.format_version !== "1" || result.status !== "failed") {
    throw new Error("refused command did not write a failed result document");
  }
  if (!Array.isArray(result.architectures) || result.architectures.length !== 0) {
    throw new Error("refused command evaluated an architecture");
  }
  return result;
}

function assertFailedDiagnostic(result: FailedPolicyResult, code: string): void {
  const diagnostics = result.diagnostics;
  if (
    !Array.isArray(diagnostics) ||
    !diagnostics.some((entry) => entry.code === code && entry.severity === "error")
  ) {
    throw new Error(`refused command did not report ${code} in its result`);
  }
}

// assertCommandRefusal reads a check stopped before evaluation: its exit, its
// machine code in the failed result and on standard error, and no verdict.
export function assertCommandRefusal(
  outcome: SpawnOutcome,
  expectation: { code: string; exitCode: number; headline: string },
): RefusalEvidence {
  if (outcome.exitCode !== expectation.exitCode) {
    throw new Error(
      "refused command exited " +
        String(outcome.exitCode) +
        ", not " +
        String(expectation.exitCode),
    );
  }
  if (!outcome.stderr.includes(`Code: ${expectation.code}`)) {
    throw new Error(`refusal lost the ${expectation.code} diagnostic`);
  }
  if (!outcome.stderr.includes(expectation.headline)) {
    throw new Error(`refusal lost the headline ${expectation.headline}`);
  }
  if (outcome.stderr.includes("PASSED") || outcome.stderr.includes("VIOLATED")) {
    throw new Error("refused command reported a verdict");
  }
  assertFailedDiagnostic(failedPolicyResult(outcome.stdout), expectation.code);
  return { code: expectation.code, exit_code: outcome.exitCode };
}

// assertUsageRefusal reads an invalid invocation: a usage exit, the rootform
// diagnostic, its recovery guidance, and a failed result without an answer.
export function assertUsageRefusal(
  outcome: SpawnOutcome,
  expectation: { exitCode: number; guidance: string; message: string },
): RefusalEvidence {
  if (outcome.exitCode !== expectation.exitCode) {
    throw new Error(
      `usage refusal exited ${String(outcome.exitCode)}, not ${String(expectation.exitCode)}`,
    );
  }
  if (!outcome.stderr.includes(`rootform: ${expectation.message}`)) {
    throw new Error(`usage refusal lost the message ${expectation.message}`);
  }
  if (!outcome.stderr.includes(expectation.guidance)) {
    throw new Error(`usage refusal lost the guidance ${expectation.guidance}`);
  }
  if (outcome.stderr.includes("Code: ")) {
    throw new Error("usage refusal must not report an evaluation diagnostic");
  }
  assertFailedDiagnostic(failedPolicyResult(outcome.stdout), "USAGE_INVALID");
  return { code: "USAGE_INVALID", exit_code: outcome.exitCode };
}

type SemanticsMismatchDocument = {
  architectures?: {
    diagnostics?: { code?: unknown; message?: unknown; severity?: unknown }[];
    evaluations?: unknown;
    kind?: unknown;
    policy_packs?: {
      linked?: unknown;
      linked_digest?: unknown;
      pins?: { owner?: unknown; semantic_digest?: unknown }[];
    }[];
    stage?: unknown;
    status?: unknown;
    summary?: { evaluations?: { total?: unknown }; policies?: { selected?: unknown } };
    violations?: unknown;
  }[];
  form?: { origin?: unknown };
  format_version?: unknown;
  status?: unknown;
};

// assertSemanticsMismatch reads the fail-closed refusal documented in
// docs/concepts/policies.md: a saved Form checked against a compiled Policy
// Pack pinned to other semantics exits 3 with a structured failed result that
// names POLICY_SEMANTICS_MISMATCH, evaluates nothing and never relinks the
// Pack or recompiles the Form.
export function assertSemanticsMismatch(
  outcome: SpawnOutcome,
  expectation: { linkedDigest: string; pins: number },
): PolicySemanticsMismatchEvidence {
  if (outcome.exitCode !== 3) {
    throw new Error(`semantic mismatch exited ${String(outcome.exitCode)}, not 3`);
  }
  if (!outcome.stderr.includes("(saved Form; no recompilation)")) {
    throw new Error("semantic mismatch did not load a saved Form without recompilation");
  }
  if (outcome.stderr.includes("PASSED") || outcome.stderr.includes("VIOLATED")) {
    throw new Error("semantic mismatch reported a verdict");
  }
  let result: SemanticsMismatchDocument;
  try {
    result = JSON.parse(outcome.stdout) as SemanticsMismatchDocument;
  } catch {
    throw new Error("semantic mismatch did not write a structured result");
  }
  if (result.format_version !== "1" || result.status !== "failed") {
    throw new Error("semantic mismatch did not fail the Policy result");
  }
  if (result.form?.origin !== "saved") {
    throw new Error("semantic mismatch did not check a saved Form");
  }
  if (!Array.isArray(result.architectures) || result.architectures.length !== 1) {
    throw new Error("semantic mismatch does not describe exactly one architecture");
  }
  const architecture = result.architectures[0] ?? {};
  if (
    architecture.kind !== "plan" ||
    architecture.stage !== "planned" ||
    architecture.status !== "failed"
  ) {
    throw new Error("semantic mismatch architecture is not a failed Planned stage");
  }
  if (architecture.summary?.policies?.selected !== 1) {
    throw new Error("semantic mismatch did not select exactly one Policy");
  }
  const diagnostics = architecture.diagnostics;
  if (
    !Array.isArray(diagnostics) ||
    !diagnostics.some(
      (entry) =>
        entry.code === "POLICY_SEMANTICS_MISMATCH" &&
        entry.severity === "error" &&
        entry.message === "compiled Policy Pack semantic pin differs from the document",
    )
  ) {
    throw new Error("semantic mismatch did not report POLICY_SEMANTICS_MISMATCH");
  }
  if (!Array.isArray(architecture.evaluations) || architecture.evaluations.length !== 0) {
    throw new Error("semantic mismatch evaluated an instance");
  }
  if (!Array.isArray(architecture.violations) || architecture.violations.length !== 0) {
    throw new Error("semantic mismatch carries a violation");
  }
  if (architecture.summary?.evaluations?.total !== 0) {
    throw new Error("semantic mismatch summary counted evaluations");
  }
  const packs = architecture.policy_packs;
  if (!Array.isArray(packs) || packs.length !== 1) {
    throw new Error("semantic mismatch does not report exactly one Policy Pack");
  }
  const pack = packs[0] ?? {};
  if (pack.linked !== true) {
    throw new Error("semantic mismatch did not link the compiled Policy Pack");
  }
  const linkedDigest = pack.linked_digest;
  if (typeof linkedDigest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(linkedDigest)) {
    throw new Error("semantic mismatch lost the Policy Pack linked digest");
  }
  if (linkedDigest !== expectation.linkedDigest) {
    throw new Error("semantic mismatch refused a different Policy Pack digest");
  }
  const pins = pack.pins;
  if (!Array.isArray(pins) || pins.length !== expectation.pins) {
    throw new Error("semantic mismatch lost the compiled Policy Pack pins");
  }
  for (const pin of pins) {
    if (
      typeof pin.owner !== "string" ||
      pin.owner === "" ||
      typeof pin.semantic_digest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(pin.semantic_digest)
    ) {
      throw new Error("semantic mismatch lost a Policy Pack pin digest");
    }
  }
  return {
    code: "POLICY_SEMANTICS_MISMATCH",
    evaluations: 0,
    exit_code: outcome.exitCode,
    form_origin: "saved",
    linked_digest: linkedDigest,
    pins: pins.length,
    violations: 0,
  };
}

// assertExplorerRefusal reads an explorer that refused to start on an
// occupied loopback port: the loaded Form is reported, the port is named, the
// recovery guidance is present and the diagnostic code is SERVER_FAILED.
export function assertExplorerRefusal(outcome: SpawnOutcome, port: number): void {
  if (outcome.exitCode !== 4) {
    throw new Error(`explorer port conflict exited ${String(outcome.exitCode)}, not 4`);
  }
  if (!outcome.stdout.startsWith("Form loaded\n")) {
    throw new Error("explorer port conflict lost the loaded Form report");
  }
  if (!outcome.stderr.includes(`port ${String(port)} is unavailable`)) {
    throw new Error(`explorer port conflict lost port ${String(port)}`);
  }
  if (!outcome.stderr.includes("Pass --port 0 to pick a free port, or --no-serve.")) {
    throw new Error("explorer port conflict lost its recovery guidance");
  }
  if (!outcome.stderr.includes("Code: SERVER_FAILED")) {
    throw new Error("explorer port conflict lost the SERVER_FAILED diagnostic");
  }
}

// startBusyLoopbackServer owns one loopback port so the journey can prove the
// explorer refuses an occupied port and recovers its listener afterwards.
export function startBusyLoopbackServer(): { port: number; stop: () => void } {
  const server = Bun.serve({
    fetch: () => new Response("occupied by the platform runtime verification\n", { status: 503 }),
    hostname: "127.0.0.1",
    port: 0,
  });
  const port = server.port;
  if (port === undefined || !Number.isSafeInteger(port) || port < 1) {
    server.stop(true);
    throw new Error("busy loopback server did not bind a port");
  }
  return { port, stop: () => server.stop(true) };
}

function emptyVerdictEvidence(): PolicyVerdictEvidence {
  return { evaluations: null, exit_code: null, status: null, violations: null };
}

function emptyVerdicts(): Record<PolicyVerdict, PolicyVerdictEvidence> {
  return {
    indeterminate: emptyVerdictEvidence(),
    passed: emptyVerdictEvidence(),
    violated: emptyVerdictEvidence(),
  };
}

function emptyRefusal(): RefusalEvidence {
  return { code: null, exit_code: null };
}

function emptyPolicySemanticsMismatch(): PolicySemanticsMismatchEvidence {
  return {
    code: null,
    evaluations: null,
    exit_code: null,
    form_origin: null,
    linked_digest: null,
    pins: null,
    violations: null,
  };
}

function emptyRefusals(): JourneyEvidence["input_refusals"] {
  return {
    incomplete: emptyRefusal(),
    invalid_json: emptyRefusal(),
    oversized: emptyRefusal(),
    unreadable: emptyRefusal(),
  };
}

function emptyEvidence(binary: string, target: TargetLabel, steps: JourneyStep[]): JourneyEvidence {
  return {
    binary: basename(binary),
    executable_sha256: null,
    run_sha256: null,
    lock_absence_preserved: false,
    lock_unchanged: false,
    empty_vendor_rejected: false,
    offline_inspection_no_credentials: false,
    online_offline_identical: false,
    passed: false,
    local_policy_pack_inspection: false,
    steps,
    supplied_dialects_not_installed: false,
    supplied_release_set_offline: false,
    target,
    version: null,
    explorer: { port_conflict: false, served_loopback: false },
    input_refusals: emptyRefusals(),
    policy_verdicts: emptyVerdicts(),
    policy_semantics_mismatch: emptyPolicySemanticsMismatch(),
    process_environment_allowlisted: false,
    usage_refusal: emptyRefusal(),
  };
}
export function assertEmbeddedDialectInspection(listBody: string, showBody: string): void {
  const listed = JSON.parse(listBody) as { name?: unknown; origin?: unknown; version?: unknown }[];
  if (
    !Array.isArray(listed) ||
    !listed.some((entry) => entry.name === "aws") ||
    listed.some((entry) => entry.name === "core")
  ) {
    throw new Error("effective Dialect catalog lost AWS or retained legacy core");
  }
  for (const entry of listed) {
    if (
      typeof entry.name !== "string" ||
      typeof entry.version !== "string" ||
      entry.origin !== "embedded"
    ) {
      throw new Error("supplied Dialect listing lost embedded identity");
    }
  }
  const shown = JSON.parse(showBody) as { name?: unknown; origin?: unknown; version?: unknown };
  if (
    shown.name !== "aws" ||
    shown.origin !== "embedded" ||
    shown.version !== listed.find((entry) => entry.name === "aws")?.version
  ) {
    throw new Error("embedded supplied Dialect inspection drifted");
  }
}

export async function readRunAddress(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const read = async (): Promise<string> => {
    let received = "";
    while (true) {
      const next = await reader.read();
      if (next.value) received += decoder.decode(next.value, { stream: true });
      if (received.length > 65_536) {
        throw new Error("rootform run output exceeded the loopback address probe limit");
      }
      for (const match of received.matchAll(/http:\/\/127\.0\.0\.1:(\d{1,5})(?=[/\s]|$)/gu)) {
        const port = Number(match[1]);
        if (port >= 1 && port <= 65_535) return match[0];
      }
      if (next.done) throw new Error("rootform run stopped before publishing a loopback address");
    }
  };
  return Promise.race([
    read(),
    Bun.sleep(15_000).then(() => {
      throw new Error("rootform run did not publish a loopback address");
    }),
  ]);
}

export async function probeRun(
  binary: string,
  arguments_: string[],
  options: { cwd: string; environment: Record<string, string>; redactions: readonly Redaction[] },
): Promise<string> {
  const server = Bun.spawn([binary, ...arguments_], {
    cwd: options.cwd,
    env: childEnvironment(options.environment),
    stderr: "pipe",
    stdout: "ignore",
  });
  try {
    if (!(server.stderr instanceof ReadableStream)) {
      throw new Error("rootform run stderr is unavailable");
    }
    const address = await readRunAddress(server.stderr);
    const response = await fetch(address, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const html = await response.text();
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("text/html") ||
      !html.toLowerCase().includes("<!doctype html>")
    ) {
      throw new Error("rootform run did not serve its self-contained HTML shell");
    }
    return address;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(redact(detail, options.redactions));
  } finally {
    if (server.exitCode === null) server.kill();
    await server.exited;
  }
}

export function treeDigest(directory: string): string {
  const digest = createHash("sha256");
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  )) {
    const path = join(directory, entry.name);
    const name = path.slice(directory.length + 1).replaceAll("\\", "/");
    const status = lstatSync(path);
    if (status.isSymbolicLink()) throw new Error(`verification tree contains symlink: ${name}`);
    if (entry.isDirectory()) {
      digest.update(`directory\0${name}\0${treeDigest(path)}\0`);
      continue;
    }
    if (!entry.isFile()) throw new Error(`verification tree contains irregular file: ${name}`);
    digest.update(`file\0${name}\0${status.size}\0`);
    digest.update(readFileSync(path));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function digest(body: Buffer | string): string {
  return createHash("sha256").update(body).digest("hex");
}

function lockBody(project: string): Buffer {
  return readFileSync(join(project, "rootform.lock"));
}

function lockSelections(project: string): void {
  const lock = JSON.parse(lockBody(project).toString("utf8")) as Record<string, unknown>;
  if (lock.format_version !== "1") throw new Error("rootform.lock format_version drifted");
  for (const obsolete of ["entries", "sources", "unsupported_providers", "index"]) {
    if (obsolete in lock) throw new Error(`rootform.lock uses obsolete field ${obsolete}`);
  }
  for (const key of ["dialects", "policy_packs", "excluded_owners", "replacements"]) {
    if (!Array.isArray(lock[key])) {
      throw new Error(`rootform.lock ${key} must be an array`);
    }
  }
  if (Array.isArray(lock.dialects) && lock.dialects.length !== 0) {
    throw new Error("supplied example locks must not select Dialects");
  }
}

function currentHost(): Host {
  return { arch: process.arch, platform: process.platform };
}

export async function runJourney(
  arguments_: RuntimeArguments,
  steps: JourneyStep[] = [],
  host: Host = currentHost(),
): Promise<JourneyEvidence> {
  let activeRedactions: readonly Redaction[] = [];
  const record = (name: string, detail?: string): void => {
    steps.push(detail === undefined ? { name, ok: true } : { detail, name, ok: true });
  };
  const failed = (step: string, error: unknown): never => {
    const raw = error instanceof Error ? error.message : String(error);
    const message = redact(raw, activeRedactions);
    steps.push({ detail: message, name: step, ok: false });
    throw new JourneyError(step, message);
  };
  const attempt = <T>(step: string, action: () => T, detail?: (result: T) => string): T => {
    try {
      const result = action();
      record(step, detail?.(result));
      return result;
    } catch (error) {
      return failed(step, error);
    }
  };
  attempt("target-matches-host", () =>
    assertTargetMatchesHost(arguments_.target, host.platform, host.arch),
  );
  attempt("binary-is-regular-file", () => requireRegularFile(arguments_.binary, "rootform binary"));
  const processEnvironmentAllowlisted = attempt("child-environment-allowlisted", () => {
    const probe = childEnvironment(
      {},
      {
        ...process.env,
        AWS_SECRET_ACCESS_KEY: "sentinel",
        GITHUB_TOKEN: "sentinel",
      },
    );
    for (const name of ["AWS_SECRET_ACCESS_KEY", "GITHUB_TOKEN"]) {
      if (name in probe) throw new Error(`child environment inherited ${name}`);
    }
    return true;
  });
  let runSha = "";
  let onlineRun = "";
  let version: string | null = null;
  let sandbox: string | undefined;
  const policyVerdicts = emptyVerdicts();
  const inputRefusals = emptyRefusals();
  const explorer = { port_conflict: false, served_loopback: false };
  let usageRefusal: RefusalEvidence = emptyRefusal();
  let policySemanticsMismatch: PolicySemanticsMismatchEvidence = emptyPolicySemanticsMismatch();

  try {
    sandbox = mkdtempSync(join(tmpdir(), "rootform-platform-runtime-"));
    const project = join(sandbox, "project with spaces");
    const home = join(sandbox, "home with spaces");
    const freshHome = join(sandbox, "fresh home");
    const outputs = join(sandbox, "outputs");
    const root = join(import.meta.dir, "..");
    const example = join(root, "examples", "playground", "shared-data-platform", "base");
    const registryConfig = join(sandbox, "registry docker config");
    const invalidDockerConfig = join(sandbox, "invalid docker config");
    const invalidCa = join(sandbox, "invalid-ca.pem");
    const redactions: Redaction[] = [
      { path: arguments_.binary, placeholder: "<rootform-binary>" },
      { path: dirname(arguments_.binary), placeholder: "<binary-directory>" },
      { path: project, placeholder: "<project>" },
      { path: home, placeholder: "<home>" },
      { path: freshHome, placeholder: "<fresh-home>" },
      { path: root, placeholder: "<distribution>" },
      { path: sandbox, placeholder: "<sandbox>" },
    ];
    activeRedactions = redactions;
    const run = (command: string[], cwd: string, environment: Record<string, string>) =>
      runBinary(arguments_.binary, command, { cwd, environment, redactions });
    const runPlan = (
      cwd: string,
      environment: Record<string, string>,
      output?: string,
      directory = project,
    ) =>
      run(
        [
          "run",
          join(directory, "plan.json"),
          "--project",
          directory,
          "--plan-file",
          join(directory, "plan.tfplan"),
          "--require-enrichment",
          "--locked",
          "--no-serve",
          ...(output ? ["-o", output] : ["--format", "json"]),
        ],
        cwd,
        environment,
      );

    attempt("sandbox-preparation", () => {
      mkdirSync(outputs);
      mkdirSync(freshHome);
      mkdirSync(registryConfig);
      mkdirSync(invalidDockerConfig);
      writeFileSync(join(registryConfig, "config.json"), "{}\n");
      writeFileSync(join(invalidDockerConfig, "config.json"), "not-json{{{\n");
      writeFileSync(invalidCa, "not a pem bundle\n");
      cpSync(example, project, { recursive: true });
      if (!lockBody(project).equals(lockBody(example))) {
        throw new Error("copied playground lock differs from versioned lock");
      }
      lockSelections(project);
    });
    const expectedLock = lockBody(example);
    const onlineEnvironment = {
      DOCKER_CONFIG: registryConfig,
      ROOTFORM_HOME: home,
      ROOTFORM_OFFLINE: "0",
      SSL_CERT_FILE: "",
    };
    const offlineEnvironment = {
      ALL_PROXY: "http://rootform-proxy-sentinel.invalid:9",
      DOCKER_CONFIG: invalidDockerConfig,
      HTTP_PROXY: "http://rootform-proxy-sentinel.invalid:9",
      HTTPS_PROXY: "http://rootform-proxy-sentinel.invalid:9",
      NO_PROXY: "",
      ROOTFORM_HOME: home,
      ROOTFORM_OFFLINE: "1",
      SSL_CERT_FILE: invalidCa,
      all_proxy: "http://rootform-proxy-sentinel.invalid:9",
      http_proxy: "http://rootform-proxy-sentinel.invalid:9",
      https_proxy: "http://rootform-proxy-sentinel.invalid:9",
      no_proxy: "",
    };

    version = attempt(
      "version",
      () => {
        const probe = run(["version"], project, onlineEnvironment);
        const banner = probe.stdout.trim();
        if (banner !== `rootform ${arguments_.version}`) {
          throw new Error(`rootform version output differs: ${banner}`);
        }
        return arguments_.version;
      },
      (reported) => reported,
    );

    attempt("init-without-lock-preserves-absence", () => {
      const noLockProject = join(sandbox as string, "project without lock");
      cpSync(project, noLockProject, { recursive: true });
      rmSync(join(noLockProject, "rootform.lock"));
      run(
        ["init", noLockProject, "--no-input", "--format", "json"],
        noLockProject,
        onlineEnvironment,
      );
      if (existsSync(join(noLockProject, "rootform.lock"))) {
        throw new Error("init created rootform.lock for an empty selection");
      }
    });

    attempt("init-locked-preserves-lock", () => {
      run(
        ["init", project, "--locked", "--no-input", "--format", "json"],
        project,
        onlineEnvironment,
      );
      if (!lockBody(project).equals(expectedLock)) {
        throw new Error("init --locked changed rootform.lock");
      }
    });

    const onlineDocument = join(outputs, "run-online.json");
    attempt(
      "run-online-locked",
      () => {
        runPlan(project, onlineEnvironment, onlineDocument);
        const document = JSON.parse(readFileSync(onlineDocument, "utf8")) as {
          format_version?: string;
          kind?: string;
        };
        if (document.format_version !== "1" || document.kind !== "plan")
          throw new Error("run did not produce a format-1 plan");
        return digest(readFileSync(onlineDocument));
      },
      (sha) => `sha256:${sha}`,
    );

    runSha = attempt(
      "run-stdout-online-locked",
      () => {
        onlineRun = runPlan(project, onlineEnvironment).stdout;
        if (onlineRun !== readFileSync(onlineDocument, "utf8"))
          throw new Error("stdout document differs from file document");
        return digest(onlineRun);
      },
      (sha) => `sha256:${sha}`,
    );

    attempt("policy-without-target-exits-3", () => {
      const policyForm = join(outputs, "policy-no-target-form.json");
      const policyResult = join(outputs, "policy-no-target.json");
      run(
        [
          "run",
          join(root, "scripts", "fixtures", "portable-plan.json"),
          "--project",
          project,
          "--no-serve",
          "-o",
          policyForm,
        ],
        project,
        onlineEnvironment,
      );
      const outcome = runBinaryStatus(
        arguments_.binary,
        [
          "check",
          policyForm,
          "--project",
          project,
          "--policy-pack",
          join(root, "policy-packs", "baseline"),
          "-o",
          policyResult,
        ],
        { cwd: project, environment: onlineEnvironment, redactions },
      );
      if (outcome.exitCode !== 3) {
        throw new Error(`policy without target exited ${outcome.exitCode}: ${outcome.stderr}`);
      }
      assertNoTargetPolicyResult(readFileSync(policyResult, "utf8"));
    });

    const syntheticPack = join(sandbox, "synthetic policy pack");
    const brokenInput = join(outputs, "broken.json");
    const incompleteInput = join(outputs, "incomplete.json");
    const missingInput = join(outputs, "missing input.json");
    const oversizedInput = join(outputs, "oversized.json");
    attempt("synthetic-policy-pack-fixture", () => {
      mkdirSync(join(syntheticPack, "policies"), { recursive: true });
      writeFileSync(
        join(syntheticPack, "pack.rf.hcl"),
        'policy_pack "runtime-proofs" {\n  version = "0.1.0"\n}\n',
      );
      writeFileSync(
        join(syntheticPack, "policies", "passes.rf.hcl"),
        `policy "passes" {
  target {
    concept = rf.concept.subnet
  }

  assert = exists(contexts(rf.context.network, rf.concept.virtual-network))

  message = "Subnets must belong to a declared virtual network."
}
`,
      );
      writeFileSync(
        join(syntheticPack, "policies", "violates.rf.hcl"),
        `policy "violates" {
  target {
    concept = rf.concept.subnet
  }

  assert = !exists(contexts(rf.context.network, rf.concept.virtual-network))

  message = "Subnets must not belong to a declared virtual network (synthetic violation)."
}
`,
      );
      writeFileSync(
        join(syntheticPack, "policies", "unknown.rf.hcl"),
        `policy "unknown" {
  target {
    concept = kubernetes.concept.deployment
  }

  assert = exists(contexts(rf.context.runtime, rf.concept.kubernetes-cluster))

  message = "Deployments must declare the Kubernetes cluster they run on."
}
`,
      );
      writeFileSync(
        join(syntheticPack, "policies", "auth0-applications.rf.hcl"),
        `policy "auth0-applications" {
  target {
    concept = auth0.concept.identity-application
  }

  assert = true

  message = "Auth0 applications carry an interpreted representation."
}
`,
      );
    });

    const checkInput = (input: string, policy: string) =>
      runBinaryStatus(
        arguments_.binary,
        [
          "check",
          input,
          "--project",
          project,
          "--policy-pack",
          syntheticPack,
          "--policy",
          policy,
          "--format",
          "json",
        ],
        { cwd: project, environment: offlineEnvironment, redactions },
      );

    policyVerdicts.passed = attempt(
      "policy-passed-exits-0",
      () =>
        assertPolicyOutcome(checkInput(onlineDocument, "runtime-proofs.policy.passes"), {
          exitCode: 0,
          verdict: "passed",
        }),
      (evidence) => `${String(evidence.evaluations)} evaluations`,
    );
    policyVerdicts.violated = attempt(
      "policy-violated-exits-1",
      () =>
        assertPolicyOutcome(checkInput(onlineDocument, "runtime-proofs.policy.violates"), {
          exitCode: 1,
          verdict: "violated",
        }),
      (evidence) => `${String(evidence.violations)} violations`,
    );
    policyVerdicts.indeterminate = attempt(
      "policy-indeterminate-exits-3",
      () =>
        assertPolicyOutcome(checkInput(onlineDocument, "runtime-proofs.policy.unknown"), {
          exitCode: 3,
          verdict: "indeterminate",
        }),
      (evidence) => `${String(evidence.evaluations)} evaluations`,
    );

    attempt("input-refusal-fixtures", () => {
      writeFileSync(brokenInput, '{"format_version": "1", "planned_values": {\n');
      writeFileSync(
        incompleteInput,
        '{"format_version": "1", "planned_values": {"root_module": {}}}\n',
      );
      writeFileSync(oversizedInput, "");
      truncateSync(oversizedInput, 129 * 1024 * 1024);
      if (lstatSync(oversizedInput).size <= 128 * 1024 * 1024) {
        throw new Error("oversized fixture is not past the 128 MiB ceiling");
      }
    });
    inputRefusals.invalid_json = attempt("invalid-json-input-refused", () =>
      assertCommandRefusal(checkInput(brokenInput, "runtime-proofs.policy.passes"), {
        code: "INPUT_UNRECOGNIZED",
        exitCode: 3,
        headline: "this input is not valid JSON",
      }),
    );
    inputRefusals.incomplete = attempt("incomplete-input-refused", () =>
      assertCommandRefusal(checkInput(incompleteInput, "runtime-proofs.policy.passes"), {
        code: "INPUT_UNRECOGNIZED",
        exitCode: 3,
        headline: "this JSON is not a plan, state or saved Form",
      }),
    );
    inputRefusals.unreadable = attempt("unreadable-input-refused", () =>
      assertCommandRefusal(checkInput(missingInput, "runtime-proofs.policy.passes"), {
        code: "INPUT_UNREADABLE",
        exitCode: 4,
        headline: redact(`cannot read ${JSON.stringify(missingInput)}`, redactions),
      }),
    );
    inputRefusals.oversized = attempt("oversized-input-refused-before-compilation", () => {
      const outcome = checkInput(oversizedInput, "runtime-proofs.policy.passes");
      const refusal = assertCommandRefusal(outcome, {
        code: "INPUT_REFUSED",
        exitCode: 3,
        headline: redact(
          `input ${JSON.stringify(oversizedInput)} exceeds the 128 MiB limit`,
          redactions,
        ),
      });
      if (outcome.stderr.includes("Compiling")) {
        throw new Error("oversized input reached compilation");
      }
      return refusal;
    });
    // An unknown Policy selector is a usage refusal (exit 2), not a semantic
    // incompatibility: the compiled-Pack case below exercises the documented
    // fail-closed pin mismatch at exit 3.
    usageRefusal = attempt("unknown-policy-selector-refused-offline", () =>
      assertUsageRefusal(checkInput(onlineDocument, "runtime-proofs.policy.missing"), {
        exitCode: 2,
        guidance: "rootform list policies",
        message:
          'no Policy named "runtime-proofs.policy.missing" is declared by the loaded Policy Packs',
      }),
    );

    const excludedProject = join(sandbox, "project without auth0");
    const excludedDocument = join(outputs, "run-excluded-owner.json");
    const compiledPack = join(outputs, "compiled-policy-pack.json");
    const compiledCheckHome = join(sandbox, "compiled check home");
    attempt("excluded-owner-project-fixture", () => {
      mkdirSync(compiledCheckHome);
      cpSync(project, excludedProject, { recursive: true });
      const lockPath = join(excludedProject, "rootform.lock");
      const lock = readFileSync(lockPath, "utf8");
      const altered = lock.replace('"excluded_owners": []', '"excluded_owners": ["auth0"]');
      if (altered === lock) {
        throw new Error("the supplied lock has no empty excluded_owners list to alter");
      }
      writeFileSync(lockPath, altered);
      lockSelections(excludedProject);
      const alteredLock = JSON.parse(altered) as { excluded_owners?: unknown };
      if (
        !Array.isArray(alteredLock.excluded_owners) ||
        alteredLock.excluded_owners.join(",") !== "auth0"
      ) {
        throw new Error("the fixture lock does not exclude auth0");
      }
    });

    attempt(
      "run-excluded-owner-saved-form",
      () => {
        runPlan(
          excludedProject,
          { ...offlineEnvironment, ROOTFORM_HOME: freshHome },
          excludedDocument,
          excludedProject,
        );
        for (const [label, path, excluded] of [
          ["online", onlineDocument, false],
          ["excluded-owner", excludedDocument, true],
        ] as const) {
          const document = JSON.parse(readFileSync(path, "utf8")) as {
            kind?: unknown;
            semantics?: { owners?: { id?: unknown }[] };
          };
          const owners = document.semantics?.owners;
          if (document.kind !== "plan" || !Array.isArray(owners)) {
            throw new Error(`the ${label} saved Form carries no recorded semantics`);
          }
          if (owners.some((owner) => owner.id === "auth0") === excluded) {
            throw new Error(
              `the ${label} saved Form ${excluded ? "retained" : "lost"} the auth0 semantics`,
            );
          }
        }
        return digest(readFileSync(excludedDocument));
      },
      (sha) => `sha256:${sha}`,
    );

    const compiledCheckEnvironment = {
      ...offlineEnvironment,
      ROOTFORM_HOME: compiledCheckHome,
    };
    const compiledPackInfo = attempt(
      "compile-policy-pack-pins-saved-form",
      () => {
        run(
          [
            "compile",
            "policy-pack",
            syntheticPack,
            "--semantics",
            onlineDocument,
            "-o",
            compiledPack,
          ],
          project,
          compiledCheckEnvironment,
        );
        const compiled = JSON.parse(readFileSync(compiledPack, "utf8")) as {
          format_version?: unknown;
          linked_digest?: unknown;
          pins?: { owner?: unknown; semantic_digest?: unknown }[];
        };
        const pins = compiled.pins;
        if (
          compiled.format_version !== "v1" ||
          typeof compiled.linked_digest !== "string" ||
          !/^sha256:[0-9a-f]{64}$/u.test(compiled.linked_digest) ||
          !Array.isArray(pins) ||
          !pins.some((pin) => pin.owner === "auth0")
        ) {
          throw new Error("the compiled Policy Pack lost its format or auth0 semantic pin");
        }
        return {
          detail: `pins=${String(pins.length)} sha256:${digest(readFileSync(compiledPack))}`,
          linkedDigest: compiled.linked_digest,
          pins: pins.length,
        };
      },
      (info) => info.detail,
    );

    const checkCompiled = (directory: string, input: string, policy: string) =>
      runBinaryStatus(
        arguments_.binary,
        [
          "check",
          input,
          "--project",
          directory,
          "--policy-pack",
          compiledPack,
          "--policy",
          policy,
          "--format",
          "json",
        ],
        { cwd: directory, environment: compiledCheckEnvironment, redactions },
      );

    attempt(
      "compiled-policy-pack-passes-on-pinned-form",
      () => {
        const outcome = checkCompiled(project, onlineDocument, "runtime-proofs.policy.passes");
        const evidence = assertPolicyOutcome(outcome, { exitCode: 0, verdict: "passed" });
        if (!outcome.stdout.includes(compiledPackInfo.linkedDigest)) {
          throw new Error("the passing check did not report the compiled Policy Pack digest");
        }
        return evidence;
      },
      (evidence) => `${String(evidence.evaluations)} evaluations`,
    );

    policySemanticsMismatch = attempt(
      "policy-semantics-mismatch-fails-closed",
      () => {
        const refusal = assertSemanticsMismatch(
          checkCompiled(
            excludedProject,
            excludedDocument,
            "runtime-proofs.policy.auth0-applications",
          ),
          { linkedDigest: compiledPackInfo.linkedDigest, pins: compiledPackInfo.pins },
        );
        if (readdirSync(compiledCheckHome).length !== 0) {
          throw new Error("compiled Policy Pack checks wrote to the credential-free store");
        }
        return refusal;
      },
      (evidence) =>
        `${evidence.code ?? "no code"} exit ${String(evidence.exit_code)} with ${String(evidence.pins)} pins`,
    );

    attempt("supplied-dialects-never-install", () => {
      if (existsSync(join(home, "dialects")))
        throw new Error("supplied Dialects installed before offline init");
      run(
        ["init", project, "--locked", "--offline", "--no-input", "--format", "json"],
        project,
        offlineEnvironment,
      );
      if (existsSync(join(home, "dialects"))) {
        throw new Error("supplied Dialects must never materialize in the store");
      }
      if (!lockBody(project).equals(expectedLock)) {
        throw new Error("offline init --locked changed the lock");
      }
    });

    const vendorDirectory = join(project, ".rootform", "dialects");
    attempt("empty-dialect-vendor-rejected", () => {
      const outcome = Bun.spawnSync({
        cmd: [arguments_.binary, "vendor", "dialects", "--offline"],
        cwd: project,
        env: childEnvironment(offlineEnvironment),
        stderr: "pipe",
        stdout: "pipe",
      });
      if (outcome.exitCode !== 3) {
        const output = redact(
          `${outcome.stdout.toString("utf8")}\n${outcome.stderr.toString("utf8")}`,
          redactions,
        );
        throw new Error(`empty Dialect vendor exit ${outcome.exitCode}: ${output.trim()}`);
      }
      if (existsSync(vendorDirectory)) {
        throw new Error("vendor created a supplied-Dialect tree");
      }
    });

    const offlineDocument = join(outputs, "run-offline.json");
    attempt(
      "offline-run-without-credentials",
      () => {
        runPlan(
          project,
          {
            ...offlineEnvironment,
            ROOTFORM_HOME: freshHome,
          },
          offlineDocument,
        );
        if (!readFileSync(onlineDocument).equals(readFileSync(offlineDocument))) {
          throw new Error("offline run output differs from supplied release-set output");
        }
        if (!lockBody(project).equals(expectedLock)) {
          throw new Error("offline --locked run changed the lock");
        }
        return digest(readFileSync(offlineDocument));
      },
      (sha) => `sha256:${sha}`,
    );

    attempt("offline-run-stdout-without-credentials", () => {
      const outcome = runPlan(project, {
        ...offlineEnvironment,
        ROOTFORM_HOME: freshHome,
      });
      if (outcome.stdout !== onlineRun) {
        throw new Error("offline run output differs from supplied release-set output");
      }
      if (existsSync(join(freshHome, "dialects"))) {
        throw new Error("offline run installed supplied Dialects");
      }
    });

    attempt("offline-list-show-without-credentials", () => {
      const environment = {
        ...offlineEnvironment,
        ROOTFORM_HOME: freshHome,
      };
      assertEmbeddedDialectInspection(
        run(["list", "dialects", "--format", "json"], project, environment).stdout,
        run(["show", "aws", "--format", "json"], project, environment).stdout,
      );
    });

    attempt("local-policy-pack-list-show", () => {
      const policyPack = join(root, "policy-packs", "baseline");
      const environment = {
        ...offlineEnvironment,
        ROOTFORM_HOME: freshHome,
      };
      const listed = JSON.parse(
        run(
          ["list", "policy-packs", "--policy-pack", policyPack, "--format", "json"],
          project,
          environment,
        ).stdout,
      ) as { name?: unknown; version?: unknown }[];
      if (listed.length !== 1 || listed[0]?.name !== "baseline" || listed[0]?.version !== "0.1.0") {
        throw new Error("local Policy Pack listing differs from the versioned baseline pack");
      }
      const shown = JSON.parse(
        run(
          ["show", "policy-pack", "baseline", "--policy-pack", policyPack, "--format", "json"],
          project,
          environment,
        ).stdout,
      ) as {
        name?: unknown;
        policies?: unknown;
        version?: unknown;
      };
      if (
        shown.name !== "baseline" ||
        shown.version !== "0.1.0" ||
        !Array.isArray(shown.policies) ||
        shown.policies.length !== 2
      ) {
        throw new Error("local Policy Pack inspection differs from the versioned baseline pack");
      }
    });
    explorer.port_conflict = attempt("explorer-port-conflict-refused", () => {
      const busy = startBusyLoopbackServer();
      try {
        const outcome = runBinaryStatus(
          arguments_.binary,
          ["run", onlineDocument, "--port", String(busy.port), "--no-browser"],
          { cwd: project, environment: onlineEnvironment, redactions },
        );
        assertExplorerRefusal(outcome, busy.port);
        return true;
      } finally {
        busy.stop();
      }
    });

    try {
      const address = await probeRun(
        arguments_.binary,
        ["run", onlineDocument, "--port", "0", "--no-browser"],
        { cwd: project, environment: onlineEnvironment, redactions },
      );
      explorer.served_loopback = true;
      record("explorer-serves-loopback", address);
    } catch (error) {
      failed("explorer-serves-loopback", error);
    }
  } catch (error) {
    if (error instanceof JourneyError) throw error;
    const raw = error instanceof Error ? error.message : String(error);
    const message = redact(raw, activeRedactions);
    steps.push({ detail: message, name: "journey", ok: false });
    throw new JourneyError("journey", message);
  } finally {
    if (sandbox !== undefined) {
      const cleanupPath = sandbox;
      attempt("sandbox-cleanup", () => rmSync(cleanupPath, { force: true, recursive: true }));
    }
  }

  return {
    binary: basename(arguments_.binary),
    executable_sha256: digest(readFileSync(arguments_.binary)),
    run_sha256: runSha,
    lock_absence_preserved: true,
    lock_unchanged: true,
    empty_vendor_rejected: true,
    offline_inspection_no_credentials: true,
    online_offline_identical: true,
    passed: true,
    local_policy_pack_inspection: true,
    steps,
    supplied_dialects_not_installed: true,
    supplied_release_set_offline: true,
    target: arguments_.target,
    version,
    explorer,
    input_refusals: inputRefusals,
    policy_verdicts: policyVerdicts,
    policy_semantics_mismatch: policySemanticsMismatch,
    process_environment_allowlisted: processEnvironmentAllowlisted,
    usage_refusal: usageRefusal,
  };
}

function writeEvidence(arguments_: RuntimeArguments, evidence: JourneyEvidence): void {
  const body = `${JSON.stringify(evidence, null, 2)}\n`;
  process.stdout.write(body);
  if (arguments_.evidence) {
    mkdirSync(dirname(arguments_.evidence), { recursive: true });
    writeFileSync(arguments_.evidence, body, { flag: "wx" });
  }
}

async function main(): Promise<void> {
  let parsed: RuntimeArguments;
  try {
    parsed = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `invalid platform runtime arguments: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return;
  }
  const steps: JourneyStep[] = [];
  let evidence: JourneyEvidence;
  try {
    evidence = await runJourney(parsed, steps);
  } catch (error) {
    evidence = emptyEvidence(parsed.binary, parsed.target, steps);
    process.stderr.write(
      `platform runtime verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
  writeEvidence(parsed, evidence);
  if (!evidence.passed) process.exitCode = 1;
}

if (import.meta.main) {
  await main();
}
