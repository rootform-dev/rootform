#!/usr/bin/env bun

import { randomBytes } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import {
  IMAGE_PLATFORMS,
  IMAGE_REFERENCE,
  type ImageArchitecture,
  imageBuildEnvironment,
  imageRuntimeBuildArguments,
} from "./build-image.ts";
import { normalizeVersion } from "./release/contract.ts";
import { sha256 } from "./release/digest.ts";

const REGISTRY_IMAGE =
  "registry:3.0.0@sha256:6c5666b861f3505b116bb9aa9b25175e71210414bd010d92035ff64018f9457e";
const OFFICIAL_DIALECT_REPOSITORY = "ghcr.io/rootform-dev/dialects";
const PRIVATE_DIALECT_REPOSITORY = "private.rootform.test/rootform-dev/dialects";
const PUBLIC_EXTERNAL_REPOSITORY = "ghcr.io/acme/rootform-external";
const PRIVATE_EXTERNAL_REPOSITORY = "private.rootform.test/acme/rootform-external";
const PRIVATE_INDEX_ONE = "private.rootform.test/acme/rootform-index-one";
const PRIVATE_INDEX_TWO = "private.rootform.test/acme/rootform-index-two";
const PRIVATE_AMBIGUITY_INDEX = "private.rootform.test/acme/rootform-ambiguity-index";
const PRIVATE_CONFLICT_INDEX_A = "private.rootform.test/acme/rootform-conflict-a";
const PRIVATE_CONFLICT_INDEX_B = "private.rootform.test/acme/rootform-conflict-b";
const INDEX_TAG = "official-index-v1";
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const DIALECT_SOURCE_URL = "https://github.com/rootform-dev/dialects";
const DIALECT_LICENSES = "MPL-2.0";
const DIALECT_ARTIFACT_TYPE = "application/vnd.rootform.dialect.v1";
const DIALECT_CONFIG_TYPE = "application/vnd.rootform.dialect.manifest.v1+json";
const DIALECT_LAYER_TYPE = "application/vnd.rootform.dialect.layer.v1.tar+gzip";

type QualificationOptions = {
  dialects: string;
  evidence: string;
  image: string;
  oras: string;
  revision: string;
  rootformBinary: string;
  trivy: string;
  version: string;
};

type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

type ArtifactPinOverride = {
  manifestDigest?: string;
  repository?: string;
};

type RootformRunOptions = {
  architecture: ImageArchitecture;
  arguments: string[];
  ca?: string;
  dockerConfig?: string;
  helper?: { binaries: string; state: string };
  home: string;
  image: string;
  network: string;
  project: string;
  projectReadOnly?: boolean;
  user?: string;
};

type PodmanEvidence = {
  architecture?: string;
  reason?: string;
  status: "passed" | "unavailable";
};

type PublicationEvidence = {
  artifacts: Array<{ manifest_digest: string; name: string; version: string }>;
  format_version: string;
  index: { manifest_digest: string };
};

type GenericProvenance = {
  documentation?: string;
  licenses?: string;
  revision?: string;
  source?: string;
};

type GenericPublicationEntry = {
  manifest_digest: string;
  manifest_size: number;
  name: string;
  provenance: GenericProvenance;
  repository: string;
  size: number;
  status: "already_present" | "planned" | "published";
  tag: string;
  version: string;
};

type GenericPublicationEvidence = {
  dialects: GenericPublicationEntry[];
  dry_run: boolean;
  format_version: "1";
  index?: {
    manifest_digest: string;
    manifest_size: number;
    provenance: GenericProvenance;
    repository: string;
    size: number;
    status: "already_present" | "planned" | "published";
    tag: string;
  };
  repository: string;
};

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function requireRegularFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink() || status.size < 1) {
    throw new Error(`${label} must be a regular file`);
  }
}

function requireDirectory(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular directory`);
  }
}

export function parseQualificationArguments(
  arguments_: string[],
  cwd = process.cwd(),
): QualificationOptions {
  const values = new Map<string, string>();
  const names = [
    "dialects",
    "evidence",
    "image",
    "oras",
    "revision",
    "rootform-bin",
    "trivy",
    "version",
  ];
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index] ?? "";
    const name = names.find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown image qualification argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate image qualification argument: --${name}`);
    const value = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  for (const name of names) {
    if (!values.get(name)) throw new Error(`--${name} is required`);
  }
  const revision = values.get("revision") as string;
  if (!/^[0-9a-f]{40}$/u.test(revision)) throw new Error("--revision must be one exact commit");
  return {
    dialects: absolute(values.get("dialects") as string, cwd),
    evidence: absolute(values.get("evidence") as string, cwd),
    image: absolute(values.get("image") as string, cwd),
    oras: absolute(values.get("oras") as string, cwd),
    revision,
    rootformBinary: absolute(values.get("rootform-bin") as string, cwd),
    trivy: absolute(values.get("trivy") as string, cwd),
    version: normalizeVersion(values.get("version") as string),
  };
}

function execute(
  command: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): CommandResult {
  const result = Bun.spawnSync({
    cmd: command,
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stderr: "pipe",
    stdout: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}

function run(
  command: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): CommandResult {
  const result = execute(command, options);
  if (result.exitCode !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command[0] ?? "command"} exited ${result.exitCode}`);
  }
  return result;
}

function docker(arguments_: string[]): CommandResult {
  return run(["docker", ...arguments_]);
}

function parseJson(body: string, label: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error(`${label} is not a JSON object`);
  }
}

function jsonObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} is not a JSON object`);
  }
  return value as Record<string, unknown>;
}

function genericProvenance(value: unknown, label: string): GenericProvenance {
  const provenance = jsonObject(value, label);
  const allowed = new Set(["documentation", "licenses", "revision", "source"]);
  if (
    Object.keys(provenance).some((name) => !allowed.has(name)) ||
    Object.values(provenance).some((item) => typeof item !== "string")
  ) {
    throw new Error(`${label} is invalid`);
  }
  return {
    ...(provenance.documentation !== undefined
      ? { documentation: String(provenance.documentation) }
      : {}),
    ...(provenance.licenses !== undefined ? { licenses: String(provenance.licenses) } : {}),
    ...(provenance.revision !== undefined ? { revision: String(provenance.revision) } : {}),
    ...(provenance.source !== undefined ? { source: String(provenance.source) } : {}),
  };
}

function boundedPositive(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 64 * 1024 * 1024
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function parseGenericPublication(
  body: string,
  repository: string,
  includeIndex: boolean,
): GenericPublicationEvidence {
  const result = parseJson(body, "generic publication result");
  if (
    result.format_version !== "1" ||
    typeof result.dry_run !== "boolean" ||
    result.repository !== repository ||
    !Array.isArray(result.dialects) ||
    result.dialects.length < 1 ||
    result.dialects.length > 1024
  ) {
    throw new Error("generic publication result is invalid");
  }
  const dialects = result.dialects.map((value, position) => {
    const item = jsonObject(value, `generic publication dialect ${position}`);
    const name = String(item.name ?? "");
    const version = String(item.version ?? "");
    const tag = String(item.tag ?? "");
    const status = String(item.status ?? "");
    if (
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(name) ||
      !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(version) ||
      tag !== `dialect-${name}-${version}` ||
      item.repository !== repository ||
      !DIGEST.test(String(item.manifest_digest ?? "")) ||
      !["already_present", "planned", "published"].includes(status)
    ) {
      throw new Error(`generic publication dialect ${position} is invalid`);
    }
    return {
      manifest_digest: String(item.manifest_digest),
      manifest_size: boundedPositive(
        item.manifest_size,
        `generic publication dialect ${position} manifest size`,
      ),
      name,
      provenance: genericProvenance(
        item.provenance,
        `generic publication dialect ${position} provenance`,
      ),
      repository,
      size: boundedPositive(item.size, `generic publication dialect ${position} size`),
      status: status as GenericPublicationEntry["status"],
      tag,
      version,
    };
  });
  const ordered = [...dialects].sort((left, right) => {
    const name = left.name.localeCompare(right.name, "en");
    return name || left.version.localeCompare(right.version, "en");
  });
  if (JSON.stringify(dialects) !== JSON.stringify(ordered)) {
    throw new Error("generic publication dialects are not canonical");
  }
  let index: GenericPublicationEvidence["index"];
  if (includeIndex) {
    const item = jsonObject(result.index, "generic publication index");
    const digest = String(item.manifest_digest ?? "");
    const tag = String(item.tag ?? "");
    const status = String(item.status ?? "");
    if (
      item.repository !== repository ||
      !DIGEST.test(digest) ||
      tag !== `index-sha256-${digest.slice("sha256:".length)}` ||
      !["already_present", "planned", "published"].includes(status)
    ) {
      throw new Error("generic publication index is invalid");
    }
    index = {
      manifest_digest: digest,
      manifest_size: boundedPositive(item.manifest_size, "generic publication index manifest size"),
      provenance: genericProvenance(item.provenance, "generic publication index provenance"),
      repository,
      size: boundedPositive(item.size, "generic publication index size"),
      status: status as GenericPublicationEntry["status"],
      tag,
    };
  } else if (result.index !== undefined) {
    throw new Error("generic publication result has unexpected index");
  }
  return {
    dialects,
    dry_run: result.dry_run,
    format_version: "1",
    ...(index ? { index } : {}),
    repository,
  };
}

export function rewriteArtifactPins(
  encoded: string,
  overrides: Record<string, ArtifactPinOverride>,
): string {
  const lock = parseJson(encoded, "rootform.lock");
  if (lock.format_version !== "1" || !Array.isArray(lock.entries)) {
    throw new Error("rootform.lock cannot be qualified");
  }
  const remaining = new Set(Object.keys(overrides));
  for (const value of lock.entries) {
    const entry = jsonObject(value, "rootform.lock entry");
    if (typeof entry.name !== "string") throw new Error("rootform.lock entry has no name");
    const override = overrides[entry.name];
    if (!override) continue;
    const artifact = jsonObject(entry.artifact, `rootform.lock ${entry.name} artifact`);
    if (override.repository !== undefined) artifact.repository = override.repository;
    if (override.manifestDigest !== undefined) {
      artifact.manifest_digest = override.manifestDigest;
    }
    remaining.delete(entry.name);
  }
  if (remaining.size !== 0) {
    throw new Error(`rootform.lock has no requested dialect: ${[...remaining].sort().join(", ")}`);
  }
  return `${JSON.stringify(lock, null, 2)}\n`;
}

function imageTag(suffix: string, architecture: ImageArchitecture): string {
  return `rootform-qualification-${suffix}:${architecture}`;
}

function dockerMount(host: string, container: string, readOnly = false): string {
  return `${host}:${container}${readOnly ? ":ro" : ""}`;
}

export function temporaryPermissionRepairArguments(image: string, temporary: string): string[] {
  const expectedPrefix = join(tmpdir(), "rootform-image-qualification-");
  if (!image || dirname(temporary) !== tmpdir() || !temporary.startsWith(expectedPrefix)) {
    throw new Error("image qualification temporary directory is invalid");
  }
  return [
    "docker",
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--user",
    "0:0",
    "--cap-drop",
    "ALL",
    "--cap-add",
    "DAC_OVERRIDE",
    "--cap-add",
    "FOWNER",
    "--security-opt",
    "no-new-privileges",
    "--volume",
    dockerMount(temporary, "/cleanup"),
    "--entrypoint",
    "/bin/chmod",
    image,
    "-R",
    "a+rwX",
    "/cleanup",
  ];
}

function removeTemporary(temporary: string, repairImage?: string): void {
  try {
    rmSync(temporary, { force: true, recursive: true });
  } catch (error) {
    if (!repairImage || !existsSync(temporary)) throw error;
    const repair = execute(temporaryPermissionRepairArguments(repairImage, temporary));
    if (repair.exitCode !== 0) throw error;
    rmSync(temporary, { force: true, recursive: true });
  }
}

function writeProject(root: string, source: string, terraformLock?: string): void {
  mkdirSync(root, { recursive: true, mode: 0o777 });
  chmodSync(root, 0o777);
  writeFileSync(join(root, "main.tf"), source, { flag: "wx", mode: 0o644 });
  if (terraformLock !== undefined) {
    writeFileSync(join(root, ".terraform.lock.hcl"), terraformLock, {
      flag: "wx",
      mode: 0o644,
    });
  }
}

function dialectRevision(root: string): string {
  const pin = parseJson(
    readFileSync(join(root, "dependencies", "dialects.json"), "utf8"),
    "Dialects dependency pin",
  );
  const revision = String(pin.commit ?? "");
  if (
    pin.format_version !== "1" ||
    pin.repository !== "rootform-dev/dialects" ||
    !/^[0-9a-f]{40}$/u.test(revision)
  ) {
    throw new Error("Dialects dependency pin is invalid");
  }
  return revision;
}

function dialectProvenanceArguments(revision: string): string[] {
  if (!/^[0-9a-f]{40}$/u.test(revision)) throw new Error("Dialect revision is invalid");
  return [
    "--source-url",
    DIALECT_SOURCE_URL,
    "--revision",
    revision,
    "--documentation-url",
    `${DIALECT_SOURCE_URL}/blob/${revision}/README.md`,
    "--licenses",
    DIALECT_LICENSES,
  ];
}

function writableDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o777 });
  chmodSync(path, 0o777);
}

