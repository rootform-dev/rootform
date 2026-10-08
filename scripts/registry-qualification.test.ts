import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseRegistryProofArguments,
  type RegistryProof,
  type RegistryProofExpectation,
  verifyRegistryProof,
} from "./registry-qualification.ts";

const expected: RegistryProofExpectation = {
  binary_sha256: "a".repeat(64),
  candidate_release_id: 42,
  engine_commit: "b".repeat(40),
  rootform_commit: "a".repeat(40),
  version: "0.2.0-rc.1",
};

function fixture(): RegistryProof {
  return {
    binary_sha256: expected.binary_sha256,
    candidate_release_id: expected.candidate_release_id,
    executor_commit: expected.engine_commit,
    executor_repository: "rootform-dev/engine",
    executor_run_id: 123,
    format_version: "1",
    package: {
      id: 456,
      name: "rootform-oci-qualification-123",
      type: "container",
      visibility: "private",
    },
    result: {
      artifact: {
        content_digest: `sha256:${"a".repeat(64)}`,
        layer_digest: `sha256:${"b".repeat(64)}`,
        manifest_digest: `sha256:${"a".repeat(64)}`,
        owner: "registry-compat",
        presentation_digest: `sha256:${"b".repeat(64)}`,
        semantic_digest: `sha256:${"a".repeat(64)}`,
        tag: "dialect-registry-compat-0.1.0",
        version: "0.1.0",
      },
      capabilities: {
        custom_media_types: true,
        docker_credential_helper: true,
        locked_empty_store: true,
        offline_vendor_execution: true,
        policy_pack_locked_empty_store: true,
        policy_pack_offline_vendor_execution: true,
        policy_pack_pull_by_digest: true,
        policy_pack_vendor_exact_repair: true,
        policy_pack_vendor_exclusive: true,
        publish: true,
        publish_idempotent: true,
        pull_by_digest: true,
        vendor_exact_repair: true,
        vendor_exclusive: true,
      },
      format_version: "1",
      policy_pack: {
        content_digest: `sha256:${"b".repeat(64)}`,
        layer_digest: `sha256:${"a".repeat(64)}`,
        manifest_digest: `sha256:${"b".repeat(64)}`,
        name: "registry-compat-policies",
        tag: "policy-pack-registry-compat-policies-0.1.0",
        version: "0.1.0",
      },
      profile: "rootform-oci-core-v1",
      provenance: {
        documentation: `https://github.com/rootform-dev/rootform/blob/${expected.rootform_commit}/contracts/rootform-oci-core-profile.md`,
        licenses: "Apache-2.0",
        revision: expected.rootform_commit,
        source: "https://github.com/rootform-dev/rootform",
      },
      repository: "ghcr.io/rootform-dev/rootform-oci-qualification-123",
    },
    rootform_commit: expected.rootform_commit,
    version: expected.version,
  };
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value as JsonObject;
}

test("verifies the existing registry result with exact candidate and executor identities", () => {
  const input = fixture();
  const verified = verifyRegistryProof(input, expected);
  expect(verified).toEqual(input);
  expect(verified).not.toBe(input);
  expect(verified.result).not.toBe(input.result);
  input.result.capabilities.pull_by_digest = false;
  expect(verified.result.capabilities.pull_by_digest).toBe(true);
  // Artifact versions are independent of the Rootform binary release version.
  expect(verified.result.artifact.version).toBe("0.1.0");
  expect(verified.version).toBe("0.2.0-rc.1");
});

test("returned proof cannot be substituted through a custom serialization prototype", () => {
  const input = fixture();
  Object.setPrototypeOf(input, { toJSON: () => ({ synthetic_private_payload: "sentinel" }) });
  const verified = verifyRegistryProof(input, expected);
  expect(JSON.parse(JSON.stringify(verified))).toEqual(fixture());
});

test("refuses every candidate identity mismatch, including replay from another draft", () => {
  for (const [field, replacement] of [
    ["version", "0.2.0-rc.2"],
    ["rootform_commit", "b".repeat(40)],
    ["binary_sha256", "b".repeat(64)],
    ["candidate_release_id", 43],
    ["executor_commit", "a".repeat(40)],
    ["executor_repository", "rootform-dev/rootform"],
    ["format_version", "2"],
  ] as const) {
    expect(() => verifyRegistryProof({ ...fixture(), [field]: replacement }, expected)).toThrow(
      field,
    );
  }
});

