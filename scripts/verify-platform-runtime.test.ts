import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertCommandRefusal,
  assertEmbeddedDialectInspection,
  assertExplorerRefusal,
  assertNoTargetPolicyResult,
  assertPolicyOutcome,
  assertSemanticsMismatch,
  assertTargetMatchesHost,
  assertUsageRefusal,
  childEnvironment,
  JourneyError,
  type JourneyStep,
  parseArguments,
  readRunAddress,
  redact,
  requireRegularFile,
  runBinary,
  runBinaryStatus,
  runJourney,
  startBusyLoopbackServer,
  TARGET_LABELS,
  targetHost,
  treeDigest,
} from "./verify-platform-runtime.ts";

test("no-target Policy result has no instance evaluations", () => {
  const result = {
    format_version: "1",
    status: "no_decision",
    selection: { policies: ["baseline.policy.one", "baseline.policy.two"] },
    architectures: [
      {
        kind: "plan",
        stage: "planned",
        status: "no_decision",
        summary: { policies: { selected: 2, no_target: 2 }, evaluations: { total: 0 } },
        evaluations: [],
      },
    ],
  };
  expect(() => assertNoTargetPolicyResult(JSON.stringify(result))).not.toThrow();
  expect(() => assertNoTargetPolicyResult(JSON.stringify({ ...result, status: "passed" }))).toThrow(
    /no_decision/u,
  );
  expect(() =>
    assertNoTargetPolicyResult(
      JSON.stringify({
        ...result,
        architectures: [
          {
            ...result.architectures[0],
            summary: { policies: { selected: 2, no_target: 2 }, evaluations: { total: 1 } },
          },
        ],
      }),
    ),
  ).toThrow(/no_decision/u);
  for (const invalid of [
    { ...result, architectures: [], summary: result.architectures[0]?.summary },
    { ...result, architectures: [result.architectures[0], result.architectures[0]] },
    { ...result, architectures: [{ ...result.architectures[0], status: "passed" }] },
    { ...result, architectures: [{ ...result.architectures[0], evaluations: [{}] }] },
    { ...result, selection: { policies: [] } },
  ])
    expect(() => assertNoTargetPolicyResult(JSON.stringify(invalid))).toThrow(/no_decision/u);
});

test("supplied Dialect inspection uses the embedded origin", () => {
  const aws = { name: "aws", version: "0.1.0", origin: "embedded" };
  expect(() =>
    assertEmbeddedDialectInspection(JSON.stringify([aws]), JSON.stringify(aws)),
  ).not.toThrow();
  for (const invalid of [[], [{ ...aws, origin: "supplied" }], [aws, { ...aws, name: "core" }]]) {
    expect(() =>
      assertEmbeddedDialectInspection(JSON.stringify(invalid), JSON.stringify(aws)),
    ).toThrow();
  }
  for (const invalid of [
    { ...aws, origin: "supplied" },
    { ...aws, version: "0.1.1" },
    { ...aws, name: "azure" },
  ]) {
    expect(() =>
      assertEmbeddedDialectInspection(JSON.stringify([aws]), JSON.stringify(invalid)),
    ).toThrow();
  }
});

test("parseArguments accepts spaced and inline flag forms", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rootform-parse-"));
  const parsed = parseArguments(
    [
      "--binary",
      "bin/rootform",
      "--target=macos-arm64",
      "--version",
      "0.1.0-sprint.3",
      "--evidence",
      "out/evidence.json",
    ],
    cwd,
  );
  expect(parsed.binary).toBe(join(cwd, "bin", "rootform"));
  expect(parsed.target).toBe("macos-arm64");
  expect(parsed.version).toBe("0.1.0-sprint.3");
  expect(parsed.evidence).toBe(join(cwd, "out", "evidence.json"));
});