function packageSyntheticDialects(options: {
  definitions: Record<string, string>;
  image: string;
  name: string;
  repository: string;
  temporary: string;
}): string {
  const workspace = join(options.temporary, `synthetic-${options.name}`);
  const source = join(workspace, "source");
  const home = join(options.temporary, `synthetic-${options.name}-home`);
  writableDirectory(workspace);
  mkdirSync(source, { mode: 0o755 });
  writableDirectory(home);
  for (const [name, definition] of Object.entries(options.definitions).sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  )) {
    const directory = join(source, name);
    mkdirSync(directory, { mode: 0o755 });
    writeFileSync(join(directory, "dialect.rf"), `${definition.trim()}\n`, {
      flag: "wx",
      mode: 0o644,
    });
    writeFileSync(
      join(directory, "presentation.json"),
      '{"format_version":"1","rules":{},"concepts":{},"rule_labels":{},"concept_labels":{}}\n',
      { flag: "wx", mode: 0o644 },
    );
  }
  rootformRun({
    architecture: "amd64",
    arguments: [
      "package",
      "dialects",
      "source",
      "--to",
      "layout",
      "--repository",
      options.repository,
      "--source-url",
      "https://example.com/rootform/dialects",
      "--revision",
      "c".repeat(40),
      "--documentation-url",
      "https://example.com/rootform/dialects/docs",
      "--licenses",
      DIALECT_LICENSES,
    ],
    home,
    image: options.image,
    network: "none",
    project: workspace,
  });
  const layout = join(workspace, "layout");
  requireDirectory(layout, `synthetic ${options.name} OCI layout`);
  docker([
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--user",
    "0:0",
    "--cap-drop",
    "ALL",
    "--cap-add",
    "DAC_OVERRIDE",
    "--cap-add",
    "FOWNER",
    "--security-opt",
    "no-new-privileges",
    "--volume",
    dockerMount(layout, "/layout"),
    "--entrypoint",
    "/bin/chmod",
    options.image,
    "-R",
    "a+rX",
    "/layout",
  ]);
  return layout;
}

function packageHostDialects(options: {
  binary: string;
  destination: string;
  home: string;
  repository: string;
  revision: string;
  source: string;
}): void {
  writableDirectory(options.home);
  const result = execute(
    [
      options.binary,
      "package",
      "dialects",
      options.source,
      "--to",
      options.destination,
      "--repository",
      options.repository,
      ...dialectProvenanceArguments(options.revision),
    ],
    { env: { ROOTFORM_HOME: options.home } },
  );
  assertSafeSuccess(result, "generic dialect package", [options.home, options.destination]);
  requireDirectory(options.destination, "generic dialect OCI layout");
}

function publishHostDialects(options: {
  binary: string;
  ca: string;
  dockerConfig: string;
  home: string;
  layout: string;
  repository: string;
}): GenericPublicationEvidence {
  writableDirectory(options.home);
  const result = execute(
    [
      options.binary,
      "publish",
      "dialects",
      options.layout,
      "--to",
      options.repository,
      "--index",
      "--format",
      "json",
    ],
    {
      env: {
        DOCKER_CONFIG: options.dockerConfig,
        ROOTFORM_HOME: options.home,
        SSL_CERT_FILE: options.ca,
      },
    },
  );
  assertSafeSuccess(result, "generic public publication", [
    options.ca,
    options.dockerConfig,
    options.home,
    options.layout,
  ]);
  return parseGenericPublication(result.stdout, options.repository, true);
}

function publishContainerDialects(
  options: Omit<RootformRunOptions, "arguments" | "project"> & {
    dryRun?: boolean;
    includeIndex?: boolean;
    layout: string;
    repository: string;
  },
): CommandResult {
  const arguments_ = [
    "publish",
    "dialects",
    basename(options.layout),
    "--to",
    options.repository,
    ...(options.includeIndex ? ["--index"] : []),
    ...(options.dryRun ? ["--dry-run"] : []),
    "--format",
    "json",
  ];
  return rootformExecute({
    ...options,
    arguments: arguments_,
    project: dirname(options.layout),
  });
}

function omitDialectRoot(layout: string, destination: string): void {
  cpSync(layout, destination, { recursive: true });
  const path = join(destination, "index.json");
  const index = parseJson(readFileSync(path, "utf8"), "OCI layout index");
  if (!Array.isArray(index.manifests) || index.manifests.length < 3) {
    throw new Error("OCI layout has no removable dialect root");
  }
  const position = index.manifests.findIndex((value) => {
    const descriptor = jsonObject(value, "OCI layout root");
    const annotations = jsonObject(descriptor.annotations, "OCI layout root annotations");
    return String(annotations["org.opencontainers.image.ref.name"] ?? "").startsWith("dialect-");
  });
  if (position < 0) throw new Error("OCI layout has no dialect root");
  index.manifests.splice(position, 1);
  writeFileSync(path, JSON.stringify(index), { mode: 0o644 });
}

function resolvePublishedReference(options: {
  ca: string;
  oras: string;
  reference: string;
  registryConfig?: string;
}): string {
  const result = run([
    options.oras,
    "resolve",
    "--ca-file",
    options.ca,
    ...(options.registryConfig ? ["--registry-config", options.registryConfig] : []),
    options.reference,
  ]);
  const digest = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => DIGEST.test(line));
  if (!digest) throw new Error("synthetic OCI publication returned no digest");
  return digest;
}

function publishLayoutTag(options: {
  ca: string;
  destination: string;
  destinationTag: string;
  layout: string;
  oras: string;
  registryConfig?: string;
  sourceTag: string;
}): string {
  run([
    options.oras,
    "cp",
    "--from-oci-layout",
    "--no-tty",
    "--to-ca-file",
    options.ca,
    ...(options.registryConfig ? ["--to-registry-config", options.registryConfig] : []),
    `${options.layout}:${options.sourceTag}`,
    `${options.destination}:${options.destinationTag}`,
  ]);
  return resolvePublishedReference({
    ca: options.ca,
    oras: options.oras,
    reference: `${options.destination}:${options.destinationTag}`,
    registryConfig: options.registryConfig,
  });
}

function sourcePins(lock: Record<string, unknown>, label: string): Array<Record<string, unknown>> {
  if (lock.format_version !== "1" || lock.index !== undefined || !Array.isArray(lock.sources)) {
    throw new Error(`${label} has no format-1 source provenance`);
  }
  const sources = lock.sources.map((value, index) => jsonObject(value, `${label} source ${index}`));
  for (const source of sources) {
    if (
      (source.kind !== "dialect" && source.kind !== "index") ||
      typeof source.reference !== "string" ||
      !DIGEST.test(String(source.manifest_digest ?? ""))
    ) {
      throw new Error(`${label} source provenance is invalid`);
    }
  }
  return sources;
}

function dialectEntry(lock: Record<string, unknown>, name: string): Record<string, unknown> {
  if (!Array.isArray(lock.entries)) throw new Error("rootform.lock entries are invalid");
  const matches = lock.entries
    .map((value, index) => jsonObject(value, `rootform.lock entry ${index}`))
    .filter((entry) => entry.name === name);
  if (matches.length !== 1) throw new Error(`rootform.lock has no unique ${name} entry`);
  return matches[0] as Record<string, unknown>;
}

function readSourceLock(
  path: string,
  label: string,
  expectedReferences: string[],
  forbidden: string[] = [],
): Record<string, unknown> {
  const encoded = readFileSync(path, "utf8");
  for (const value of forbidden) {
    if (value && encoded.includes(value)) throw new Error(`${label} exposed sensitive lock data`);
  }
  const lock = parseJson(encoded, label);
  const sources = sourcePins(lock, label);
  const references = sources
    .map((source) => String(source.reference))
    .sort((left, right) => left.localeCompare(right, "en"));
  const expected = [...expectedReferences].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(references) !== JSON.stringify(expected)) {
    throw new Error(`${label} source references differ`);
  }
  const known = new Set(references);
  if (!Array.isArray(lock.entries)) throw new Error(`${label} entries are invalid`);
  for (const [index, value] of lock.entries.entries()) {
    const entry = jsonObject(value, `${label} entry ${index}`);
    if (
      !Array.isArray(entry.origins) ||
      entry.origins.length === 0 ||
      entry.origins.some((origin) => typeof origin !== "string" || !known.has(origin))
    ) {
      throw new Error(`${label} entry origins are invalid`);
    }
  }
  return lock;
}

function writeDockerConfiguration(directory: string, content: Record<string, unknown>): void {
  mkdirSync(directory, { mode: 0o755 });
  writeFileSync(join(directory, "config.json"), `${JSON.stringify(content)}\n`, {
    flag: "wx",
    mode: 0o644,
  });
}

type CredentialHelperFixture = {
  binaries: string;
  config: string;
  executable: string;
  state: string;
};

function writeCredentialHelperFixture(options: {
  name: string;
  password: string;
  temporary: string;
  username: string;
}): CredentialHelperFixture {
  const config = join(options.temporary, `${options.name}-helper-docker-config`);
  writeDockerConfiguration(config, {
    credHelpers: { "private.rootform.test": "rootform-test" },
  });
  const binaries = join(options.temporary, `${options.name}-credential-helpers`);
  const state = join(options.temporary, `${options.name}-credential-helper-state`);
  mkdirSync(binaries, { mode: 0o755 });
  writableDirectory(state);
  const executable = join(binaries, "docker-credential-rootform-test");
  writeFileSync(
    executable,
    `#!/bin/sh
set -eu
test "\${1:-}" = get
server=$(cat)
printf '%s\\n' "$server" > /run/rootform-helper-state/invoked
test "$server" = private.rootform.test
printf '{"ServerURL":"%s","Username":"%s","Secret":"%s"}\\n' "$server" '${options.username}' '${options.password}'
`,
    { flag: "wx", mode: 0o755 },
  );
  return { binaries, config, executable, state };
}

function privateDockerConfiguration(
  registry: string,
  username: string,
  password: string,
): Record<string, unknown> {
  return {
    auths: {
      [registry]: {
        auth: Buffer.from(`${username}:${password}`).toString("base64"),
      },
    },
  };
}

function assertSafeOutput(result: CommandResult, label: string, forbidden: string[] = []): void {
  const output = `${result.stdout}\n${result.stderr}`;
  if (Buffer.byteLength(output) > 64 * 1024) throw new Error(`${label} output is unbounded`);
  for (const value of [
    ...forbidden,
    "/run/rootform-docker-config",
    "/run/rootform-credential-helpers",
    "/run/rootform-helper-state",
  ]) {
    if (value && output.includes(value)) throw new Error(`${label} exposed sensitive output`);
  }
  if (/authorization\s*[:=]/iu.test(output)) {
    throw new Error(`${label} exposed an Authorization header`);
  }
}

function assertSafeSuccess(result: CommandResult, label: string, forbidden: string[] = []): void {
  assertSafeOutput(result, label, forbidden);
  if (result.exitCode === 0) return;
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  throw new Error(`${label} failed`);
}

