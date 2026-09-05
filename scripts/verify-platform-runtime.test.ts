import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertTargetMatchesHost,
  JourneyError,
  type JourneyStep,
  parseArguments,
  readRunAddress,
  redact,
  requireRegularFile,
  runBinary,
  runJourney,
  TARGET_LABELS,
  targetHost,
  treeDigest,
} from "./verify-platform-runtime.ts";

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