test("parseArguments rejects malformed invocations", () => {
  const cwd = "/tmp";
  expect(() => parseArguments([], cwd)).toThrow(/--binary is required/u);
  expect(() => parseArguments(["--binary", "rootform"], cwd)).toThrow(/--target is required/u);
  expect(() => parseArguments(["--binary", "rootform", "--target", "linux-amd64"], cwd)).toThrow(
    /--version is required/u,
  );
  expect(() =>
    parseArguments(["--binary", "x", "--target", "solaris-amd64", "--version", "0.1.0"], cwd),
  ).toThrow(/unsupported platform runtime target/u);
  expect(() =>
    parseArguments(
      ["--binary", "x", "--target", "linux-amd64", "--version", "0.1.0", "--nope", "y"],
      cwd,
    ),
  ).toThrow(/unknown platform runtime argument/u);
  expect(() =>
    parseArguments(
      ["--binary", "x", "--target", "linux-amd64", "--version", "0.1.0", "--binary", "y"],
      cwd,
    ),
  ).toThrow(/duplicate platform runtime argument/u);
  expect(() => parseArguments(["--binary", "--target", "linux-amd64"], cwd)).toThrow(
    /--binary requires a value/u,
  );
  expect(() =>
    parseArguments(["--binary", "x", "--target", "linux-amd64", "--version", "dev"], cwd),
  ).toThrow(/invalid release version/u);
});

test("target labels map to host platforms and architectures", () => {
  expect(targetHost("linux-amd64")).toEqual({ arch: "x64", platform: "linux" });
  expect(targetHost("linux-arm64")).toEqual({ arch: "arm64", platform: "linux" });
  expect(targetHost("macos-amd64")).toEqual({ arch: "x64", platform: "darwin" });
  expect(targetHost("macos-arm64")).toEqual({ arch: "arm64", platform: "darwin" });
  expect(targetHost("windows-amd64")).toEqual({ arch: "x64", platform: "win32" });
  for (const label of TARGET_LABELS) {
    const host = targetHost(label);
    expect(() => assertTargetMatchesHost(label, host.platform, host.arch)).not.toThrow();
  }
  expect(() => assertTargetMatchesHost("windows-amd64", "darwin", "x64")).toThrow(/cannot run/u);
  expect(() => assertTargetMatchesHost("macos-arm64", "linux", "arm64")).toThrow(/cannot run/u);
  expect(() => assertTargetMatchesHost("linux-amd64", "linux", "arm64")).toThrow(/cannot run/u);
});

test("requireRegularFile rejects missing, directory, and empty binaries", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "rootform-regular-"));
  expect(() => requireRegularFile(join(sandbox, "missing"), "binary")).toThrow(/is missing/u);
  const directory = join(sandbox, "directory");
  mkdirSync(directory);
  expect(() => requireRegularFile(directory, "binary")).toThrow(/must be a regular file/u);
  const empty = join(sandbox, "empty");
  writeFileSync(empty, "");
  expect(() => requireRegularFile(empty, "binary")).toThrow(/has zero size/u);
});

test("requireRegularFile rejects symlinked binaries", () => {
  if (process.platform === "win32") return;
  const sandbox = mkdtempSync(join(tmpdir(), "rootform-symlink-"));
  const target = join(sandbox, "target");
  writeFileSync(target, "payload");
  const link = join(sandbox, "link");
  symlinkSync(target, link);
  expect(() => requireRegularFile(link, "binary")).toThrow(/must be a regular file/u);
});

test("redact replaces known paths without touching unrelated text", () => {
  const home = "/tmp/rootform-home with spaces";
  const result = redact(`failed at ${home}/dialects and ${home}`, [
    { path: home, placeholder: "<home>" },
  ]);
  expect(result).toBe("failed at <home>/dialects and <home>");
  expect(redact("nothing to hide", [{ path: "/tmp/x", placeholder: "<x>" }])).toBe(
    "nothing to hide",
  );
});

test("runBinary executes a local executable and reports failures", () => {
  if (process.platform === "win32") return;
  const sandbox = mkdtempSync(join(tmpdir(), "rootform-run-"));
  const binary = join(sandbox, "fake-rootform");
  writeFileSync(binary, "#!/bin/sh\nprintf 'banner %s\\n' \"$*\"\n", { mode: 0o755 });
  chmodSync(binary, 0o755);
  const redactions = [{ path: sandbox, placeholder: "<sandbox>" }];
  const success = runBinary(binary, ["version", join(sandbox, "with spaces")], {
    cwd: sandbox,
    environment: {},
    redactions,
  });
  expect(success.stdout).toBe(`banner version <sandbox>/with spaces\n`);
  const failing = join(sandbox, "failing");
  writeFileSync(failing, "#!/bin/sh\necho boom >&2\nexit 3\n", { mode: 0o755 });
  chmodSync(failing, 0o755);
  expect(() =>
    runBinary(failing, ["version"], { cwd: sandbox, environment: {}, redactions }),
  ).toThrow(/failed \(exit 3\).*boom/su);
});