function assertSafeFailure(result: CommandResult, label: string, forbidden: string[] = []): void {
  if (result.exitCode === 0) throw new Error(`${label} unexpectedly succeeded`);
  assertSafeOutput(result, label, forbidden);
}

function registryLogs(container: string): string {
  const result = docker(["logs", container]);
  return `${result.stdout}\n${result.stderr}`;
}

export function registryCompletedRequestCount(logs: string): number {
  return logs
    .split(/\r?\n/u)
    .filter(
      (line) => line.includes('msg="response completed"') && line.includes("http.request.method="),
    ).length;
}

export function registryManifestWriteTags(logs: string, repository: string): string[] {
  const prefix = `/v2/${repository}/manifests/`;
  return logs
    .split(/\r?\n/u)
    .filter(
      (line) =>
        line.includes('msg="response completed"') &&
        line.includes("http.request.method=PUT") &&
        line.includes("http.response.status=201"),
    )
    .flatMap((line) => {
      const uri = line.match(/http\.request\.uri="([^"]+)"/u)?.[1];
      if (!uri?.startsWith(prefix)) return [];
      const encoded = uri.slice(prefix.length).split("?", 1)[0] ?? "";
      try {
        return encoded ? [decodeURIComponent(encoded)] : [];
      } catch {
        throw new Error("registry log contains invalid manifest reference");
      }
    });
}

function fetchOCIManifest(options: {
  ca: string;
  oras: string;
  reference: string;
  registryConfig?: string;
}): Record<string, unknown> {
  const result = run([
    options.oras,
    "manifest",
    "fetch",
    "--ca-file",
    options.ca,
    ...(options.registryConfig ? ["--registry-config", options.registryConfig] : []),
    options.reference,
  ]);
  return parseJson(result.stdout, "published OCI manifest");
}

function assertDialectManifest(
  manifest: Record<string, unknown>,
  revision: string,
  forbidden: string[],
): void {
  const config = jsonObject(manifest.config, "published dialect config descriptor");
  const layers = manifest.layers;
  const annotations = jsonObject(manifest.annotations, "published dialect annotations");
  if (
    manifest.artifactType !== DIALECT_ARTIFACT_TYPE ||
    config.mediaType !== DIALECT_CONFIG_TYPE ||
    !Array.isArray(layers) ||
    layers.length !== 1 ||
    jsonObject(layers[0], "published dialect layer descriptor").mediaType !== DIALECT_LAYER_TYPE ||
    annotations["org.opencontainers.image.source"] !== "https://example.com/rootform/dialects" ||
    annotations["org.opencontainers.image.revision"] !== revision ||
    annotations["org.opencontainers.image.documentation"] !==
      "https://example.com/rootform/dialects/docs" ||
    annotations["org.opencontainers.image.licenses"] !== DIALECT_LICENSES
  ) {
    throw new Error("published dialect OCI contract drifted");
  }
  const encoded = JSON.stringify(manifest);
  for (const value of forbidden) {
    if (value && encoded.includes(value)) {
      throw new Error("published dialect manifest exposed sensitive data");
    }
  }
}

export function publishedDialectVersion(publication: PublicationEvidence, name: string): string {
  const matches = publication.artifacts.filter((artifact) => artifact.name === name);
  const version = matches[0]?.version;
  if (
    matches.length !== 1 ||
    !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(version ?? "")
  ) {
    throw new Error(`Dialect publication has no unique ${name} version`);
  }
  return version as string;
}