test("refuses noncanonical expected identities even when the proof agrees", () => {
  for (const [field, replacement] of [
    ["version", "dev"],
    ["version", ` ${expected.version}`],
    ["rootform_commit", "main"],
    ["rootform_commit", "A".repeat(40)],
    ["engine_commit", "b".repeat(39)],
    ["binary_sha256", `sha256:${"a".repeat(64)}`],
    ["binary_sha256", "A".repeat(64)],
    ["candidate_release_id", 0],
    ["candidate_release_id", Number.MAX_SAFE_INTEGER + 1],
  ] as const) {
    expect(() => verifyRegistryProof(fixture(), { ...expected, [field]: replacement })).toThrow(
      `expected ${field}`,
    );
  }
});

test("requires positive integer release, executor run and package IDs", () => {
  for (const invalid of [
    0,
    -1,
    1.5,
    "123",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    expect(() => verifyRegistryProof({ ...fixture(), executor_run_id: invalid }, expected)).toThrow(
      "executor_run_id",
    );
    const input = fixture();
    object(input.package).id = invalid;
    expect(() => verifyRegistryProof(input, expected)).toThrow("package.id");
    expect(() =>
      verifyRegistryProof({ ...fixture(), candidate_release_id: invalid }, expected),
    ).toThrow("candidate_release_id");
  }
});

test("requires the exact private container namespace derived from the executor run", () => {
  for (const [field, replacement] of [
    ["visibility", "public"],
    ["visibility", "internal"],
    ["visibility", undefined],
    ["type", "npm"],
    ["name", "rootform"],
    ["name", "rootform-oci-qualification-124"],
    ["name", "rootform-oci-qualification-0123"],
    ["name", "rootform-oci-qualification-123/extra"],
  ]) {
    const input = fixture();
    object(input.package)[field as string] = replacement;
    expect(() => verifyRegistryProof(input, expected)).toThrow(`package.${field}`);
  }
  for (const repository of [
    "ghcr.io/another-owner/rootform-oci-qualification-123",
    "ghcr.io/rootform-dev/rootform-oci-qualification-124",
    "ghcr.io/rootform-dev/rootform-oci-qualification-123:latest",
    "ghcr.io/rootform-dev/rootform-oci-qualification-123/extra",
    "https://ghcr.io/rootform-dev/rootform-oci-qualification-123",
  ]) {
    const input = fixture();
    input.result.repository = repository;
    expect(() => verifyRegistryProof(input, expected)).toThrow("result.repository");
  }
});

test("requires result format, profile and the Rootform provenance revision", () => {
  for (const [field, replacement] of [
    ["format_version", "2"],
    ["profile", "rootform-oci-core-v2"],
  ]) {
    const input = fixture();
    object(input.result)[field as string] = replacement;
    expect(() => verifyRegistryProof(input, expected)).toThrow(`result.${field}`);
  }
  const input = fixture();
  input.result.provenance.revision = expected.engine_commit;
  expect(() => verifyRegistryProof(input, expected)).toThrow("provenance.revision");
});

test("rejects receipts naming another source or contract revision", () => {
  for (const field of ["source", "documentation"] as const) {
    const input = fixture();
    input.result.provenance[field] = "https://github.com/example/fictional-contract";
    expect(() => verifyRegistryProof(input, expected)).toThrow(`provenance.${field}`);
  }
});

const requiredCapabilities = [
  "docker_credential_helper",
  "locked_empty_store",
  "offline_vendor_execution",
  "policy_pack_locked_empty_store",
  "policy_pack_offline_vendor_execution",
  "policy_pack_pull_by_digest",
  "policy_pack_vendor_exact_repair",
  "policy_pack_vendor_exclusive",
  "pull_by_digest",
] as const;

test("requires all nine candidate capabilities to be literal true", () => {
  for (const capability of requiredCapabilities) {
    for (const invalid of [false, "true", 1, null]) {
      const input = fixture();
      object(input.result.capabilities)[capability] = invalid;
      expect(() => verifyRegistryProof(input, expected)).toThrow(capability);
    }
    const input = fixture();
    delete object(input.result.capabilities)[capability];
    expect(() => verifyRegistryProof(input, expected)).toThrow("capabilities");
  }
});

test("retains other emitted capabilities without inventing additional pass requirements", () => {
  const input = fixture();
  for (const capability of [
    "custom_media_types",
    "publish",
    "publish_idempotent",
    "vendor_exact_repair",
    "vendor_exclusive",
  ] as const) {
    input.result.capabilities[capability] = false;
  }
  expect(verifyRegistryProof(input, expected)).toEqual(input);
});

test("rejects missing objects, unknown fields and arbitrary private payloads", () => {
  for (const input of [undefined, null, [], {}, "proof"]) {
    expect(() => verifyRegistryProof(input, expected)).toThrow("registry proof");
  }
  const targets = (input: RegistryProof) => [
    object(input),
    object(input.package),
    object(input.result),
    object(input.result.capabilities),
    object(input.result.provenance),
    object(input.result.artifact),
    object(input.result.policy_pack),
  ];
  for (let index = 0; index < targets(fixture()).length; index++) {
    const input = fixture();
    const target = targets(input)[index];
    if (!target) throw new Error("fixture target is missing");
    target.synthetic_private_payload = "sensitive-value-sentinel";
    expect(() => verifyRegistryProof(input, expected)).toThrow("fields differ");
    try {
      verifyRegistryProof(input, expected);
      throw new Error("expected refusal");
    } catch (error) {
      expect(String(error)).not.toContain("sensitive-value-sentinel");
      expect(String(error)).not.toContain("synthetic_private_payload");
    }
  }
  for (const field of ["package", "result"] as const) {
    const input = fixture();
    delete object(input)[field];
    expect(() => verifyRegistryProof(input, expected)).toThrow("fields differ");
  }
});

test("requires every field of the emitted result and proof envelope", () => {
  const objects = (input: RegistryProof) => [
    object(input),
    object(input.package),
    object(input.result),
    object(input.result.provenance),
    object(input.result.artifact),
    object(input.result.policy_pack),
  ];
  for (const [index, target] of objects(fixture()).entries()) {
    for (const field of Object.keys(target)) {
      const input = fixture();
      const incomplete = objects(input)[index];
      if (!incomplete) throw new Error("fixture object is missing");
      delete incomplete[field];
      expect(() => verifyRegistryProof(input, expected)).toThrow("fields differ");
    }
  }
});

test("validates actual artifact digest fields and version tags", () => {
  for (const kind of ["artifact", "policy_pack"] as const) {
    for (const field of Object.keys(fixture().result[kind]).filter((key) =>
      key.endsWith("_digest"),
    )) {
      for (const invalid of ["sha256:short", "a".repeat(64), `sha256:${"A".repeat(64)}`]) {
        const input = fixture();
        object(input.result[kind])[field] = invalid;
        expect(() => verifyRegistryProof(input, expected)).toThrow(`${kind}.${field}`);
      }
    }
    for (const [field, replacement] of [
      ["tag", "latest"],
      ["version", "dev"],
    ]) {
      const input = fixture();
      object(input.result[kind])[field as string] = replacement;
      expect(() => verifyRegistryProof(input, expected)).toThrow(`${kind}.${field}`);
    }
    const identity = kind === "artifact" ? "owner" : "name";
    for (const invalid of ["invalid/name", "a".repeat(129)]) {
      const input = fixture();
      object(input.result[kind])[identity] = invalid;
      expect(() => verifyRegistryProof(input, expected)).toThrow(`${kind}.${identity}`);
    }
  }
});

test("rejects credentials and noncanonical URLs without echoing their values", () => {
  for (const field of ["documentation", "source"] as const) {
    for (const invalid of [
      "https://user:sensitive-value-sentinel@example.com/source",
      "https://example.com/source?token=sensitive-value-sentinel",
      "https://example.com/source#private",
      "http://example.com/source",
      `https://example.com/${"a".repeat(2048)}`,
    ]) {
      const input = fixture();
      input.result.provenance[field] = invalid;
      expect(() => verifyRegistryProof(input, expected)).toThrow(`provenance.${field}`);
    }
  }
});

function argumentsFor(paths: { binary: string; evidence: string; proof: string }): string[] {
  return [
    "--proof",
    paths.proof,
    `--version=${expected.version}`,
    "--rootform-commit",
    expected.rootform_commit,
    "--binary",
    paths.binary,
    `--candidate-release-id=${expected.candidate_release_id}`,
    "--engine-commit",
    expected.engine_commit,
    "--evidence",
    paths.evidence,
  ];
}

test("parses only the explicit CLI identities and paths", () => {
  const arguments_ = argumentsFor({
    binary: "bin/rootform",
    evidence: "out/evidence.json",
    proof: "proof.json",
  });
  expect(parseRegistryProofArguments(arguments_, "/workspace")).toEqual({
    binary: "/workspace/bin/rootform",
    candidate_release_id: 42,
    engine_commit: expected.engine_commit,
    evidence: "/workspace/out/evidence.json",
    proof: "/workspace/proof.json",
    rootform_commit: expected.rootform_commit,
    version: expected.version,
  });
  expect(() => parseRegistryProofArguments([])).toThrow("--proof is required");
  expect(() => parseRegistryProofArguments([...arguments_, "--proof=other.json"])).toThrow(
    "duplicate",
  );
  expect(() =>
    parseRegistryProofArguments([...arguments_, "--secret=sensitive-value-sentinel"]),
  ).toThrow("unknown registry proof argument");
  expect(() => parseRegistryProofArguments(["--proof", "--version=0.1.0"])).toThrow(
    "requires a value",
  );
  for (const invalid of ["0", "-1", "01", "1.5", "1e3", String(Number.MAX_SAFE_INTEGER + 1)]) {
    expect(() =>
      parseRegistryProofArguments(
        arguments_.map((arg) =>
          arg.startsWith("--candidate-release-id=") ? `--candidate-release-id=${invalid}` : arg,
        ),
      ),
    ).toThrow("candidate-release-id");
  }
});

const binaryBytes = Buffer.from("fictional binary bytes; not an executable\n");
const binaryDigest = createHash("sha256").update(binaryBytes).digest("hex");

function withFiles(
  action: (paths: { binary: string; evidence: string; parent: string; proof: string }) => void,
): void {
  const parent = mkdtempSync(join(tmpdir(), "rootform-registry-proof-"));
  const paths = {
    binary: join(parent, "binary with spaces"),
    evidence: join(parent, "out", "verified.json"),
    parent,
    proof: join(parent, "proof.json"),
  };
  const input = { ...fixture(), binary_sha256: binaryDigest };
  try {
    writeFileSync(paths.binary, binaryBytes);
    writeFileSync(paths.proof, JSON.stringify(input));
    action(paths);
  } finally {
    rmSync(parent, { force: true, recursive: true });
  }
}

function cli(arguments_: string[], cwd: string) {
  const env: Record<string, string> = {};
  for (const name of ["PATH", "TMPDIR", "TMP", "TEMP", "SystemRoot", "windir"]) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  const result = Bun.spawnSync({
    cmd: [process.execPath, join(import.meta.dir, "registry-qualification.ts"), ...arguments_],
    cwd,
    env,
    stderr: "pipe",
    stdout: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}

test("CLI hashes the supplied bytes without executing or changing the binary", () => {
  withFiles((paths) => {
    const result = cli(argumentsFor(paths), paths.parent);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(readFileSync(paths.evidence, "utf8"))).toEqual({
      ...fixture(),
      binary_sha256: binaryDigest,
    });
    expect(readFileSync(paths.binary)).toEqual(binaryBytes);
    expect(JSON.parse(readFileSync(paths.proof, "utf8"))).toEqual({
      ...fixture(),
      binary_sha256: binaryDigest,
    });
    expect(readFileSync(paths.evidence, "utf8").endsWith("\n")).toBe(true);
    const body = readFileSync(paths.evidence);
    expect(cli(argumentsFor(paths), paths.parent).exitCode).toBe(1);
    expect(readFileSync(paths.evidence)).toEqual(body);
  });
});

test("CLI refuses absent, malformed, oversized and incomplete proof without evidence", () => {
  for (const kind of ["missing", "malformed", "oversized", "incomplete"]) {
    withFiles((paths) => {
      if (kind === "missing") rmSync(paths.proof);
      if (kind === "malformed") writeFileSync(paths.proof, "sensitive-value-sentinel{");
      if (kind === "oversized") truncateSync(paths.proof, 64 * 1024 + 1);
      if (kind === "incomplete") writeFileSync(paths.proof, "{}");
      const result = cli(argumentsFor(paths), paths.parent);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).not.toContain("sensitive-value-sentinel");
      expect(result.stderr).not.toContain(paths.parent);
      expect(existsSync(paths.evidence)).toBe(false);
      expect(existsSync(join(paths.parent, "out"))).toBe(false);
    });
  }
});

test("CLI rejects binary byte drift and missing or irregular binary paths", () => {
  for (const kind of ["drift", "missing", "empty", "directory"]) {
    withFiles((paths) => {
      if (kind === "drift") writeFileSync(paths.binary, "other fictional bytes");
      if (kind === "missing") rmSync(paths.binary);
      if (kind === "empty") writeFileSync(paths.binary, "");
      if (kind === "directory") {
        rmSync(paths.binary);
        mkdirSync(paths.binary);
      }
      const result = cli(argumentsFor(paths), paths.parent);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(kind === "drift" ? "binary_sha256" : "registry binary");
      expect(result.stderr).not.toContain(paths.parent);
      expect(existsSync(paths.evidence)).toBe(false);
    });
  }
});

test("CLI rejects symlinked proof and binary inputs", () => {
  if (process.platform === "win32") return;
  for (const kind of ["proof", "binary"] as const) {
    withFiles((paths) => {
      const link = join(paths.parent, "link");
      symlinkSync(paths[kind], link);
      const result = cli(argumentsFor({ ...paths, [kind]: link }), paths.parent);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("regular file");
      expect(existsSync(paths.evidence)).toBe(false);
    });
  }
});