test("readRunAddress accepts only an explicit loopback HTTP address", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          "preparing architecture\nRootform explorer: http://127.0.0.1:21717\n",
        ),
      );
      controller.close();
    },
  });
  expect(await readRunAddress(stream)).toBe("http://127.0.0.1:21717");
});

test("readRunAddress rejects external and lookalike addresses", async () => {
  for (const address of [
    "https://example.com:21717",
    "http://localhost:21717",
    "http://127.0.0.1:21717.example.com",
    "http://127.0.0.1:0",
    "http://127.0.0.1:99999",
  ]) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`${address}\n`));
        controller.close();
      },
    });
    await expect(readRunAddress(stream)).rejects.toThrow(/before publishing a loopback address/u);
  }
});

test("treeDigest is deterministic and detects injected files", () => {
  const left = mkdtempSync(join(tmpdir(), "rootform-tree-left-"));
  const right = mkdtempSync(join(tmpdir(), "rootform-tree-right-"));
  writeFileSync(join(left, "b.txt"), "bee");
  mkdirSync(join(left, "sub"));
  writeFileSync(join(left, "sub", "a.txt"), "aye");
  writeFileSync(join(left, "z.txt"), "zed");
  writeFileSync(join(right, "z.txt"), "zed");
  mkdirSync(join(right, "sub"));
  writeFileSync(join(right, "sub", "a.txt"), "aye");
  writeFileSync(join(right, "b.txt"), "bee");
  expect(treeDigest(left)).toBe(treeDigest(right));
  writeFileSync(join(right, "stale.injected"), "stale");
  expect(treeDigest(left)).not.toBe(treeDigest(right));
});

test("treeDigest rejects symlinks", () => {
  if (process.platform === "win32") return;
  const sandbox = mkdtempSync(join(tmpdir(), "rootform-tree-link-"));
  writeFileSync(join(sandbox, "target"), "payload");
  symlinkSync(join(sandbox, "target"), join(sandbox, "link"));
  expect(() => treeDigest(sandbox)).toThrow(/symlink/u);
});