export function rootformDockerArguments(options: RootformRunOptions): string[] {
  const arguments_ = [
    "run",
    "--rm",
    "--platform",
    `linux/${options.architecture}`,
    "--network",
    options.network,
    "--volume",
    dockerMount(options.project, "/workspace", options.projectReadOnly),
    "--volume",
    dockerMount(options.home, "/home/rootform/.rootform", options.projectReadOnly),
  ];
  if (options.user) arguments_.push("--user", options.user);
  if (options.dockerConfig) {
    arguments_.push(
      "--volume",
      dockerMount(options.dockerConfig, "/run/rootform-docker-config", true),
      "--env",
      "DOCKER_CONFIG=/run/rootform-docker-config",
    );
  }
  if (options.helper) {
    arguments_.push(
      "--volume",
      dockerMount(options.helper.binaries, "/run/rootform-credential-helpers", true),
      "--volume",
      dockerMount(options.helper.state, "/run/rootform-helper-state"),
      "--env",
      "PATH=/run/rootform-credential-helpers:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    );
  }
  if (options.ca) {
    arguments_.push(
      "--volume",
      dockerMount(options.ca, "/run/rootform-ca.crt", true),
      "--env",
      "SSL_CERT_FILE=/run/rootform-ca.crt",
    );
  }
  arguments_.push(options.image, "rootform", ...options.arguments);
  return arguments_;
}

function rootformExecute(options: RootformRunOptions): CommandResult {
  return execute(["docker", ...rootformDockerArguments(options)]);
}

function rootformRun(options: RootformRunOptions): CommandResult {
  const result = rootformExecute(options);
  if (result.exitCode !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error("rootform container exited unsuccessfully");
  }
  return result;
}

function waitForRegistry(container: string): void {
  for (let attempt = 0; attempt < 120; attempt++) {
    const logs = execute(["docker", "logs", container]);
    if (`${logs.stdout}\n${logs.stderr}`.includes("listening on")) return;
    Bun.sleepSync(250);
  }
  throw new Error("ephemeral registry did not become ready");
}

function registryPort(container: string): string {
  const endpoint = docker(["port", container, "443/tcp"]).stdout.trim().split(/\r?\n/u)[0] ?? "";
  const port = endpoint.match(/:([1-9][0-9]{0,4})$/u)?.[1];
  if (!port) throw new Error("ephemeral registry has no loopback port");
  return port;
}

function waitForRun(container: string): string {
  for (let attempt = 0; attempt < 120; attempt++) {
    const logs = execute(["docker", "logs", container]);
    const output = `${logs.stdout}\n${logs.stderr}`;
    if (output.includes("rootform is serving http://")) return output;
    Bun.sleepSync(250);
  }
  throw new Error("rootform run did not become ready");
}

function vulnerabilityCount(path: string): number {
  const report = parseJson(readFileSync(path, "utf8"), "Trivy report");
  if (!Array.isArray(report.Results)) return 0;
  return report.Results.reduce((total, result) => {
    if (typeof result !== "object" || result === null || Array.isArray(result)) return total;
    const vulnerabilities = (result as Record<string, unknown>).Vulnerabilities;
    return total + (Array.isArray(vulnerabilities) ? vulnerabilities.length : 0);
  }, 0);
}

function qualifyPodman(archive: string, version: string): PodmanEvidence {
  if (!Bun.which("podman")) return { reason: "podman is not installed", status: "unavailable" };
  const info = execute(["podman", "info", "--format", "json"]);
  if (info.exitCode !== 0) {
    return { reason: "podman service is unavailable", status: "unavailable" };
  }
  const decoded = parseJson(info.stdout, "Podman information");
  const host = (decoded.host ?? decoded.Host) as Record<string, unknown> | undefined;
  const observed = String(host?.arch ?? host?.Arch ?? "").toLowerCase();
  const architecture = observed.includes("arm") || observed.includes("aarch") ? "arm64" : "amd64";
  run(["podman", "load", "--input", archive]);
  try {
    const versionResult = run([
      "podman",
      "run",
      "--rm",
      "--platform",
      `linux/${architecture}`,
      `${IMAGE_REFERENCE}:${version}`,
      "rootform",
      "version",
    ]);
    if (versionResult.stdout.trim() !== `rootform ${version}`) {
      throw new Error("Podman image reports another Rootform version");
    }
  } finally {
    execute(["podman", "image", "rm", `${IMAGE_REFERENCE}:${version}`]);
  }
  return { architecture: `linux/${architecture}`, status: "passed" };
}

export function qualifyImage(options: QualificationOptions & { root: string }): void {
  requireDirectory(options.dialects, "Dialects checkout");
  requireDirectory(options.image, "image build output");
  requireRegularFile(options.oras, "ORAS executable");
  requireRegularFile(options.rootformBinary, "Rootform executable");
  requireRegularFile(options.trivy, "Trivy executable");
  if (existsSync(options.evidence)) throw new Error("image qualification evidence already exists");
  mkdirSync(dirname(options.evidence), { recursive: true });

  const context = join(options.image, "context");
  const archive = join(options.image, `rootform_${options.version}_image.oci.tar`);
  const manifestPath = join(options.image, `rootform_${options.version}_image.json`);
  requireDirectory(context, "image build context");
  requireRegularFile(archive, "image OCI archive");
  requireRegularFile(manifestPath, "image verification manifest");
  const imageManifest = parseJson(
    readFileSync(manifestPath, "utf8"),
    "image verification manifest",
  );
  const dialectsCommit = dialectRevision(options.root);

  const temporary = mkdtempSync(join(tmpdir(), "rootform-image-qualification-"));
  const suffix = randomBytes(6).toString("hex");
  const network = `rootform-qualification-${suffix}`;
  const publicRegistry = `rootform-public-registry-${suffix}`;
  const privateRegistry = `rootform-private-registry-${suffix}`;
  const runContainer = `rootform-run-${suffix}`;
  const tags = new Map<ImageArchitecture, string>();
  let networkCreated = false;
  let publicRegistryCreated = false;
  let privateRegistryCreated = false;
  let runCreated = false;
  try {
    for (const architecture of IMAGE_PLATFORMS) {
      const tag = imageTag(suffix, architecture);
      tags.set(architecture, tag);
      run(
        imageRuntimeBuildArguments({
          architecture,
          context,
          revision: options.revision,
          tag,
          version: options.version,
        }),
        { env: imageBuildEnvironment() },
      );
    }
    const armImage = tags.get("arm64") as string;
    const amdImage = tags.get("amd64") as string;

    const tls = join(temporary, "tls");
    mkdirSync(tls);
    const caKey = join(tls, "ca.key");
    const ca = join(tls, "ca.crt");
    const serverKey = join(tls, "server.key");
    const serverRequest = join(tls, "server.csr");
    const serverCertificate = join(tls, "server.crt");
    run([
      "openssl",
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      caKey,
      "-out",
      ca,
      "-days",
      "1",
      "-subj",
      "/CN=Rootform ephemeral test CA",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    ]);
    run([
      "openssl",
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      serverKey,
      "-out",
      serverRequest,
      "-subj",
      "/CN=ghcr.io",
      "-addext",
      "subjectAltName=DNS:ghcr.io,DNS:private.rootform.test,DNS:localhost,IP:127.0.0.1",
      "-addext",
      "keyUsage=critical,digitalSignature,keyEncipherment",
      "-addext",
      "extendedKeyUsage=serverAuth",
    ]);
    run([
      "openssl",
      "x509",
      "-req",
      "-in",
      serverRequest,
      "-CA",
      ca,
      "-CAkey",
      caKey,
      "-CAcreateserial",
      "-out",
      serverCertificate,
      "-days",
      "1",
      "-copy_extensions",
      "copy",
    ]);
    chmodSync(caKey, 0o600);
    chmodSync(serverKey, 0o600);
    run(["openssl", "verify", "-CAfile", ca, serverCertificate]);

    docker(["network", "create", network]);
    networkCreated = true;
    docker([
      "run",
      "--detach",
      "--name",
      publicRegistry,
      "--network",
      network,
      "--network-alias",
      "ghcr.io",
      "--publish",
      "127.0.0.1::443",
      "--volume",
      dockerMount(tls, "/certs", true),
      "--env",
      "REGISTRY_HTTP_ADDR=0.0.0.0:443",
      "--env",
      "REGISTRY_HTTP_TLS_CERTIFICATE=/certs/server.crt",
      "--env",
      "REGISTRY_HTTP_TLS_KEY=/certs/server.key",
      REGISTRY_IMAGE,
    ]);
    publicRegistryCreated = true;
    waitForRegistry(publicRegistry);
    const publicPort = registryPort(publicRegistry);

    const registryUsername = `rootform-${randomBytes(6).toString("hex")}`;
    const registryPassword = randomBytes(24).toString("base64url");
    const registryAuth = join(temporary, "registry-auth");
    mkdirSync(registryAuth, { mode: 0o755 });
    writeFileSync(
      join(registryAuth, "htpasswd"),
      `${registryUsername}:${Bun.password.hashSync(registryPassword, {
        algorithm: "bcrypt",
        cost: 10,
      })}\n`,
      { flag: "wx", mode: 0o644 },
    );
    docker([
      "run",
      "--detach",
      "--name",
      privateRegistry,
      "--network",
      network,
      "--network-alias",
      "private.rootform.test",
      "--publish",
      "127.0.0.1::443",
      "--volume",
      dockerMount(tls, "/certs", true),
      "--volume",
      dockerMount(registryAuth, "/auth", true),
      "--env",
      "REGISTRY_HTTP_ADDR=0.0.0.0:443",
      "--env",
      "REGISTRY_HTTP_TLS_CERTIFICATE=/certs/server.crt",
      "--env",
      "REGISTRY_HTTP_TLS_KEY=/certs/server.key",
      "--env",
      "REGISTRY_AUTH=htpasswd",
      "--env",
      "REGISTRY_AUTH_HTPASSWD_REALM=Rootform qualification",
      "--env",
      "REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd",
      REGISTRY_IMAGE,
    ]);
    privateRegistryCreated = true;
    waitForRegistry(privateRegistry);
    const privatePort = registryPort(privateRegistry);

    const publicRegistryConfig = join(temporary, "public-registry-config.json");
    const privateRegistryConfig = join(temporary, "private-registry-config.json");
    const publicationPath = join(temporary, "dialect-publication.json");
    const privatePublicationPath = join(temporary, "private-dialect-publication.json");
    writeFileSync(publicRegistryConfig, "{}\n", { flag: "wx", mode: 0o600 });
    writeFileSync(
      privateRegistryConfig,
      `${JSON.stringify({
        auths: {
          [`127.0.0.1:${privatePort}`]: {
            auth: Buffer.from(`${registryUsername}:${registryPassword}`).toString("base64"),
          },
        },
      })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    run(
      [
        "bun",
        "scripts/publish.ts",
        "--rootform-version",
        options.version,
        "--revision",
        dialectsCommit,
        "--test-repository",
        `127.0.0.1:${publicPort}/rootform-dev/dialects`,
        "--ca-file",
        ca,
        "--registry-config",
        publicRegistryConfig,
        "--evidence",
        publicationPath,
      ],
      {
        cwd: options.dialects,
        env: { ROOTFORM_BIN: options.rootformBinary, ROOTFORM_ORAS_BIN: options.oras },
      },
    );
    const publication = parseJson(
      readFileSync(publicationPath, "utf8"),
      "Dialect publication evidence",
    ) as PublicationEvidence;
    if (
      publication.format_version !== "1" ||
      !Array.isArray(publication.artifacts) ||
      publication.artifacts.length === 0 ||
      !/^sha256:[0-9a-f]{64}$/u.test(publication.index?.manifest_digest ?? "")
    ) {
      throw new Error("Dialect publication evidence is incomplete");
    }
    run(
      [
        "bun",
        "scripts/publish.ts",
        "--rootform-version",
        options.version,
        "--revision",
        dialectsCommit,
        "--test-repository",
        `127.0.0.1:${privatePort}/rootform-dev/dialects`,
        "--ca-file",
        ca,
        "--registry-config",
        privateRegistryConfig,
        "--evidence",
        privatePublicationPath,
      ],
      {
        cwd: options.dialects,
        env: { ROOTFORM_BIN: options.rootformBinary, ROOTFORM_ORAS_BIN: options.oras },
      },
    );
    const privatePublication = parseJson(
      readFileSync(privatePublicationPath, "utf8"),
      "Private dialect publication evidence",
    ) as PublicationEvidence;
    if (
      privatePublication.format_version !== "1" ||
      JSON.stringify(privatePublication.artifacts) !== JSON.stringify(publication.artifacts) ||
      privatePublication.index.manifest_digest !== publication.index.manifest_digest
    ) {
      throw new Error("private registry changed published OCI content");
    }
    const genericOfficialRepository = `127.0.0.1:${publicPort}/rootform-dev/dialects`;
    const genericOfficialLayout = join(temporary, "generic-official-layout");
    const genericOfficialDockerConfig = join(temporary, "generic-public-docker-config");
    writeDockerConfiguration(genericOfficialDockerConfig, {});
    packageHostDialects({
      binary: options.rootformBinary,
      destination: genericOfficialLayout,
      home: join(temporary, "generic-official-package-home"),
      repository: genericOfficialRepository,
      revision: dialectsCommit,
      source: options.dialects,
    });
    const genericOfficial = publishHostDialects({
      binary: options.rootformBinary,
      ca,
      dockerConfig: genericOfficialDockerConfig,
      home: join(temporary, "generic-official-publish-home"),
      layout: genericOfficialLayout,
      repository: genericOfficialRepository,
    });
    const officialDialectDigests = publication.artifacts
      .map(({ manifest_digest, name, version }) => ({ manifest_digest, name, version }))
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    const genericDialectDigests = genericOfficial.dialects.map(
      ({ manifest_digest, name, version }) => ({ manifest_digest, name, version }),
    );
    if (
      JSON.stringify(genericDialectDigests) !== JSON.stringify(officialDialectDigests) ||
      genericOfficial.dialects.some(({ status }) => status !== "already_present") ||
      !genericOfficial.index ||
      genericOfficial.index.status !== "published"
    ) {
      throw new Error("generic and official dialect publishers differ");
    }
    const officialDiscoveryAfterGeneric = resolvePublishedReference({
      ca,
      oras: options.oras,
      reference: `${genericOfficialRepository}:${INDEX_TAG}`,
      registryConfig: publicRegistryConfig,
    });
    if (officialDiscoveryAfterGeneric !== publication.index.manifest_digest) {
      throw new Error("generic publisher moved official discovery tag");
    }
    const awsDialectVersion = publishedDialectVersion(publication, "aws");
    const coreDialectVersion = publishedDialectVersion(publication, "core");
    const privateDockerConfig = join(temporary, "private-docker-config");
    writeDockerConfiguration(
      privateDockerConfig,
      privateDockerConfiguration("private.rootform.test", registryUsername, registryPassword),
    );
    const publicationHelper = writeCredentialHelperFixture({
      name: "publication",
      password: registryPassword,
      temporary,
      username: registryUsername,
    });

    const privateLayout = packageSyntheticDialects({
      definitions: {
        companyapp: `dialect "companyapp" {
  version = "0.1.0"
  requires { companycore = "0.1.0" }
}`,
        companycore: `dialect "companycore" { version = "0.1.0" }`,
      },
      image: amdImage,
      name: "private",
      repository: PRIVATE_EXTERNAL_REPOSITORY,
      temporary,
    });
    const publicationConflictLayout = packageSyntheticDialects({
      definitions: {
        companyapp: `dialect "companyapp" {
  version = "0.1.0"
  requires { companycore = "0.1.0" }
}`,
        companycore: `dialect "companycore" {
  version = "0.1.0"
  provider "hashicorp/random" { version = "= 3.7.2" }
}`,
      },
      image: amdImage,
      name: "private-conflict",
      repository: PRIVATE_EXTERNAL_REPOSITORY,
      temporary,
    });
    const bridgeLayout = packageSyntheticDialects({
      definitions: {
        companyofficial: `dialect "companyofficial" {
  version = "0.1.0"
  requires { core = "0.1.0" }
}`,
        core: `dialect "core" { version = "0.1.0" }`,
      },
      image: amdImage,
      name: "official-bridge",
      repository: PRIVATE_EXTERNAL_REPOSITORY,
      temporary,
    });
    const ambiguityLayout = packageSyntheticDialects({
      definitions: {
        companyaws: `dialect "companyaws" {
  version = "0.1.0"
  provider "hashicorp/aws" { version = "= 6.62.0" }
}`,
        teamaws: `dialect "teamaws" {
  version = "0.1.0"
  provider "hashicorp/aws" { version = "= 6.62.0" }
}`,
      },
      image: amdImage,
      name: "ambiguity",
      repository: "private.rootform.test/acme/rootform-ambiguity-dialects",
      temporary,
    });
    const conflictLayoutA = packageSyntheticDialects({
      definitions: {
        shared: `dialect "shared" {
  version = "0.1.0"
  provider "hashicorp/aws" { version = "= 6.62.0" }
}`,
      },
      image: amdImage,
      name: "conflict-a",
      repository: "private.rootform.test/acme/rootform-conflict-a-dialects",
      temporary,
    });
    const conflictLayoutB = packageSyntheticDialects({
      definitions: {
        shared: `dialect "shared" {
  version = "0.1.0"
  provider "hashicorp/aws" { version = ">= 6.0.0, < 7.0.0" }
}`,
      },
      image: amdImage,
      name: "conflict-b",
      repository: "private.rootform.test/acme/rootform-conflict-b-dialects",
      temporary,
    });

    const privatePushRepository = `127.0.0.1:${privatePort}/acme/rootform-external`;
    const publicPushRepository = `127.0.0.1:${publicPort}/acme/rootform-external`;
    const genericDryRunHome = join(temporary, "generic-dry-run-home");
    writableDirectory(genericDryRunHome);
    const genericDryRunResult = publishContainerDialects({
      architecture: "amd64",
      dryRun: true,
      home: genericDryRunHome,
      image: amdImage,
      includeIndex: true,
      layout: privateLayout,
      network: "none",
      repository: PRIVATE_EXTERNAL_REPOSITORY,
    });
    assertSafeSuccess(genericDryRunResult, "generic publication dry-run", [privateLayout]);
    const genericDryRun = parseGenericPublication(
      genericDryRunResult.stdout,
      PRIVATE_EXTERNAL_REPOSITORY,
      true,
    );
    if (
      !genericDryRun.dry_run ||
      genericDryRun.dialects.some(({ status }) => status !== "planned") ||
      genericDryRun.index?.status !== "planned"
    ) {
      throw new Error("generic publication dry-run is not local plan");
    }

    const genericPrivateHome = join(temporary, "generic-private-publish-home");
    writableDirectory(genericPrivateHome);
    const privatePublicationSince = new Date().toISOString();
    Bun.sleepSync(1100);
    const genericPrivateResult = publishContainerDialects({
      architecture: "amd64",
      ca,
      dockerConfig: privateDockerConfig,
      home: genericPrivateHome,
      image: amdImage,
      includeIndex: true,
      layout: privateLayout,
      network,
      repository: PRIVATE_EXTERNAL_REPOSITORY,
    });
    assertSafeSuccess(genericPrivateResult, "generic private publication", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
      privateLayout,
    ]);
    const genericPrivate = parseGenericPublication(
      genericPrivateResult.stdout,
      PRIVATE_EXTERNAL_REPOSITORY,
      true,
    );
    if (
      genericPrivate.dry_run ||
      genericPrivate.dialects.some(({ status }) => status !== "published") ||
      genericPrivate.index?.status !== "published"
    ) {
      throw new Error("generic private publication did not publish complete layout");
    }
    const expectedSyntheticProvenance = {
      documentation: "https://example.com/rootform/dialects/docs",
      licenses: DIALECT_LICENSES,
      revision: "c".repeat(40),
      source: "https://example.com/rootform/dialects",
    };
    if (
      genericPrivate.dialects.some(
        ({ provenance }) =>
          JSON.stringify(provenance) !== JSON.stringify(expectedSyntheticProvenance),
      ) ||
      JSON.stringify(genericPrivate.index?.provenance) !==
        JSON.stringify(expectedSyntheticProvenance)
    ) {
      throw new Error("generic publication provenance differs");
    }
    const privatePublicationLogs = registryLogs(privateRegistry);
    const writtenTags = registryManifestWriteTags(
      privatePublicationLogs
        .split(/\r?\n/u)
        .filter((line) => {
          const timestamp = line.match(/^time="([^"]+)"/u)?.[1];
          return !timestamp || timestamp >= privatePublicationSince;
        })
        .join("\n"),
      "acme/rootform-external",
    ).filter((reference) => !DIGEST.test(reference));
    const expectedWriteOrder = [
      ...genericPrivate.dialects.map(({ tag }) => tag),
      genericPrivate.index?.tag ?? "",
    ];
    if (
      JSON.stringify(writtenTags.slice(-expectedWriteOrder.length)) !==
      JSON.stringify(expectedWriteOrder)
    ) {
      throw new Error("generic publication did not write index last");
    }

    const companyCorePublication = genericPrivate.dialects.find(
      ({ name }) => name === "companycore",
    );
    if (!companyCorePublication) throw new Error("generic publication omitted companycore");
    assertDialectManifest(
      fetchOCIManifest({
        ca,
        oras: options.oras,
        reference: `${privatePushRepository}@${companyCorePublication.manifest_digest}`,
        registryConfig: privateRegistryConfig,
      }),
      "c".repeat(40),
      [registryUsername, registryPassword, privateDockerConfig, privateLayout],
    );

    const genericHelperHome = join(temporary, "generic-helper-publish-home");
    writableDirectory(genericHelperHome);
    const genericHelperResult = publishContainerDialects({
      architecture: "amd64",
      ca,
      dockerConfig: publicationHelper.config,
      helper: {
        binaries: publicationHelper.binaries,
        state: publicationHelper.state,
      },
      home: genericHelperHome,
      image: amdImage,
      includeIndex: true,
      layout: privateLayout,
      network,
      repository: PRIVATE_EXTERNAL_REPOSITORY,
    });
    assertSafeSuccess(genericHelperResult, "generic credential-helper publication", [
      registryUsername,
      registryPassword,
      publicationHelper.config,
      publicationHelper.executable,
      privateLayout,
    ]);
    const genericHelper = parseGenericPublication(
      genericHelperResult.stdout,
      PRIVATE_EXTERNAL_REPOSITORY,
      true,
    );
    if (
      genericHelper.dialects.some(({ status }) => status !== "already_present") ||
      genericHelper.index?.status !== "already_present" ||
      readFileSync(join(publicationHelper.state, "invoked"), "utf8").trim() !==
        "private.rootform.test"
    ) {
      throw new Error("generic credential-helper publication is not idempotent");
    }

    const wrongPublicationPassword = `wrong-${randomBytes(12).toString("hex")}`;
    const wrongPublicationConfig = join(temporary, "wrong-publication-docker-config");
    writeDockerConfiguration(
      wrongPublicationConfig,
      privateDockerConfiguration(
        "private.rootform.test",
        registryUsername,
        wrongPublicationPassword,
      ),
    );
    const wrongPublicationHome = join(temporary, "wrong-publication-home");
    writableDirectory(wrongPublicationHome);
    const wrongPublication = publishContainerDialects({
      architecture: "amd64",
      ca,
      dockerConfig: wrongPublicationConfig,
      home: wrongPublicationHome,
      image: amdImage,
      includeIndex: true,
      layout: privateLayout,
      network,
      repository: PRIVATE_EXTERNAL_REPOSITORY,
    });
    assertSafeFailure(wrongPublication, "generic wrong-credential publication", [
      registryUsername,
      registryPassword,
      wrongPublicationPassword,
      wrongPublicationConfig,
      privateLayout,
    ]);
    if (wrongPublication.exitCode !== 3) {
      throw new Error("generic wrong-credential publication returned unexpected status");
    }

    const conflictPublishHome = join(temporary, "generic-conflict-publish-home");
    writableDirectory(conflictPublishHome);
    const conflictSince = new Date().toISOString();
    Bun.sleepSync(1100);
    const conflictingPublication = publishContainerDialects({
      architecture: "amd64",
      ca,
      dockerConfig: privateDockerConfig,
      home: conflictPublishHome,
      image: amdImage,
      includeIndex: true,
      layout: publicationConflictLayout,
      network,
      repository: PRIVATE_EXTERNAL_REPOSITORY,
    });
    assertSafeFailure(conflictingPublication, "generic immutable-tag conflict", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
      publicationConflictLayout,
    ]);
    if (
      conflictingPublication.exitCode !== 3 ||
      registryManifestWriteTags(
        docker(["logs", "--since", conflictSince, privateRegistry]).stdout,
        "acme/rootform-external",
      ).length !== 0
    ) {
      throw new Error("generic immutable-tag conflict wrote registry content");
    }

    const missingArtifactLayout = join(temporary, "missing-artifact-layout");
    omitDialectRoot(privateLayout, missingArtifactLayout);
    const missingArtifactHome = join(temporary, "missing-artifact-home");
    writableDirectory(missingArtifactHome);
    const missingArtifactPublication = publishContainerDialects({
      architecture: "amd64",
      home: missingArtifactHome,
      image: amdImage,
      includeIndex: true,
      layout: missingArtifactLayout,
      network: "none",
      repository: PRIVATE_EXTERNAL_REPOSITORY,
    });
    assertSafeFailure(missingArtifactPublication, "generic missing-artifact index", [
      missingArtifactLayout,
    ]);
    if (missingArtifactPublication.exitCode !== 3) {
      throw new Error("generic missing-artifact index returned unexpected status");
    }

    publishLayoutTag({
      ca,
      destination: privatePushRepository,
      destinationTag: "dialect-companyofficial-0.1.0",
      layout: bridgeLayout,
      oras: options.oras,
      registryConfig: privateRegistryConfig,
      sourceTag: "dialect-companyofficial-0.1.0",
    });
    const publicCompanyCoreDigest = publishLayoutTag({
      ca,
      destination: publicPushRepository,
      destinationTag: "dialect-companycore-0.1.0",
      layout: privateLayout,
      oras: options.oras,
      sourceTag: "dialect-companycore-0.1.0",
    });
    for (const [repository, layout] of [
      [PRIVATE_INDEX_ONE, privateLayout],
      [PRIVATE_INDEX_TWO, privateLayout],
      [PRIVATE_AMBIGUITY_INDEX, ambiguityLayout],
      [PRIVATE_CONFLICT_INDEX_A, conflictLayoutA],
      [PRIVATE_CONFLICT_INDEX_B, conflictLayoutB],
    ] as const) {
      publishLayoutTag({
        ca,
        destination: `127.0.0.1:${privatePort}/${repository.split("/").slice(1).join("/")}`,
        destinationTag: "stable",
        layout,
        oras: options.oras,
        registryConfig: privateRegistryConfig,
        sourceTag: INDEX_TAG,
      });
    }

    const awsSource = `terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "= 6.62.0" }
  }
}
provider "aws" {}
resource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }
`;
    const awsTerraformLock = `provider "registry.terraform.io/hashicorp/aws" {
  version = "6.62.0"
}
`;
    const project = join(temporary, "project");
    const coldHome = join(temporary, "cold-home");
    writeProject(project, awsSource, awsTerraformLock);
    writableDirectory(coldHome);
    const cold = rootformRun({
      architecture: "arm64",
      arguments: ["init", ".", "--no-input", "--format", "json"],
      ca,
      home: coldHome,
      image: armImage,
      network,
      project,
    });
    parseJson(cold.stdout, "cold init result");
    const lockPath = join(project, "rootform.lock");
    requireRegularFile(lockPath, "cold init rootform.lock");
    requireDirectory(join(coldHome, "dialects", "aws", awsDialectVersion), "installed AWS dialect");
    const lockDigest = sha256(readFileSync(lockPath));
    parseJson(
      rootformRun({
        architecture: "amd64",
        arguments: ["init", ".", "--upgrade", "--no-input", "--format", "json"],
        ca,
        home: coldHome,
        image: amdImage,
        network,
        project,
      }).stdout,
      "official upgrade result",
    );
    if (sha256(readFileSync(lockPath)) !== lockDigest) {
      throw new Error("no-op official upgrade changed rootform.lock");
    }

    const pinnedHome = join(temporary, "pinned-home");
    writableDirectory(pinnedHome);
    const since = new Date().toISOString();
    Bun.sleepSync(1100);
    rootformRun({
      architecture: "amd64",
      arguments: ["init", ".", "--locked", "--no-input", "--format", "json"],
      ca,
      home: pinnedHome,
      image: amdImage,
      network,
      project,
    });
    if (sha256(readFileSync(lockPath)) !== lockDigest)
      throw new Error("--locked changed rootform.lock");
    requireDirectory(join(pinnedHome, "dialects", "aws", awsDialectVersion), "pinned AWS dialect");
    const pinnedRegistryLogs = docker(["logs", "--since", since, publicRegistry]);
    const pinnedLogs = `${pinnedRegistryLogs.stdout}\n${pinnedRegistryLogs.stderr}`;
    if (pinnedLogs.includes(INDEX_TAG) || !pinnedLogs.includes("/manifests/sha256:")) {
      throw new Error("locked empty-store acquisition consulted mutable discovery");
    }

    const baseLock = readFileSync(lockPath, "utf8");
    const officialSource = `${OFFICIAL_DIALECT_REPOSITORY}:${INDEX_TAG}`;
    const publicDirectTag = `${PUBLIC_EXTERNAL_REPOSITORY}:dialect-companycore-0.1.0`;
    const publicDirectDigest = `${PUBLIC_EXTERNAL_REPOSITORY}@${publicCompanyCoreDigest}`;
    const privateDirectTag = `${PRIVATE_EXTERNAL_REPOSITORY}:dialect-companycore-0.1.0`;
    const privateAppTag = `${PRIVATE_EXTERNAL_REPOSITORY}:dialect-companyapp-0.1.0`;
    const privateOfficialTag = `${PRIVATE_EXTERNAL_REPOSITORY}:dialect-companyofficial-0.1.0`;
    const privateIndexOne = `${PRIVATE_INDEX_ONE}:stable`;
    const privateIndexTwo = `${PRIVATE_INDEX_TWO}:stable`;
    const ambiguityIndex = `${PRIVATE_AMBIGUITY_INDEX}:stable`;
    const conflictIndexA = `${PRIVATE_CONFLICT_INDEX_A}:stable`;
    const conflictIndexB = `${PRIVATE_CONFLICT_INDEX_B}:stable`;

    const publicDirectProject = join(temporary, "public-direct-project");
    const publicDirectHome = join(temporary, "public-direct-home");
    writeProject(publicDirectProject, awsSource, awsTerraformLock);
    writableDirectory(publicDirectHome);
    const publicDirectResult = rootformExecute({
      architecture: "amd64",
      arguments: [
        "init",
        ".",
        "--source",
        publicDirectTag,
        "--no-input",
        "--verbose",
        "--format",
        "json",
      ],
      ca,
      home: publicDirectHome,
      image: amdImage,
      network,
      project: publicDirectProject,
    });
    assertSafeSuccess(publicDirectResult, "public direct dialect");
    const publicDirectOutput = parseJson(publicDirectResult.stdout, "public direct result");
    if (
      !Array.isArray(publicDirectOutput.dialects) ||
      !publicDirectOutput.dialects.some((value) => {
        const dialect = jsonObject(value, "public direct result dialect");
        return (
          dialect.name === "companycore" &&
          dialect.version === "0.1.0" &&
          dialect.repository === PUBLIC_EXTERNAL_REPOSITORY &&
          dialect.explicit === true &&
          JSON.stringify(dialect.origins) === JSON.stringify([publicDirectTag])
        );
      })
    ) {
      throw new Error("verbose direct source output lacks exact selection provenance");
    }
    const publicDirectLock = readSourceLock(
      join(publicDirectProject, "rootform.lock"),
      "public direct lock",
      [officialSource, publicDirectTag],
      [temporary],
    );
    const publicDirectEntry = dialectEntry(publicDirectLock, "companycore");
    const publicDirectArtifact = jsonObject(
      publicDirectEntry.artifact,
      "public direct artifact pin",
    );
    if (
      publicDirectArtifact.repository !== PUBLIC_EXTERNAL_REPOSITORY ||
      publicDirectArtifact.manifest_digest !== publicCompanyCoreDigest
    ) {
      throw new Error("public direct artifact was not pinned exactly");
    }

    const digestDirectProject = join(temporary, "digest-direct-project");
    const digestDirectHome = join(temporary, "digest-direct-home");
    writeProject(digestDirectProject, awsSource, awsTerraformLock);
    writableDirectory(digestDirectHome);
    const digestDirectResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--source", publicDirectDigest, "--no-input", "--format", "json"],
      ca,
      home: digestDirectHome,
      image: amdImage,
      network,
      project: digestDirectProject,
    });
    assertSafeSuccess(digestDirectResult, "digest direct dialect");
    const digestDirectLock = readSourceLock(
      join(digestDirectProject, "rootform.lock"),
      "digest direct lock",
      [officialSource, publicDirectDigest],
      [temporary],
    );
    const digestSource = sourcePins(digestDirectLock, "digest direct lock").find(
      (source) => source.reference === publicDirectDigest,
    );
    if (digestSource?.manifest_digest !== publicCompanyCoreDigest) {
      throw new Error("digest source identity was not preserved");
    }

    const privateDirectProject = join(temporary, "private-direct-project");
    const privateDirectHome = join(temporary, "private-direct-home");
    writeProject(privateDirectProject, awsSource, awsTerraformLock);
    writableDirectory(privateDirectHome);
    const privateDirectResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--source", privateDirectTag, "--no-input", "--format", "json"],
      ca,
      dockerConfig: privateDockerConfig,
      home: privateDirectHome,
      image: amdImage,
      network,
      project: privateDirectProject,
    });
    assertSafeSuccess(privateDirectResult, "private direct dialect", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    readSourceLock(
      join(privateDirectProject, "rootform.lock"),
      "private direct lock",
      [officialSource, privateDirectTag],
      [registryUsername, registryPassword, privateDockerConfig, temporary],
    );

    const additionalIndexProject = join(temporary, "additional-index-project");
    const additionalIndexHome = join(temporary, "additional-index-home");
    writeProject(additionalIndexProject, awsSource, awsTerraformLock);
    writableDirectory(additionalIndexHome);
    const additionalIndexResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--source", privateIndexOne, "--no-input", "--format", "json"],
      ca,
      dockerConfig: privateDockerConfig,
      home: additionalIndexHome,
      image: amdImage,
      network,
      project: additionalIndexProject,
    });
    assertSafeSuccess(additionalIndexResult, "additional private index", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    const additionalIndexLock = readSourceLock(
      join(additionalIndexProject, "rootform.lock"),
      "additional private index lock",
      [officialSource, privateIndexOne],
      [registryUsername, registryPassword, privateDockerConfig, temporary],
    );
    if (
      JSON.stringify(dialectEntry(additionalIndexLock, "aws").origins) !== `["${officialSource}"]`
    ) {
      throw new Error("unused private index became artificial entry origin");
    }

    const multipleIndexProject = join(temporary, "multiple-index-project");
    const multipleIndexHome = join(temporary, "multiple-index-home");
    writeProject(
      multipleIndexProject,
      `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "= 2.5.3" }
  }
}
provider "local" {}
resource "local_file" "example" {
  filename = "example.txt"
  content  = "synthetic"
}
`,
      `provider "registry.terraform.io/hashicorp/local" {
  version = "2.5.3"
}
`,
    );
    writableDirectory(multipleIndexHome);
    const multipleIndexResult = rootformExecute({
      architecture: "amd64",
      arguments: [
        "init",
        ".",
        "--source",
        privateIndexOne,
        "--source",
        ambiguityIndex,
        "--no-input",
        "--format",
        "json",
      ],
      ca,
      dockerConfig: privateDockerConfig,
      home: multipleIndexHome,
      image: amdImage,
      network,
      project: multipleIndexProject,
    });
    assertSafeSuccess(multipleIndexResult, "multiple private indexes", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    const multipleIndexLock = readSourceLock(
      join(multipleIndexProject, "rootform.lock"),
      "multiple private index lock",
      [officialSource, privateIndexOne, ambiguityIndex],
      [registryUsername, registryPassword, privateDockerConfig, temporary],
    );
    if (
      JSON.stringify(multipleIndexLock.unsupported_providers) !==
      JSON.stringify(["registry.terraform.io/hashicorp/local"])
    ) {
      throw new Error("multiple indexes fabricated provider coverage");
    }

    const duplicateIndexProject = join(temporary, "duplicate-index-project");
    const duplicateIndexHome = join(temporary, "duplicate-index-home");
    writeProject(duplicateIndexProject, awsSource, awsTerraformLock);
    writableDirectory(duplicateIndexHome);
    const duplicateIndexResult = rootformExecute({
      architecture: "amd64",
      arguments: [
        "init",
        ".",
        "--source",
        privateIndexTwo,
        "--source",
        privateIndexOne,
        "--no-input",
        "--format",
        "json",
      ],
      ca,
      dockerConfig: privateDockerConfig,
      home: duplicateIndexHome,
      image: amdImage,
      network,
      project: duplicateIndexProject,
    });
    assertSafeSuccess(duplicateIndexResult, "duplicate indexes", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    const duplicateIndexLock = readSourceLock(
      join(duplicateIndexProject, "rootform.lock"),
      "duplicate index lock",
      [officialSource, privateIndexOne, privateIndexTwo],
      [registryUsername, registryPassword, privateDockerConfig, temporary],
    );
    const duplicateIndexDigests = sourcePins(duplicateIndexLock, "duplicate index lock")
      .filter(
        (source) => source.reference === privateIndexOne || source.reference === privateIndexTwo,
      )
      .map((source) => source.manifest_digest);
    if (new Set(duplicateIndexDigests).size !== 1) {
      throw new Error("identical indexes did not retain identical manifest identity");
    }

    const conflictProject = join(temporary, "conflict-project");
    const conflictHome = join(temporary, "conflict-home");
    writeProject(conflictProject, awsSource, awsTerraformLock);
    writableDirectory(conflictHome);
    const conflictResult = rootformExecute({
      architecture: "amd64",
      arguments: [
        "init",
        ".",
        "--source",
        conflictIndexA,
        "--source",
        conflictIndexB,
        "--no-input",
        "--format",
        "json",
      ],
      ca,
      dockerConfig: privateDockerConfig,
      home: conflictHome,
      image: amdImage,
      network,
      project: conflictProject,
    });
    assertSafeFailure(conflictResult, "conflicting indexes", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    const conflictOutput = `${conflictResult.stdout}\n${conflictResult.stderr}`;
    if (
      !conflictOutput.includes("shared@0.1.0") ||
      !conflictOutput.includes(conflictIndexA) ||
      !conflictOutput.includes(conflictIndexB) ||
      existsSync(join(conflictProject, "rootform.lock"))
    ) {
      throw new Error("source conflict did not fail closed with bounded identities");
    }

    const ambiguityProject = join(temporary, "ambiguity-project");
    const ambiguityHome = join(temporary, "ambiguity-home");
    writeProject(ambiguityProject, awsSource, awsTerraformLock);
    writableDirectory(ambiguityHome);
    const ambiguityResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--source", ambiguityIndex, "--no-input", "--format", "json"],
      ca,
      dockerConfig: privateDockerConfig,
      home: ambiguityHome,
      image: amdImage,
      network,
      project: ambiguityProject,
    });
    assertSafeFailure(ambiguityResult, "provider ambiguity", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    if (
      !`${ambiguityResult.stdout}\n${ambiguityResult.stderr}`.includes("ambiguous") ||
      existsSync(join(ambiguityProject, "rootform.lock"))
    ) {
      throw new Error("provider ambiguity did not fail closed");
    }

    const officialDependencyProject = join(temporary, "official-dependency-project");
    const officialDependencyHome = join(temporary, "official-dependency-home");
    writeProject(officialDependencyProject, awsSource, awsTerraformLock);
    writableDirectory(officialDependencyHome);
    const officialDependencyResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--source", privateOfficialTag, "--no-input", "--format", "json"],
      ca,
      dockerConfig: privateDockerConfig,
      home: officialDependencyHome,
      image: amdImage,
      network,
      project: officialDependencyProject,
    });
    assertSafeSuccess(officialDependencyResult, "private to official dependency", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    const officialDependencyLock = readSourceLock(
      join(officialDependencyProject, "rootform.lock"),
      "private to official dependency lock",
      [officialSource, privateOfficialTag],
      [registryUsername, registryPassword, privateDockerConfig, temporary],
    );
    dialectEntry(officialDependencyLock, "companyofficial");
    dialectEntry(officialDependencyLock, "core");

    const mixedSourceProject = join(temporary, "mixed-source-project");
    const mixedSourceHome = join(temporary, "mixed-source-home");
    writeProject(mixedSourceProject, awsSource, awsTerraformLock);
    writableDirectory(mixedSourceHome);
    const mixedSourceResult = rootformExecute({
      architecture: "amd64",
      arguments: [
        "init",
        ".",
        "--source",
        privateIndexOne,
        "--source",
        privateAppTag,
        "--no-input",
        "--verbose",
        "--format",
        "json",
      ],
      ca,
      dockerConfig: privateDockerConfig,
      home: mixedSourceHome,
      image: amdImage,
      network,
      project: mixedSourceProject,
    });
    assertSafeSuccess(mixedSourceResult, "mixed source initialization", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    const mixedLockPath = join(mixedSourceProject, "rootform.lock");
    const mixedLock = readSourceLock(
      mixedLockPath,
      "mixed source lock",
      [officialSource, privateIndexOne, privateAppTag],
      [registryUsername, registryPassword, privateDockerConfig, temporary],
    );
    const companyAppOrigins = dialectEntry(mixedLock, "companyapp").origins;
    if (
      JSON.stringify(companyAppOrigins) !==
      JSON.stringify(
        [privateAppTag, privateIndexOne].sort((left, right) => left.localeCompare(right, "en")),
      )
    ) {
      throw new Error("direct and index origins were not deduplicated exactly");
    }
    dialectEntry(mixedLock, "companycore");
    const mixedLockDigest = sha256(readFileSync(mixedLockPath));

    const mixedRecoveredHome = join(temporary, "mixed-recovered-home");
    writableDirectory(mixedRecoveredHome);
    const mixedSince = new Date().toISOString();
    Bun.sleepSync(1100);
    const mixedLockedResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--locked", "--no-input", "--format", "json"],
      ca,
      dockerConfig: privateDockerConfig,
      home: mixedRecoveredHome,
      image: amdImage,
      network,
      project: mixedSourceProject,
    });
    assertSafeSuccess(mixedLockedResult, "mixed locked recovery", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    if (sha256(readFileSync(mixedLockPath)) !== mixedLockDigest) {
      throw new Error("mixed locked recovery failed or changed lock");
    }
    for (const name of ["aws", "core", "companyapp", "companycore"]) {
      requireDirectory(join(mixedRecoveredHome, "dialects", name, "0.1.0"), `mixed ${name}`);
    }
    const mixedPublicLogs = docker(["logs", "--since", mixedSince, publicRegistry]);
    const mixedPrivateLogs = docker(["logs", "--since", mixedSince, privateRegistry]);
    const mixedPublicOutput = `${mixedPublicLogs.stdout}\n${mixedPublicLogs.stderr}`;
    const mixedPrivateOutput = `${mixedPrivateLogs.stdout}\n${mixedPrivateLogs.stderr}`;
    if (
      mixedPublicOutput.includes(INDEX_TAG) ||
      mixedPrivateOutput.includes("/manifests/stable") ||
      mixedPrivateOutput.includes("dialect-companyapp-0.1.0") ||
      !mixedPublicOutput.includes("/manifests/sha256:") ||
      !mixedPrivateOutput.includes("/manifests/sha256:")
    ) {
      throw new Error("mixed locked recovery consulted mutable source or index");
    }

    for (const arguments_ of [
      ["build", ".", "--locked", "--offline", "--no-input", "--format", "json"],
      ["check", ".", "--locked", "--offline", "--no-input", "--format", "json"],
    ]) {
      const result = rootformRun({
        architecture: "amd64",
        arguments: arguments_,
        home: mixedRecoveredHome,
        image: amdImage,
        network: "none",
        project: mixedSourceProject,
        projectReadOnly: true,
      });
      parseJson(result.stdout, `mixed ${arguments_[0]} result`);
    }
    rootformRun({
      architecture: "amd64",
      arguments: ["vendor", "dialects"],
      home: mixedRecoveredHome,
      image: amdImage,
      network: "none",
      project: mixedSourceProject,
    });
    requireRegularFile(
      join(mixedSourceProject, ".rootform", "dialects", "companyapp", "dialect.rf"),
      "vendored private app",
    );
    const mixedVendorHome = join(temporary, "mixed-vendor-home");
    writableDirectory(mixedVendorHome);
    const mixedPublicRequests = registryCompletedRequestCount(registryLogs(publicRegistry));
    const mixedPrivateRequests = registryCompletedRequestCount(registryLogs(privateRegistry));
    parseJson(
      rootformRun({
        architecture: "amd64",
        arguments: ["build", ".", "--locked", "--offline", "--no-input", "--format", "json"],
        home: mixedVendorHome,
        image: amdImage,
        network: "none",
        project: mixedSourceProject,
        projectReadOnly: true,
      }).stdout,
      "mixed vendored offline build",
    );
    if (
      registryCompletedRequestCount(registryLogs(publicRegistry)) !== mixedPublicRequests ||
      registryCompletedRequestCount(registryLogs(privateRegistry)) !== mixedPrivateRequests
    ) {
      throw new Error("mixed vendor contacted registry");
    }

    docker([
      "run",
      "--detach",
      "--name",
      runContainer,
      "--platform",
      "linux/amd64",
      "--network",
      "none",
      "--volume",
      dockerMount(mixedSourceProject, "/workspace", true),
      "--volume",
      dockerMount(mixedVendorHome, "/home/rootform/.rootform", true),
      amdImage,
      "rootform",
      "run",
      ".",
      "--locked",
      "--offline",
      "--no-input",
      "--no-browser",
      "--no-watch",
      "--port",
      "0",
    ]);
    runCreated = true;
    waitForRun(runContainer);
    docker(["kill", "--signal", "INT", runContainer]);
    const mixedRunExit = docker(["wait", runContainer]).stdout.trim();
    if (mixedRunExit !== "0") throw new Error("mixed rootform run did not stop cleanly");
    docker(["rm", runContainer]);
    runCreated = false;

    const privateProject = join(temporary, "private-project");
    cpSync(project, privateProject, { recursive: true });
    const privateLockPath = join(privateProject, "rootform.lock");
    const privateLock = rewriteArtifactPins(baseLock, {
      aws: { repository: PRIVATE_DIALECT_REPOSITORY },
      core: { repository: PRIVATE_DIALECT_REPOSITORY },
    });
    writeFileSync(privateLockPath, privateLock, { mode: 0o644 });
    const privateLockDigest = sha256(readFileSync(privateLockPath));

    const privateHome = join(temporary, "private-home");
    writableDirectory(privateHome);
    const privateResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--locked", "--no-input", "--format", "json"],
      ca,
      dockerConfig: privateDockerConfig,
      home: privateHome,
      image: amdImage,
      network,
      project: privateProject,
    });
    assertSafeOutput(privateResult, "private Basic acquisition", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
      "/run/rootform-docker-config",
    ]);
    if (privateResult.exitCode !== 0) throw new Error("private Basic acquisition failed");
    parseJson(privateResult.stdout, "private Basic acquisition result");
    requireDirectory(
      join(privateHome, "dialects", "aws", awsDialectVersion),
      "private AWS dialect",
    );
    if (sha256(readFileSync(privateLockPath)) !== privateLockDigest) {
      throw new Error("private locked acquisition changed rootform.lock");
    }

    const helperConfig = join(temporary, "helper-docker-config");
    writeDockerConfiguration(helperConfig, {
      credHelpers: { "private.rootform.test": "rootform-test" },
    });
    const helperBinaries = join(temporary, "credential-helpers");
    const helperState = join(temporary, "credential-helper-state");
    mkdirSync(helperBinaries, { mode: 0o755 });
    writableDirectory(helperState);
    const helperPath = join(helperBinaries, "docker-credential-rootform-test");
    writeFileSync(
      helperPath,
      `#!/bin/sh
set -eu
test "\${1:-}" = get
server=$(cat)
printf '%s\\n' "$server" > /run/rootform-helper-state/invoked
test "$server" = private.rootform.test
printf '{"ServerURL":"%s","Username":"%s","Secret":"%s"}\\n' "$server" '${registryUsername}' '${registryPassword}'
`,
      { flag: "wx", mode: 0o755 },
    );
    const helperHome = join(temporary, "helper-home");
    writableDirectory(helperHome);
    const helperResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--locked", "--no-input", "--format", "json"],
      ca,
      dockerConfig: helperConfig,
      helper: { binaries: helperBinaries, state: helperState },
      home: helperHome,
      image: amdImage,
      network,
      project: privateProject,
    });
    assertSafeOutput(helperResult, "credential-helper acquisition", [
      registryUsername,
      registryPassword,
      helperConfig,
      helperPath,
    ]);
    let helperInvocation = "";
    try {
      helperInvocation = readFileSync(join(helperState, "invoked"), "utf8").trim();
    } catch {
      // Report only qualification state; never surface helper paths or output.
    }
    if (helperResult.exitCode !== 0) {
      if (!helperInvocation) throw new Error("configured Docker credential helper was not invoked");
      if (helperInvocation !== "private.rootform.test") {
        throw new Error("Docker credential helper received unexpected registry identity");
      }
      throw new Error("Docker credential-helper identity was rejected");
    }
    if (helperInvocation !== "private.rootform.test") {
      throw new Error("configured Docker credential helper was not invoked");
    }

    const multiProject = join(temporary, "multi-repository-project");
    cpSync(project, multiProject, { recursive: true });
    const multiLockPath = join(multiProject, "rootform.lock");
    writeFileSync(
      multiLockPath,
      rewriteArtifactPins(baseLock, {
        aws: { repository: PRIVATE_DIALECT_REPOSITORY },
      }),
      { mode: 0o644 },
    );
    const multiLockDigest = sha256(readFileSync(multiLockPath));
    const multiHome = join(temporary, "multi-repository-home");
    writableDirectory(multiHome);
    const multiSince = new Date().toISOString();
    Bun.sleepSync(1100);
    const multiResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--locked", "--no-input", "--format", "json"],
      ca,
      dockerConfig: privateDockerConfig,
      home: multiHome,
      image: amdImage,
      network,
      project: multiProject,
    });
    assertSafeOutput(multiResult, "multi-repository acquisition", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    if (multiResult.exitCode !== 0) throw new Error("multi-repository acquisition failed");
    for (const [name, version] of [
      ["aws", awsDialectVersion],
      ["core", coreDialectVersion],
    ] as const) {
      requireDirectory(
        join(multiHome, "dialects", name, version),
        `multi-repository ${name} dialect`,
      );
    }
    const publicMultiLogs = docker(["logs", "--since", multiSince, publicRegistry]);
    const privateMultiLogs = docker(["logs", "--since", multiSince, privateRegistry]);
    const multiLogs = `${publicMultiLogs.stdout}\n${publicMultiLogs.stderr}\n${privateMultiLogs.stdout}\n${privateMultiLogs.stderr}`;
    if (
      multiLogs.includes(INDEX_TAG) ||
      !`${publicMultiLogs.stdout}\n${publicMultiLogs.stderr}`.includes("/manifests/sha256:") ||
      !`${privateMultiLogs.stdout}\n${privateMultiLogs.stderr}`.includes("/manifests/sha256:")
    ) {
      throw new Error("multi-repository lock did not use both exact repositories by digest");
    }
    if (sha256(readFileSync(multiLockPath)) !== multiLockDigest) {
      throw new Error("multi-repository acquisition changed rootform.lock");
    }

    const offlineFailures: CommandResult[] = [];
    for (const name of ["first", "second"]) {
      const home = join(temporary, `cold-offline-${name}`);
      writableDirectory(home);
      const result = rootformExecute({
        architecture: "amd64",
        arguments: ["init", ".", "--locked", "--offline", "--no-input", "--format", "json"],
        home,
        image: amdImage,
        network: "none",
        project: privateProject,
        projectReadOnly: true,
      });
      assertSafeFailure(result, "cold offline acquisition");
      offlineFailures.push(result);
    }
    if (JSON.stringify(offlineFailures[0]) !== JSON.stringify(offlineFailures[1])) {
      throw new Error("cold offline acquisition failure is nondeterministic");
    }

    const wrongDockerConfig = join(temporary, "wrong-docker-config");
    const wrongUsername = `wrong-${randomBytes(6).toString("hex")}`;
    const wrongPassword = randomBytes(24).toString("base64url");
    writeDockerConfiguration(
      wrongDockerConfig,
      privateDockerConfiguration("private.rootform.test", wrongUsername, wrongPassword),
    );
    const missingDockerConfig = join(temporary, "missing-docker-config");
    writeDockerConfiguration(missingDockerConfig, {});
    for (const [name, dockerConfig, forbidden] of [
      [
        "wrong credentials",
        wrongDockerConfig,
        [wrongUsername, wrongPassword, registryUsername, registryPassword, wrongDockerConfig],
      ],
      [
        "missing credentials",
        missingDockerConfig,
        [registryUsername, registryPassword, missingDockerConfig],
      ],
    ] as const) {
      const home = join(temporary, `failure-${name.replace(" ", "-")}`);
      writableDirectory(home);
      const result = rootformExecute({
        architecture: "amd64",
        arguments: ["init", ".", "--locked", "--no-input", "--format", "json"],
        ca,
        dockerConfig,
        home,
        image: amdImage,
        network,
        project: privateProject,
      });
      assertSafeFailure(result, name, [...forbidden]);
    }

    const wrongDigestProject = join(temporary, "wrong-digest-project");
    cpSync(privateProject, wrongDigestProject, { recursive: true });
    const wrongDigestLockPath = join(wrongDigestProject, "rootform.lock");
    writeFileSync(
      wrongDigestLockPath,
      rewriteArtifactPins(privateLock, {
        aws: { manifestDigest: `sha256:${"0".repeat(64)}` },
      }),
      { mode: 0o644 },
    );
    const wrongDigestLock = sha256(readFileSync(wrongDigestLockPath));
    const wrongDigestHome = join(temporary, "wrong-digest-home");
    writableDirectory(wrongDigestHome);
    const wrongDigestResult = rootformExecute({
      architecture: "amd64",
      arguments: ["init", ".", "--locked", "--no-input", "--format", "json"],
      ca,
      dockerConfig: privateDockerConfig,
      home: wrongDigestHome,
      image: amdImage,
      network,
      project: wrongDigestProject,
    });
    assertSafeFailure(wrongDigestResult, "wrong manifest digest", [
      registryUsername,
      registryPassword,
      privateDockerConfig,
    ]);
    if (sha256(readFileSync(wrongDigestLockPath)) !== wrongDigestLock) {
      throw new Error("wrong-digest failure changed rootform.lock");
    }

    for (const architecture of IMAGE_PLATFORMS) {
      const image = tags.get(architecture) as string;
      for (const arguments_ of [
        ["init", ".", "--locked", "--offline", "--no-input", "--format", "json"],
        ["build", ".", "--locked", "--offline", "--no-input", "--format", "json"],
        ["check", ".", "--locked", "--offline", "--no-input", "--format", "json"],
      ]) {
        const result = rootformRun({
          architecture,
          arguments: arguments_,
          home: pinnedHome,
          image,
          network: "none",
          project,
          projectReadOnly: true,
        });
        parseJson(result.stdout, `offline ${arguments_[0]} result`);
      }
    }
    if (sha256(readFileSync(lockPath)) !== lockDigest) throw new Error("offline run changed lock");

    docker([
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      amdImage,
      "sh",
      "-eu",
      "-c",
      `test "$(id -u):$(id -g)" = 65532:65532