test("runJourney rejects a mismatched target before touching the binary", async () => {
  const steps: JourneyStep[] = [];
  let error: unknown;
  try {
    await runJourney(
      {
        binary: "/nonexistent/rootform",
        evidence: undefined,
        target: "macos-arm64",
        version: "0.1.0",
      },
      steps,
      {
        arch: "arm64",
        platform: "linux",
      },
    );
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(JourneyError);
  if (error instanceof JourneyError) expect(error.step).toBe("target-matches-host");
  expect(steps).toHaveLength(1);
  expect(steps[0]?.name).toBe("target-matches-host");
  expect(steps[0]?.ok).toBe(false);
});

const hostLabel = TARGET_LABELS.find(
  (label) =>
    targetHost(label).platform === process.platform && targetHost(label).arch === process.arch,
);

test("runJourney reports a failed version probe without network", async () => {
  if (process.platform === "win32" || hostLabel === undefined) return;
  const sandbox = mkdtempSync(join(tmpdir(), "rootform-journey-"));
  const binary = join(sandbox, "fake-rootform");
  writeFileSync(binary, "#!/bin/sh\necho version probe failed >&2\nexit 4\n", { mode: 0o755 });
  chmodSync(binary, 0o755);
  const steps: JourneyStep[] = [];
  let error: unknown;
  try {
    await runJourney(
      { binary, evidence: undefined, target: hostLabel, version: "0.1.0" },
      steps,
      targetHost(hostLabel),
    );
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(JourneyError);
  if (error instanceof JourneyError) expect(error.step).toBe("version");
  expect(steps.some((step) => step.name === "version" && !step.ok)).toBe(true);
  expect(steps.some((step) => step.name === "version" && step.detail?.includes("exit 4"))).toBe(
    true,
  );
});

function policyEvaluation(outcome: string, reasons: string[] = []) {
  return {
    address: "google_compute_subnetwork.gke",
    id: "evaluation:runtime-proofs.policy.sample:representation%3A1%3Agoogle_compute_subnetwork.gke:planned",
    outcome,
    policy: "runtime-proofs.policy.sample",
    reasons,
  };
}

const sampleViolation = {
  address: "google_compute_subnetwork.gke",
  id: "violation:runtime-proofs.policy.sample:representation%3A1%3Agoogle_compute_subnetwork.gke:planned",
  message: "Subnets must not belong to a declared virtual network (synthetic violation).",
  policy: "runtime-proofs.policy.sample",
};

function policyResult(
  status: string,
  outcomes: string[],
  violations: unknown[] = [],
  policyOutcome = status,
) {
  const counted = (outcome: string) => outcomes.filter((entry) => entry === outcome).length;
  return {
    format_version: "1",
    selection: {
      policies: ["runtime-proofs.policy.sample"],
      selectors: ["runtime-proofs.policy.sample"],
    },
    status,
    architectures: [
      {
        evaluations: outcomes.map((outcome) =>
          policyEvaluation(outcome, outcome === "indeterminate" ? ["unavailable"] : []),
        ),
        policies: [{ id: "runtime-proofs.policy.sample", outcome: policyOutcome }],
        status,
        summary: {
          evaluations: {
            indeterminate: counted("indeterminate"),
            passed: counted("passed"),
            total: outcomes.length,
            violated: counted("violated"),
          },
          policies: { selected: 1 },
        },
        violations,
      },
    ],
  };
}

function checkOutcome(body: unknown, exitCode: number) {
  return { exitCode, stderr: "progress\n", stdout: JSON.stringify(body) };
}

test("assertPolicyOutcome reads a demonstrated pass with its evaluations", () => {
  const evidence = assertPolicyOutcome(
    checkOutcome(policyResult("passed", ["passed", "passed"]), 0),
    {
      exitCode: 0,
      verdict: "passed",
    },
  );
  expect(evidence).toEqual({ evaluations: 2, exit_code: 0, status: "passed", violations: 0 });
});

test("assertPolicyOutcome reads a violation with its negative finding", () => {
  const evidence = assertPolicyOutcome(
    checkOutcome(policyResult("violated", ["violated", "indeterminate"], [sampleViolation]), 1),
    { exitCode: 1, verdict: "violated" },
  );
  expect(evidence).toEqual({ evaluations: 2, exit_code: 1, status: "violated", violations: 1 });
  expect(
    assertPolicyOutcome(
      checkOutcome(
        policyResult("violated", ["violated"], [sampleViolation, { ...sampleViolation }]),
        1,
      ),
      { exitCode: 1, verdict: "violated" },
    ).violations,
  ).toBe(2);
});

test("assertPolicyOutcome reads an indeterminate verdict without a success", () => {
  const evidence = assertPolicyOutcome(
    checkOutcome(policyResult("indeterminate", ["indeterminate"]), 3),
    { exitCode: 3, verdict: "indeterminate" },
  );
  expect(evidence).toEqual({
    evaluations: 1,
    exit_code: 3,
    status: "indeterminate",
    violations: 0,
  });
});

test("assertPolicyOutcome refuses violations, no-answers and failures read as a pass", () => {
  for (const body of [
    policyResult("violated", ["violated"], [sampleViolation]),
    policyResult("no_decision", []),
    policyResult("failed", []),
    policyResult("passed", ["passed", "violated"], [sampleViolation]),
    policyResult("passed", []),
    { ...policyResult("passed", ["passed"]), status: "approved" },
    policyResult("passed", ["passed"], [], "no_target"),
  ]) {
    expect(() =>
      assertPolicyOutcome(checkOutcome(body, 0), { exitCode: 0, verdict: "passed" }),
    ).toThrow();
  }
  const unknownOutcome = policyResult("passed", ["passed"]);
  (unknownOutcome.architectures[0]?.evaluations[0] as { outcome: string }).outcome = "approved";
  expect(() =>
    assertPolicyOutcome(checkOutcome(unknownOutcome, 0), { exitCode: 0, verdict: "passed" }),
  ).toThrow(/documented outcomes/u);
  const hiddenViolation = policyResult("passed", ["passed"]);
  (hiddenViolation.architectures[0]?.evaluations[0] as { outcome: string }).outcome = "violated";
  expect(() =>
    assertPolicyOutcome(checkOutcome(hiddenViolation, 0), { exitCode: 0, verdict: "passed" }),
  ).toThrow(/recorded outcomes/u);
  expect(() =>
    assertPolicyOutcome(checkOutcome(policyResult("passed", ["passed"]), 0), {
      exitCode: 0,
      verdict: "violated",
    }),
  ).toThrow(/must exit 1/u);
  expect(() =>
    assertPolicyOutcome(
      checkOutcome(policyResult("violated", ["violated"], [sampleViolation]), 1),
      {
        exitCode: 0,
        verdict: "passed",
      },
    ),
  ).toThrow(/exited 1/u);
});

test("assertPolicyOutcome refuses a violation without a finding or a reasonless indeterminacy", () => {
  expect(() =>
    assertPolicyOutcome(checkOutcome(policyResult("violated", ["violated"]), 1), {
      exitCode: 1,
      verdict: "violated",
    }),
  ).toThrow(/no violated evaluation/u);
  expect(() =>
    assertPolicyOutcome(
      checkOutcome(policyResult("indeterminate", ["indeterminate"], [sampleViolation]), 3),
      { exitCode: 3, verdict: "indeterminate" },
    ),
  ).toThrow(/carries a violation/u);
  const reasonless = policyResult("indeterminate", ["indeterminate"]);
  (reasonless.architectures[0]?.evaluations[0] as { reasons: string[] }).reasons = [];
  expect(() =>
    assertPolicyOutcome(checkOutcome(reasonless, 3), { exitCode: 3, verdict: "indeterminate" }),
  ).toThrow(/states no reason/u);
  const inconsistent = policyResult("passed", ["passed"]);
  const inconsistentArchitecture = inconsistent.architectures[0];
  if (inconsistentArchitecture === undefined) throw new Error("fixture architecture is missing");
  inconsistentArchitecture.summary.evaluations.total = 2;
  expect(() =>
    assertPolicyOutcome(checkOutcome(inconsistent, 0), { exitCode: 0, verdict: "passed" }),
  ).toThrow(/inconsistent/u);
});

test("assertCommandRefusal reads a failed result and rejects a verdict or a pass", () => {
  const failedResult = {
    architectures: [],
    diagnostics: [
      {
        code: "INPUT_UNRECOGNIZED",
        message: "malformed JSON or trailing garbage",
        severity: "error",
      },
    ],
    format_version: "1",
    status: "failed",
  };
  const refusal = {
    exitCode: 3,
    stderr:
      "Selected   1 Policy from 1 Policy Pack\n\nError: this input is not valid JSON\n\nCode: INPUT_UNRECOGNIZED\n",
    stdout: JSON.stringify(failedResult),
  };
  const expectation = {
    code: "INPUT_UNRECOGNIZED",
    exitCode: 3,
    headline: "this input is not valid JSON",
  };
  expect(assertCommandRefusal(refusal, expectation)).toEqual({
    code: "INPUT_UNRECOGNIZED",
    exit_code: 3,
  });
  expect(() => assertCommandRefusal(refusal, { ...expectation, code: "INPUT_REFUSED" })).toThrow(
    /diagnostic/u,
  );
  expect(() => assertCommandRefusal({ ...refusal, exitCode: 1 }, expectation)).toThrow(/exited 1/u);
  expect(() =>
    assertCommandRefusal({ ...refusal, stderr: `${refusal.stderr}Verdict PASSED\n` }, expectation),
  ).toThrow(/verdict/u);
  expect(() =>
    assertCommandRefusal(refusal, { ...expectation, headline: "this JSON is not a plan" }),
  ).toThrow(/headline/u);
  expect(() => assertCommandRefusal({ ...refusal, stdout: "" }, expectation)).toThrow(
    /failed result/u,
  );
  expect(() =>
    assertCommandRefusal(
      { ...refusal, stdout: JSON.stringify({ ...failedResult, status: "passed" }) },
      expectation,
    ),
  ).toThrow(/failed result/u);
  expect(() =>
    assertCommandRefusal(
      {
        ...refusal,
        stdout: JSON.stringify({
          ...failedResult,
          diagnostics: [{ code: "INPUT_INVALID", severity: "error" }],
        }),
      },
      expectation,
    ),
  ).toThrow(/did not report/u);
  expect(() =>
    assertCommandRefusal(
      { ...refusal, stdout: JSON.stringify({ ...failedResult, architectures: [{}] }) },
      expectation,
    ),
  ).toThrow(/evaluated an architecture/u);
});

test("assertUsageRefusal reads an unknown selector refusal and rejects a coded diagnostic", () => {
  const failedResult = {
    architectures: [],
    diagnostics: [
      {
        code: "USAGE_INVALID",
        message:
          'no Policy named "runtime-proofs.policy.missing" is declared by the loaded Policy Packs',
        severity: "error",
      },
    ],
    format_version: "1",
    status: "failed",
  };
  const outcome = {
    exitCode: 2,
    stderr:
      'Using runtime-proofs 0.1.0 for this command only\nrootform: no Policy named "runtime-proofs.policy.missing" is declared by the loaded Policy Packs\n\nTry:\n  rootform list policies\n',
    stdout: JSON.stringify(failedResult),
  };
  const expectation = {
    exitCode: 2,
    guidance: "rootform list policies",
    message:
      'no Policy named "runtime-proofs.policy.missing" is declared by the loaded Policy Packs',
  };
  expect(assertUsageRefusal(outcome, expectation)).toEqual({
    code: "USAGE_INVALID",
    exit_code: 2,
  });
  expect(() => assertUsageRefusal({ ...outcome, exitCode: 1 }, expectation)).toThrow(
    /exited 1, not 2/u,
  );
  expect(() =>
    assertUsageRefusal({ ...outcome, stderr: "rootform: nothing to report\n" }, expectation),
  ).toThrow(/message/u);
  expect(() =>
    assertUsageRefusal(
      { ...outcome, stderr: outcome.stderr.replace("rootform list policies", "nothing") },
      expectation,
    ),
  ).toThrow(/guidance/u);
  expect(() =>
    assertUsageRefusal(
      { ...outcome, stderr: `${outcome.stderr}Code: USAGE_INVALID\n` },
      expectation,
    ),
  ).toThrow(/evaluation diagnostic/u);
  expect(() =>
    assertUsageRefusal(
      { ...outcome, stdout: JSON.stringify({ ...failedResult, status: "passed" }) },
      expectation,
    ),
  ).toThrow(/failed result/u);
  expect(() =>
    assertUsageRefusal(
      {
        ...outcome,
        stdout: JSON.stringify({
          ...failedResult,
          diagnostics: [{ code: "INPUT_INVALID", severity: "error" }],
        }),
      },
      expectation,
    ),
  ).toThrow(/did not report/u);
});

const semanticsMismatchDigest = `sha256:${"1".repeat(64)}`;

function semanticsMismatchResult() {
  return {
    architectures: [
      {
        diagnostics: [
          {
            code: "POLICY_SEMANTICS_MISMATCH",
            message: "compiled Policy Pack semantic pin differs from the document",
            severity: "error",
          },
        ],
        evaluations: [] as unknown[],
        kind: "plan",
        policy_packs: [
          {
            content_digest: `sha256:${"3".repeat(64)}`,
            id: "runtime-proofs",
            linked: true,
            linked_digest: semanticsMismatchDigest,
            pins: [
              {
                kind: "dialect",
                owner: "auth0",
                semantic_digest: `sha256:${"4".repeat(64)}`,
                version: "0.1.0",
              },
              {
                kind: "vocabulary",
                owner: "rf",
                semantic_digest: `sha256:${"5".repeat(64)}`,
                version: "0.1.0",
              },
            ],
            version: "0.1.0",
          },
        ],
        stage: "planned",
        status: "failed",
        summary: {
          evaluations: { indeterminate: 0, passed: 0, total: 0, violated: 0 },
          policies: { indeterminate: 0, no_target: 0, passed: 0, selected: 1, violated: 0 },
        },
        violations: [] as unknown[],
      },
    ],
    form: { digest: `sha256:${"2".repeat(64)}`, kind: "plan", origin: "saved" },
    format_version: "1",
    scope: "input",
    selection: {
      policies: ["runtime-proofs.policy.auth0-applications"],
      selectors: ["runtime-proofs.policy.auth0-applications"],
    },
    status: "failed",
  };
}

const semanticsMismatchExpectation = { linkedDigest: semanticsMismatchDigest, pins: 2 };

function semanticsMismatchOutcome() {
  return {
    exitCode: 3,
    stderr:
      "Using runtime-proofs 0.1.0 from <sandbox>/compiled-policy-pack.json for this command only\nSelected   1 Policy from 1 Policy Pack\nLoading    <sandbox>/run-excluded-owner.json (saved Form; no recompilation)\nEvaluating 1 Policy against the Planned architecture\n",
    stdout: JSON.stringify(semanticsMismatchResult()),
  };
}

function mutateSemanticsMismatch(
  apply: (result: ReturnType<typeof semanticsMismatchResult>) => void,
) {
  const result = semanticsMismatchResult();
  apply(result);
  return { ...semanticsMismatchOutcome(), stdout: JSON.stringify(result) };
}

test("assertSemanticsMismatch reads the fail-closed pin mismatch", () => {
  expect(assertSemanticsMismatch(semanticsMismatchOutcome(), semanticsMismatchExpectation)).toEqual(
    {
      code: "POLICY_SEMANTICS_MISMATCH",
      evaluations: 0,
      exit_code: 3,
      form_origin: "saved",
      linked_digest: semanticsMismatchDigest,
      pins: 2,
      violations: 0,
    },
  );
});

test("assertSemanticsMismatch refuses another failure or an unlinked Pack", () => {
  const architecture = (result: ReturnType<typeof semanticsMismatchResult>) => {
    const first = result.architectures[0];
    if (first === undefined) throw new Error("fixture architecture is missing");
    return first;
  };
  const pack = (result: ReturnType<typeof semanticsMismatchResult>) => {
    const first = architecture(result).policy_packs[0];
    if (first === undefined) throw new Error("fixture Policy Pack is missing");
    return first;
  };
  expect(() =>
    assertSemanticsMismatch(
      { ...semanticsMismatchOutcome(), exitCode: 0 },
      semanticsMismatchExpectation,
    ),
  ).toThrow(/exited 0, not 3/u);
  expect(() =>
    assertSemanticsMismatch(
      { ...semanticsMismatchOutcome(), stderr: "Selected 1 Policy\n" },
      semanticsMismatchExpectation,
    ),
  ).toThrow(/without recompilation/u);
  expect(() =>
    assertSemanticsMismatch(
      {
        ...semanticsMismatchOutcome(),
        stderr: `${semanticsMismatchOutcome().stderr}Verdict PASSED\n`,
      },
      semanticsMismatchExpectation,
    ),
  ).toThrow(/verdict/u);
  expect(() =>
    assertSemanticsMismatch(
      { ...semanticsMismatchOutcome(), stdout: "" },
      semanticsMismatchExpectation,
    ),
  ).toThrow(/structured result/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        result.status = "passed";
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/did not fail the Policy result/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        result.form.origin = "generated";
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/saved Form/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        result.architectures = [];
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/exactly one architecture/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        architecture(result).status = "passed";
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/failed Planned stage/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        architecture(result).summary.policies.selected = 2;
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/select exactly one Policy/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        const diagnostic = architecture(result).diagnostics[0];
        if (diagnostic === undefined) throw new Error("fixture diagnostic is missing");
        diagnostic.code = "STAGE_UNAVAILABLE";
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/POLICY_SEMANTICS_MISMATCH/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        architecture(result).evaluations.push({});
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/evaluated an instance/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        architecture(result).violations.push({});
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/carries a violation/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        architecture(result).summary.evaluations.total = 1;
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/counted evaluations/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        pack(result).linked = false;
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/link/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        pack(result).linked_digest = "sha256:short";
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/linked digest/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        pack(result).linked_digest = `sha256:${"9".repeat(64)}`;
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/different Policy Pack digest/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        pack(result).pins = [];
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/Policy Pack pins/u);
  expect(() =>
    assertSemanticsMismatch(
      mutateSemanticsMismatch((result) => {
        const pin = pack(result).pins[0];
        if (pin === undefined) throw new Error("fixture pin is missing");
        pin.semantic_digest = "sha256:short";
      }),
      semanticsMismatchExpectation,
    ),
  ).toThrow(/pin digest/u);
  expect(() =>
    assertSemanticsMismatch(semanticsMismatchOutcome(), {
      linkedDigest: semanticsMismatchDigest,
      pins: 3,
    }),
  ).toThrow(/Policy Pack pins/u);
});

test("assertExplorerRefusal reads an occupied port and rejects a silent one", () => {
  const outcome = {
    exitCode: 4,
    stderr:
      "Explorer\nError: port 21717 is unavailable\n\nPass --port 0 to pick a free port, or --no-serve.\n\nCode: SERVER_FAILED\n",
    stdout: "Form loaded\n\nInput <sandbox>/run-online.json\n",
  };
  expect(() => assertExplorerRefusal(outcome, 21717)).not.toThrow();
  expect(() => assertExplorerRefusal({ ...outcome, exitCode: 0 }, 21717)).toThrow(/exited 0/u);
  expect(() =>
    assertExplorerRefusal({ ...outcome, stderr: "Error: port 21717 is unavailable\n" }, 21717),
  ).toThrow(/guidance/u);
  expect(() =>
    assertExplorerRefusal({ ...outcome, stdout: "Error: cannot read\n" }, 21717),
  ).toThrow(/loaded Form/u);
});

test("childEnvironment keeps the allowlist and drops ambient secrets", () => {
  const environment = childEnvironment(
    { ROOTFORM_OFFLINE: "1" },
    {
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "sentinel",
      AWS_SECRET_ACCESS_KEY: "sentinel",
      GITHUB_TOKEN: "sentinel",
      HOME: "/private/home",
      NPM_TOKEN: "sentinel",
      PATH: "/usr/bin",
      ROOTFORM_HOME: "/private/rootform",
      TMPDIR: "/tmp",
    },
  );
  expect(environment).toEqual({ PATH: "/usr/bin", TMPDIR: "/tmp", ROOTFORM_OFFLINE: "1" });
  expect(() => childEnvironment({ "BAD NAME": "x" }, {})).toThrow(
    /invalid child environment name/u,
  );
});

test("runBinaryStatus does not hand ambient secrets to the child", () => {
  if (process.platform === "win32") return;
  const sandbox = mkdtempSync(join(tmpdir(), "rootform-environment-"));
  const binary = join(sandbox, "print-environment");
  writeFileSync(
    binary,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the fake binary prints the variable the child did or did not receive
    "#!/bin/sh\nprintf '%s\\n' \"${GITHUB_TOKEN:-unset}\"\nprintf '%s\\n' \"${PATH:+path-set}\"\n",
    { mode: 0o755 },
  );
  chmodSync(binary, 0o755);
  const previous = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "sentinel";
  try {
    const outcome = runBinaryStatus(binary, [], { cwd: sandbox, environment: {}, redactions: [] });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toBe("unset\npath-set\n");
  } finally {
    if (previous === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previous;
  }
});

test("startBusyLoopbackServer owns a port and stops cleanly", async () => {
  const busy = startBusyLoopbackServer();
  try {
    expect(busy.port).toBeGreaterThan(0);
    const response = await fetch(`http://127.0.0.1:${String(busy.port)}/`, {
      signal: AbortSignal.timeout(5_000),
    });
    expect(response.status).toBe(503);
  } finally {
    busy.stop();
  }
  await expect(
    fetch(`http://127.0.0.1:${String(busy.port)}/`, {
      signal: AbortSignal.timeout(2_000),
    }),
  ).rejects.toThrow();
});