test "$HOME" = /home/rootform
test "$ROOTFORM_HOME" = /home/rootform/.rootform
test -w /workspace
test -w "$ROOTFORM_HOME"
command -v sh >/dev/null
command -v grep >/dev/null
test -s /etc/ssl/cert.pem || test -s /etc/ssl/certs/ca-certificates.crt
for forbidden in wget curl git terraform tofu gcc go; do ! command -v "$forbidden" >/dev/null 2>&1; done
test -f /usr/local/share/rootform/ROOTFORM-BINARY-LICENSE.txt
test -f /usr/local/share/rootform/THIRD_PARTY_NOTICES.txt
test -f /usr/local/share/rootform/rootform_${options.version}_sbom.spdx.json
test "$(find /usr/local/share/rootform -type f | wc -l)" -eq 3`,
    ]);

    const arbitraryHome = join(temporary, "arbitrary-home");
    writableDirectory(arbitraryHome);
    rootformRun({
      architecture: "arm64",
      arguments: ["init", ".", "--locked", "--no-input", "--format", "json"],
      ca,
      home: arbitraryHome,
      image: armImage,
      network,
      project,
      user: "12345:23456",
    });
    requireDirectory(
      join(arbitraryHome, "dialects", "aws", awsDialectVersion),
      "arbitrary UID dialect store",
    );

    rootformRun({
      architecture: "arm64",
      arguments: ["vendor", "dialects"],
      home: pinnedHome,
      image: armImage,
      network: "none",
      project,
    });
    requireRegularFile(join(project, ".rootform", "dialects", "core", "dialect.rf"), "vendor core");
    const emptyHome = join(temporary, "empty-home");
    writableDirectory(emptyHome);
    const vendorPublicRequests = registryCompletedRequestCount(registryLogs(publicRegistry));
    const vendorPrivateRequests = registryCompletedRequestCount(registryLogs(privateRegistry));
    parseJson(
      rootformRun({
        architecture: "amd64",
        arguments: ["build", ".", "--locked", "--no-input", "--format", "json"],
        ca,
        home: emptyHome,
        image: amdImage,
        network,
        project,
        projectReadOnly: true,
      }).stdout,
      "vendored online-capable build result",
    );
    if (
      registryCompletedRequestCount(registryLogs(publicRegistry)) !== vendorPublicRequests ||
      registryCompletedRequestCount(registryLogs(privateRegistry)) !== vendorPrivateRequests
    ) {
      throw new Error("complete vendor content contacted a registry");
    }
    parseJson(
      rootformRun({
        architecture: "amd64",
        arguments: ["build", ".", "--locked", "--offline", "--no-input", "--format", "json"],
        home: emptyHome,
        image: amdImage,
        network: "none",
        project,
        projectReadOnly: true,
      }).stdout,
      "vendored offline build result",
    );
    const brokenProject = join(temporary, "broken-project");
    cpSync(project, brokenProject, { recursive: true });
    rmSync(join(brokenProject, ".rootform", "dialects", "core", "dialect.rf"));
    const broken = execute([
      "docker",
      "run",
      "--rm",
      "--platform",
      "linux/arm64",
      "--network",
      "none",
      "--volume",
      dockerMount(brokenProject, "/workspace", true),
      "--volume",
      dockerMount(pinnedHome, "/home/rootform/.rootform", true),
      armImage,
      "rootform",
      "build",
      ".",
      "--locked",
      "--offline",
      "--no-input",
      "--format",
      "json",
    ]);
    if (broken.exitCode !== 3 || !broken.stderr.includes("vendored dialect set")) {
      throw new Error("incomplete vendor fell back outside project");
    }

    const unsupportedProject = join(temporary, "unsupported-project");
    const unsupportedHome = join(temporary, "unsupported-home");
    writeProject(
      unsupportedProject,
      `terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "= 2.5.3" }
  }
}
provider "local" {}
resource "local_file" "example" {
  filename = "example.txt"
  content  = "synthetic"
}
`,
      `provider "registry.terraform.io/hashicorp/local" {
  version = "2.5.3"
}
`,
    );
    writableDirectory(unsupportedHome);
    const unsupported = parseJson(
      rootformRun({
        architecture: "arm64",
        arguments: ["init", ".", "--no-input", "--format", "json"],
        ca,
        home: unsupportedHome,
        image: armImage,
        network,
        project: unsupportedProject,
      }).stdout,
      "unsupported provider result",
    );
    if (
      JSON.stringify(unsupported.unsupported_providers) !==
      JSON.stringify(["registry.terraform.io/hashicorp/local"])
    ) {
      throw new Error("provider without dialect is not explicit");
    }

    const hardened = docker([
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--network",
      "none",
      "--tmpfs",
      "/home/rootform/.rootform:uid=65532,gid=65532,mode=0700",
      "--volume",
      dockerMount(project, "/workspace", true),
      amdImage,
      "rootform",
      "build",
      ".",
      "--locked",
      "--offline",
      "--no-input",
      "--format",
      "json",
    ]);
    parseJson(hardened.stdout, "read-only hardened build result");

    docker([
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      "--network",
      "none",
      "--volume",
      dockerMount(project, "/workspace", true),
      "--volume",
      dockerMount(pinnedHome, "/home/rootform/.rootform", true),
      amdImage,
      "/bin/sh",
      "-eu",
      "-c",
      "rootform init . --locked --offline --no-input >/dev/null; rootform build . --locked --offline --no-input --format json >/tmp/architecture.json; rootform check /tmp/architecture.json --format json >/tmp/check.json; grep -q '\"format_version\"' /tmp/architecture.json; grep -q '\"format_version\"' /tmp/check.json",
    ]);

    docker([
      "run",
      "--detach",
      "--name",
      runContainer,
      "--platform",
      "linux/arm64",
      "--network",
      "none",
      "--volume",
      dockerMount(project, "/workspace", true),
      "--volume",
      dockerMount(pinnedHome, "/home/rootform/.rootform", true),
      armImage,
      "rootform",
      "run",
      ".",
      "--locked",
      "--offline",
      "--no-input",
      "--no-browser",
      "--no-watch",
      "--port",
      "0",
    ]);
    runCreated = true;
    waitForRun(runContainer);
    docker(["kill", "--signal", "INT", runContainer]);
    const runExit = docker(["wait", runContainer]).stdout.trim();
    if (runExit !== "0") throw new Error("rootform run did not stop cleanly");
    docker(["rm", runContainer]);
    runCreated = false;

    const reports: Record<string, { high_critical: number; medium_low: number }> = {};
    for (const [position, architecture] of IMAGE_PLATFORMS.entries()) {
      const high = join(dirname(options.evidence), `trivy-${architecture}-high-critical.json`);
      const low = join(dirname(options.evidence), `trivy-${architecture}-medium-low.json`);
      const common = [
        "image",
        ...(position === 0 ? [] : ["--skip-db-update"]),
        "--scanners",
        "vuln",
        "--ignorefile",
        join(options.root, ".trivyignore.yaml"),
      ];
      run([
        options.trivy,
        ...common,
        "--severity",
        "HIGH,CRITICAL",
        "--exit-code",
        "1",
        "--format",
        "json",
        "--output",
        high,
        tags.get(architecture) as string,
      ]);
      run([
        options.trivy,
        "image",
        "--skip-db-update",
        "--scanners",
        "vuln",
        "--ignorefile",
        join(options.root, ".trivyignore.yaml"),
        "--severity",
        "MEDIUM,LOW",
        "--exit-code",
        "0",
        "--format",
        "json",
        "--output",
        low,
        tags.get(architecture) as string,
      ]);
      reports[architecture] = {
        high_critical: vulnerabilityCount(high),
        medium_low: vulnerabilityCount(low),
      };
      if (reports[architecture]?.high_critical !== 0) {
        throw new Error(`Trivy left blocking findings for ${architecture}`);
      }
    }
    const trivyVersion = run([options.trivy, "--version"])
      .stdout.split(/\r?\n/u)[0]
      ?.replace(/^Version:\s*/u, "")
      .trim();
    if (!trivyVersion) throw new Error("Trivy version is unavailable");

    const podman = qualifyPodman(archive, options.version);
    const binary = imageManifest.binary as
      | { platforms?: Array<{ proof?: string; sha256?: string }> }
      | undefined;
    if (
      !Array.isArray(binary?.platforms) ||
      binary.platforms.length !== 2 ||
      binary.platforms.some(
        ({ proof, sha256: digest }) =>
          proof !== "release-archive-byte-identity" || !/^[0-9a-f]{64}$/u.test(digest ?? ""),
      )
    ) {
      throw new Error("image manifest has no archive byte-identity proof");
    }
    const evidence = {
      binary_parity: binary.platforms,
      cve: { reports, trivy_version: trivyVersion },
      dialects: {
        artifacts: publication.artifacts.length,
        authentication: ["anonymous", "docker-auth", "docker-credential-helper"],
        external_sources: sourcePins(mixedLock, "mixed source evidence"),
        generic_publication: {
          dialects: genericPrivate.dialects.map(({ manifest_digest, name, tag, version }) => ({
            manifest_digest,
            name,
            tag,
            version,
          })),
          index_manifest_digest: genericPrivate.index?.manifest_digest,
          index_tag: genericPrivate.index?.tag,
          provenance: expectedSyntheticProvenance,
          repository: PRIVATE_EXTERNAL_REPOSITORY,
        },
        index_manifest_digest: publication.index.manifest_digest,
        publisher_parity: {
          dialects: officialDialectDigests,
          official_discovery_preserved: true,
        },
        repositories: [
          OFFICIAL_DIALECT_REPOSITORY,
          PRIVATE_DIALECT_REPOSITORY,
          PUBLIC_EXTERNAL_REPOSITORY,
          PRIVATE_EXTERNAL_REPOSITORY,
          PRIVATE_INDEX_ONE,
          PRIVATE_INDEX_TWO,
          PRIVATE_AMBIGUITY_INDEX,
          PRIVATE_CONFLICT_INDEX_A,
          PRIVATE_CONFLICT_INDEX_B,
        ],
        tls: true,
      },
      format_version: "1",
      platforms: IMAGE_PLATFORMS.map((architecture) => `linux/${architecture}`),
      podman,
      scenarios: {
        arbitrary_uid_with_writable_mounts: true,
        cold_init_build_check_run: true,
        cold_offline_failure_deterministic: true,
        credential_failures_sanitized: true,
        credential_helper_invoked: true,
        default_non_root: "65532:65532",
        direct_digest_source: true,
        direct_private_source: true,
        direct_public_source: true,
        duplicate_indexes_deduplicated: true,
        external_source_conflict_rejected: true,
        generic_publish_credential_helper: true,
        generic_publish_custom_media_types: true,
        generic_publish_dry_run_offline: true,
        generic_publish_idempotent: true,
        generic_publish_immutable_conflict_rejected_before_write: true,
        generic_publish_index_last: true,
        generic_publish_missing_artifact_rejected: true,
        generic_publish_private_tls: true,
        generic_publish_provenance: true,
        generic_publish_wrong_credentials_sanitized: true,
        generic_vs_official_publisher_parity: true,
        gitlab_shell_injection: true,
        mixed_build_check_run: true,
        mixed_locked_pin_only: true,
        mixed_vendor_offline: true,
        locked_direct_pins_without_index: true,
        multiple_additional_indexes: true,
        multi_repository_lock: true,
        offline_network_none: true,
        one_additional_private_index: true,
        private_basic_registry: true,
        private_to_official_dependency: true,
        private_to_private_dependency: true,
        provider_ambiguity_rejected: true,
        read_only_cap_drop_no_new_privileges: true,
        unsupported_provider_explicit: true,
        vendor_exclusive: true,
        vendor_registry_requests: 0,
        workspace_read_only: true,
        wrong_manifest_digest_rejected: true,
      },
      version: options.version,
    };
    writeFileSync(options.evidence, `${JSON.stringify(evidence, null, 2)}\n`, {
      flag: "wx",
      mode: 0o644,
    });
  } finally {
    if (runCreated) execute(["docker", "rm", "--force", runContainer]);
    if (privateRegistryCreated) execute(["docker", "rm", "--force", privateRegistry]);
    if (publicRegistryCreated) execute(["docker", "rm", "--force", publicRegistry]);
    if (networkCreated) execute(["docker", "network", "rm", network]);
    removeTemporary(temporary, tags.get("arm64"));
    for (const tag of tags.values()) execute(["docker", "image", "rm", "--force", tag]);
  }
}

if (import.meta.main) {
  try {
    const options = parseQualificationArguments(process.argv.slice(2));
    qualifyImage({ ...options, root: join(import.meta.dir, "..") });
    console.log("Rootform image runtime qualification passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
