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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const REPOSITORY =
  /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::[1-9][0-9]{0,4})?\/[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/u;
const DIALECT_NAME = "registry-compat";
const DIALECT_VERSION = "0.1.0";
const POLICY_PACK_NAME = "registry-compat-policies";
const POLICY_PACK_VERSION = "0.1.0";
const PROVIDER_SOURCE = "registry.terraform.io/examplecorp/portable";
const PROVIDER_VERSION = "0.1.0";

type Options = {
  caFile?: string;
  credentialProof?: string;
  documentationURL: string;
  evidence: string;
  licenses: string;
  repository: string;
  revision: string;
  root: string;
  rootformBinary: string;
  sourceURL: string;
};

type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

type Provenance = {
  documentation: string;
  licenses: string;
  revision: string;
  source: string;
};

type PublicationEntry = {
  manifest_digest: string;
  manifest_size: number;
  name: string;
  provenance: Provenance;
  repository: string;
  size: number;
  status: "already_present" | "planned" | "published";
  tag: string;
  version: string;
};

type Publication = {
  dialects: PublicationEntry[];
  dry_run: boolean;
  format_version: "1";
  index: Omit<PublicationEntry, "name" | "version">;
  repository: string;
};

type PolicyPackPublication = {
  dry_run: boolean;
  format_version: "1";
  policy_packs: PublicationEntry[];
  repository: string;
};

type ArtifactEvidence = {
  layerDigest: string;
  manifestDigest: string;
  presentationDigest: string;
  semanticDigest: string;
};

type PolicyPackArtifactEvidence = {
  layerDigest: string;
  manifestDigest: string;
  packDigest: string;
};

type JsonObject = Record<string, unknown>;

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function parseJSON(body: string, label: string): JsonObject {
  try {
    return object(JSON.parse(body), label);
  } catch {
    throw new Error(`${label} is invalid JSON`);
  }
}

function parseJSONValue(body: string, label: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${label} is invalid JSON`);
  }
}

function canonicalHTTPS(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a canonical HTTPS URL`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.toString() !== value
  ) {
    throw new Error(`${label} must be a canonical HTTPS URL`);
  }
  return value;
}

function regularFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink() || status.size < 1) {
    throw new Error(`${label} must be a non-empty regular file`);
  }
}

export function parseRegistryQualificationArguments(
  values: string[],
  cwd = process.cwd(),
): Options {
  const required = [
    "documentation-url",
    "evidence",
    "licenses",
    "repository",
    "revision",
    "rootform-bin",
    "source-url",
  ] as const;
  const optional = ["ca-file", "credential-proof"] as const;
  const known = [...required, ...optional];
  const parsed = new Map<string, string>();
  for (let index = 0; index < values.length; index++) {
    const argument = values[index] ?? "";
    const name = known.find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown registry qualification argument: ${argument}`);
    if (parsed.has(name)) throw new Error(`duplicate registry qualification argument: --${name}`);
    const value = argument.startsWith(`--${name}=`)
      ? argument.slice(name.length + 3)
      : values[++index];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    parsed.set(name, value);
  }
  for (const name of required) {
    if (!parsed.has(name)) throw new Error(`--${name} is required`);
  }
  const repository = parsed.get("repository") as string;
  const revision = parsed.get("revision") as string;
  const licenses = parsed.get("licenses") as string;
  if (!REPOSITORY.test(repository) || repository.includes("@") || repository.includes("://")) {
    throw new Error("--repository must be one canonical tagless OCI repository");
  }
  if (!/^[0-9a-f]{40}$/u.test(revision)) {
    throw new Error("--revision must be one exact Git commit");
  }
  if (!/^[A-Za-z0-9.+\-() ]{1,128}$/u.test(licenses)) {
    throw new Error("--licenses must be one bounded SPDX expression");
  }
  const options: Options = {
    documentationURL: canonicalHTTPS(
      parsed.get("documentation-url") as string,
      "--documentation-url",
    ),
    evidence: absolute(parsed.get("evidence") as string, cwd),
    licenses,
    repository,
    revision,
    root: resolve(import.meta.dir, ".."),
    rootformBinary: absolute(parsed.get("rootform-bin") as string, cwd),
    sourceURL: canonicalHTTPS(parsed.get("source-url") as string, "--source-url"),
  };
  const caFile = parsed.get("ca-file");
  const credentialProof = parsed.get("credential-proof");
  if (caFile) options.caFile = absolute(caFile, cwd);
  if (credentialProof) options.credentialProof = absolute(credentialProof, cwd);
  return options;
}

function sha256(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function execute(
  command: string[],
  options: { cwd?: string; env?: Record<string, string | undefined> } = {},
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

function assertSafeOutput(result: CommandResult, label: string, forbidden: string[]): void {
  const output = `${result.stdout}\n${result.stderr}`;
  if (Buffer.byteLength(output) > 128 * 1024) throw new Error(`${label} output is unbounded`);
  if (/authorization\s*[:=]/iu.test(output)) {
    throw new Error(`${label} exposed an Authorization header`);
  }
  for (const value of forbidden) {
    if (value && output.includes(value)) throw new Error(`${label} exposed local or secret input`);
  }
}

function run(
  command: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    forbidden: string[];
    label: string;
  },
): CommandResult {
  const result = execute(command, options);
  assertSafeOutput(result, options.label, options.forbidden);
  if (result.exitCode !== 0) {
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
    if (detail) process.stderr.write(`${detail}\n`);
    throw new Error(`${options.label} failed`);
  }
  return result;
}

function expectFailure(
  command: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    forbidden: string[];
    label: string;
  },
): CommandResult {
  const result = execute(command, options);
  assertSafeOutput(result, options.label, options.forbidden);
  if (result.exitCode === 0) throw new Error(`${options.label} unexpectedly succeeded`);
  return result;
}

function baseEnvironment(options: Options, home: string): Record<string, string | undefined> {
  return {
    ROOTFORM_HOME: home,
    ROOTFORM_INPUT: "0",
    ...(options.caFile ? { SSL_CERT_FILE: options.caFile } : {}),
  };
}

function forbiddenValues(options: Options, temporary: string): string[] {
  return [
    temporary,
    options.evidence,
    options.caFile ?? "",
    options.credentialProof ?? "",
    process.env.DOCKER_CONFIG ?? "",
    process.env.ROOTFORM_REGISTRY_PASSWORD ?? "",
    process.env.ROOTFORM_REGISTRY_USERNAME ?? "",
  ];
}

function writeFixture(root: string, repositoryRoot: string): void {
  const source = join(root, "source");
  const dialect = join(source, DIALECT_NAME);
  mkdirSync(dialect, { recursive: true, mode: 0o755 });
  writeFileSync(
    join(dialect, "dialect.rf"),
    `dialect "${DIALECT_NAME}" {
  version = "${DIALECT_VERSION}"
  provider "examplecorp/portable" { version = "= ${PROVIDER_VERSION}" }
}

concept "portable-service" {
  kind        = entity
  description = "A portable service used only by registry qualification."
}
`,
    { flag: "wx", mode: 0o644 },
  );
  writeFileSync(
    join(dialect, "presentation.json"),
    '{"format_version":"1","rules":{},"concepts":{},"rule_labels":{},"concept_labels":{}}\n',
    { flag: "wx", mode: 0o644 },
  );
  cpSync(join(repositoryRoot, "LICENSE"), join(source, "LICENSE"), {
    errorOnExist: true,
    force: false,
  });
  writeFileSync(
    join(source, "NOTICE"),
    "Rootform registry compatibility fixture. Not a production dialect.\n",
    { flag: "wx", mode: 0o644 },
  );

  const policyPack = join(root, "policy-source");
  mkdirSync(policyPack, { recursive: true, mode: 0o755 });
  writeFileSync(
    join(policyPack, "pack.rf"),
    `policy_pack "${POLICY_PACK_NAME}" {
  version = "${POLICY_PACK_VERSION}"

  requires {
    ${DIALECT_NAME} = "${DIALECT_VERSION}"
  }

  policy "portable-service-links" {
    target = concept.${DIALECT_NAME}.portable-service

    assert = length(relations("portable-link", concept.${DIALECT_NAME}.portable-service)) >= 0

    message = "Portable services expose deterministic relation evidence."
  }
}
`,
    { flag: "wx", mode: 0o644 },
  );
  cpSync(join(repositoryRoot, "LICENSE"), join(policyPack, "LICENSE"), {
    errorOnExist: true,
    force: false,
  });
  writeFileSync(
    join(policyPack, "NOTICE"),
    "Rootform registry compatibility fixture. Not a production Policy Pack.\n",
    { flag: "wx", mode: 0o644 },
  );
}

function writeProject(root: string): void {
  mkdirSync(root, { recursive: true, mode: 0o755 });
  writeFileSync(
    join(root, "main.tf"),
    `terraform {
  required_providers {
    portable = {
      source  = "examplecorp/portable"
      version = "= ${PROVIDER_VERSION}"
    }
  }
}

provider "portable" {}
`,
    { flag: "wx", mode: 0o644 },
  );
  writeFileSync(
    join(root, ".terraform.lock.hcl"),
    `provider "${PROVIDER_SOURCE}" {
  version     = "${PROVIDER_VERSION}"
  constraints = "= ${PROVIDER_VERSION}"
}
`,
    { flag: "wx", mode: 0o644 },
  );
}

function publicationOf(body: string, options: Options, dryRun: boolean): Publication {
  const value = parseJSON(body, "publication result");
  if (
    value.format_version !== "1" ||
    value.repository !== options.repository ||
    value.dry_run !== dryRun ||
    !Array.isArray(value.dialects) ||
    value.dialects.length !== 1
  ) {
    throw new Error("publication result identity is invalid");
  }
  const expectedProvenance: Provenance = {
    documentation: options.documentationURL,
    licenses: options.licenses,
    revision: options.revision,
    source: options.sourceURL,
  };
  const parseEntry = (
    candidate: unknown,
    expected: { name?: string; tag: RegExp; version?: string },
  ): PublicationEntry => {
    const entry = object(candidate, "publication entry");
    const provenance = object(entry.provenance, "publication provenance");
    if (
      (expected.name !== undefined && entry.name !== expected.name) ||
      (expected.name === undefined && entry.name !== undefined) ||
      (expected.version !== undefined && entry.version !== expected.version) ||
      (expected.version === undefined && entry.version !== undefined) ||
      entry.repository !== options.repository ||
      typeof entry.tag !== "string" ||
      !expected.tag.test(entry.tag) ||
      !DIGEST.test(String(entry.manifest_digest ?? "")) ||
      !Number.isSafeInteger(entry.manifest_size) ||
      Number(entry.manifest_size) < 1 ||
      !Number.isSafeInteger(entry.size) ||
      Number(entry.size) < 1 ||
      !["already_present", "planned", "published"].includes(String(entry.status)) ||
      provenance.source !== expectedProvenance.source ||
      provenance.revision !== expectedProvenance.revision ||
      provenance.documentation !== expectedProvenance.documentation ||
      provenance.licenses !== expectedProvenance.licenses ||
      Object.keys(provenance).length !== 4
    ) {
      throw new Error("publication entry is invalid");
    }
    return entry as unknown as PublicationEntry;
  };
  const dialect = parseEntry(value.dialects[0], {
    name: DIALECT_NAME,
    tag: /^dialect-registry-compat-0\.1\.0$/u,
    version: DIALECT_VERSION,
  });
  const index = parseEntry(value.index, {
    tag: /^index-sha256-[0-9a-f]{64}$/u,
  });
  if (dryRun) {
    if (dialect.status !== "planned" || index.status !== "planned") {
      throw new Error("dry-run publication was not purely planned");
    }
  } else if (dialect.status === "planned" || index.status === "planned") {
    throw new Error("live publication remained planned");
  }
  return {
    dialects: [dialect],
    dry_run: dryRun,
    format_version: "1",
    index: index as Omit<PublicationEntry, "name" | "version">,
    repository: options.repository,
  };
}

function policyPackPublicationOf(
  body: string,
  options: Options,
  dryRun: boolean,
): PolicyPackPublication {
  const value = parseJSON(body, "Policy Pack publication result");
  if (
    value.format_version !== "1" ||
    value.repository !== options.repository ||
    value.dry_run !== dryRun ||
    value.index !== undefined ||
    !Array.isArray(value.policy_packs) ||
    value.policy_packs.length !== 1
  ) {
    throw new Error("Policy Pack publication result identity is invalid");
  }
  const entry = object(value.policy_packs[0], "Policy Pack publication entry");
  const provenance = object(entry.provenance, "Policy Pack publication provenance");
  if (
    entry.name !== POLICY_PACK_NAME ||
    entry.version !== POLICY_PACK_VERSION ||
    entry.repository !== options.repository ||
    entry.tag !== `policy-pack-${POLICY_PACK_NAME}-${POLICY_PACK_VERSION}` ||
    !DIGEST.test(String(entry.manifest_digest ?? "")) ||
    !Number.isSafeInteger(entry.manifest_size) ||
    Number(entry.manifest_size) < 1 ||
    !Number.isSafeInteger(entry.size) ||
    Number(entry.size) < 1 ||
    !["already_present", "planned", "published"].includes(String(entry.status)) ||
    provenance.source !== options.sourceURL ||
    provenance.revision !== options.revision ||
    provenance.documentation !== options.documentationURL ||
    provenance.licenses !== options.licenses ||
    Object.keys(provenance).length !== 4
  ) {
    throw new Error("Policy Pack publication entry is invalid");
  }
  const parsed = entry as unknown as PublicationEntry;
  if ((dryRun && parsed.status !== "planned") || (!dryRun && parsed.status === "planned")) {
    throw new Error("Policy Pack publication status is invalid");
  }
  return {
    dry_run: dryRun,
    format_version: "1",
    policy_packs: [parsed],
    repository: options.repository,
  };
}

function lockEvidence(
  path: string,
  sourceReference: string,
  publication: Publication,
  forbidden: string[],
): ArtifactEvidence {
  const encoded = readFileSync(path, "utf8");
  const lowered = encoded.toLowerCase();
  for (const word of ["authorization", "credential", "password", "username", "docker_config"]) {
    if (lowered.includes(word)) throw new Error("rootform.lock contains credential material");
  }
  for (const value of forbidden) {
    if (value && encoded.includes(value)) throw new Error("rootform.lock contains local input");
  }
  const lock = parseJSON(encoded, "rootform.lock");
  if (lock.format_version !== "1" || !Array.isArray(lock.entries)) {
    throw new Error("rootform.lock format is invalid");
  }
  const entries = lock.entries.map((value) => object(value, "rootform.lock entry"));
  const entry = entries.find((value) => value.name === DIALECT_NAME);
  if (!entry || entry.version !== DIALECT_VERSION || entries.length !== 1) {
    throw new Error("rootform.lock selected dialect set is invalid");
  }
  const artifact = object(entry.artifact, "rootform.lock artifact pin");
  const published = publication.dialects[0] as PublicationEntry;
  if (
    artifact.repository !== publication.repository ||
    artifact.manifest_digest !== published.manifest_digest ||
    !DIGEST.test(String(artifact.layer_digest ?? "")) ||
    !DIGEST.test(String(entry.digest ?? "")) ||
    !DIGEST.test(String(entry.presentation_digest ?? "")) ||
    !Array.isArray(entry.origins) ||
    !entry.origins.includes(sourceReference) ||
    !Array.isArray(lock.sources) ||
    !lock.sources
      .map((value) => object(value, "rootform.lock source"))
      .some(
        (source) =>
          source.reference === sourceReference &&
          source.manifest_digest ===
            (sourceReference.includes(":index-sha256-")
              ? publication.index.manifest_digest
              : published.manifest_digest),
      )
  ) {
    throw new Error("rootform.lock source or artifact evidence differs");
  }
  return {
    layerDigest: String(artifact.layer_digest),
    manifestDigest: String(artifact.manifest_digest),
    presentationDigest: String(entry.presentation_digest),
    semanticDigest: String(entry.digest),
  };
}

function policyPackLockEvidence(
  path: string,
  sourceReference: string,
  publication: PolicyPackPublication,
  forbidden: string[],
): PolicyPackArtifactEvidence {
  const encoded = readFileSync(path, "utf8");
  const lowered = encoded.toLowerCase();
  for (const word of ["authorization", "credential", "password", "username", "docker_config"]) {
    if (lowered.includes(word)) throw new Error("rootform.lock contains credential material");
  }
  for (const value of forbidden) {
    if (value && encoded.includes(value)) throw new Error("rootform.lock contains local input");
  }
  const lock = parseJSON(encoded, "rootform.lock");
  if (lock.format_version !== "1" || !Array.isArray(lock.policy_packs)) {
    throw new Error("rootform.lock Policy Pack section is invalid");
  }
  const entries = lock.policy_packs.map((value) => object(value, "rootform.lock Policy Pack"));
  const entry = entries.find((value) => value.name === POLICY_PACK_NAME);
  if (!entry || entry.version !== POLICY_PACK_VERSION || entries.length !== 1) {
    throw new Error("rootform.lock selected Policy Pack set is invalid");
  }
  const artifact = object(entry.artifact, "rootform.lock Policy Pack artifact pin");
  const published = publication.policy_packs[0] as PublicationEntry;
  if (
    artifact.repository !== publication.repository ||
    artifact.manifest_digest !== published.manifest_digest ||
    !DIGEST.test(String(artifact.layer_digest ?? "")) ||
    !DIGEST.test(String(entry.digest ?? "")) ||
    !Array.isArray(entry.origins) ||
    !entry.origins.includes(sourceReference) ||
    !Array.isArray(lock.sources) ||
    !lock.sources
      .map((value) => object(value, "rootform.lock source"))
      .some(
        (source) =>
          source.kind === "policy-pack" &&
          source.reference === sourceReference &&
          source.manifest_digest === published.manifest_digest,
      )
  ) {
    throw new Error("rootform.lock Policy Pack source or artifact evidence differs");
  }
  return {
    layerDigest: String(artifact.layer_digest),
    manifestDigest: String(artifact.manifest_digest),
    packDigest: String(entry.digest),
  };
}

function validateInspection(
  body: string,
  publication: Publication,
  artifact: ArtifactEvidence,
  options: Options,
  source: "store" | "vendor",
): void {
  const value = parseJSON(body, "dialect inspection");
  if (
    value.name !== DIALECT_NAME ||
    value.version !== DIALECT_VERSION ||
    value.execution_source !== source ||
    value.repository !== publication.repository ||
    value.manifest_digest !== artifact.manifestDigest ||
    value.layer_digest !== artifact.layerDigest ||
    value.semantic_digest !== artifact.semanticDigest ||
    value.presentation_digest !== artifact.presentationDigest
  ) {
    throw new Error("dialect inspection evidence differs");
  }
  if (source === "store") {
    const provenance = object(value.provenance, "dialect inspection provenance");
    if (
      provenance.source !== options.sourceURL ||
      provenance.revision !== options.revision ||
      provenance.documentation !== options.documentationURL ||
      provenance.licenses !== options.licenses
    ) {
      throw new Error("dialect inspection provenance differs");
    }
  }
}

function validatePolicyPackInspection(
  body: string,
  publication: PolicyPackPublication,
  artifact: PolicyPackArtifactEvidence,
  options: Options,
  source: "store" | "vendor",
): void {
  const value = parseJSON(body, "Policy Pack inspection");
  if (
    value.name !== POLICY_PACK_NAME ||
    value.version !== POLICY_PACK_VERSION ||
    value.execution_source !== source ||
    value.repository !== publication.repository ||
    value.manifest_digest !== artifact.manifestDigest ||
    value.layer_digest !== artifact.layerDigest ||
    value.pack_digest !== artifact.packDigest
  ) {
    throw new Error("Policy Pack inspection evidence differs");
  }
  if (source === "store") {
    const provenance = object(value.provenance, "Policy Pack inspection provenance");
    if (
      provenance.source !== options.sourceURL ||
      provenance.revision !== options.revision ||
      provenance.documentation !== options.documentationURL ||
      provenance.licenses !== options.licenses
    ) {
      throw new Error("Policy Pack inspection provenance differs");
    }
  }
}

function hasFiles(path: string): boolean {
  if (!existsSync(path)) return false;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isFile()) return true;
    if (entry.isDirectory() && hasFiles(join(path, entry.name))) return true;
  }
  return false;
}

function copyProject(source: string, destination: string): void {
  cpSync(source, destination, { recursive: true });
  rmSync(join(destination, ".rootform"), { force: true, recursive: true });
}

export function qualifyRegistry(options: Options): void {
  regularFile(options.rootformBinary, "Rootform executable");
  regularFile(join(options.root, "LICENSE"), "repository license");
  if (options.caFile) regularFile(options.caFile, "registry CA");
  if (existsSync(options.evidence)) throw new Error("registry evidence already exists");
  if (options.credentialProof && existsSync(options.credentialProof)) {
    throw new Error("credential-helper proof must not exist before qualification");
  }
  mkdirSync(dirname(options.evidence), { recursive: true });

  const temporary = mkdtempSync(join(tmpdir(), "rootform-registry-qualification-"));
  const forbidden = forbiddenValues(options, temporary);
  try {
    const authoring = join(temporary, "authoring");
    const packageHome = join(temporary, "package-home");
    const layout = join(authoring, "layout");
    const policyLayout = join(authoring, "policy-layout");
    const invalidDocker = join(temporary, "invalid-docker");
    mkdirSync(authoring, { mode: 0o755 });
    mkdirSync(packageHome, { mode: 0o755 });
    mkdirSync(invalidDocker, { mode: 0o700 });
    writeFileSync(join(invalidDocker, "config.json"), "{invalid\n", {
      flag: "wx",
      mode: 0o600,
    });
    writeFixture(authoring, options.root);

    run(
      [
        options.rootformBinary,
        "package",
        "dialects",
        "source",
        "--to",
        "layout",
        "--repository",
        options.repository,
        "--source-url",
        options.sourceURL,
        "--revision",
        options.revision,
        "--documentation-url",
        options.documentationURL,
        "--licenses",
        options.licenses,
      ],
      {
        cwd: authoring,
        env: {
          ...baseEnvironment(options, packageHome),
          DOCKER_CONFIG: invalidDocker,
          HTTPS_PROXY: "http://127.0.0.1:1",
          ROOTFORM_OFFLINE: "1",
        },
        forbidden,
        label: "offline dialect package",
      },
    );

    const dryRun = publicationOf(
      run(
        [
          options.rootformBinary,
          "publish",
          "dialects",
          "layout",
          "--to",
          options.repository,
          "--index",
          "--dry-run",
          "--format",
          "json",
        ],
        {
          cwd: authoring,
          env: {
            ...baseEnvironment(options, join(temporary, "dry-run-home")),
            DOCKER_CONFIG: invalidDocker,
            HTTPS_PROXY: "http://127.0.0.1:1",
            ROOTFORM_OFFLINE: "1",
          },
          forbidden,
          label: "offline publication dry-run",
        },
      ).stdout,
      options,
      true,
    );

    run(
      [
        options.rootformBinary,
        "package",
        "policy-packs",
        "policy-source",
        "--to",
        "policy-layout",
        "--source-url",
        options.sourceURL,
        "--revision",
        options.revision,
        "--documentation-url",
        options.documentationURL,
        "--licenses",
        options.licenses,
      ],
      {
        cwd: authoring,
        env: {
          ...baseEnvironment(options, packageHome),
          DOCKER_CONFIG: invalidDocker,
          HTTPS_PROXY: "http://127.0.0.1:1",
          ROOTFORM_OFFLINE: "1",
        },
        forbidden,
        label: "offline Policy Pack package",
      },
    );
    const policyDryRun = policyPackPublicationOf(
      run(
        [
          options.rootformBinary,
          "publish",
          "policy-packs",
          "policy-layout",
          "--to",
          options.repository,
          "--dry-run",
          "--format",
          "json",
        ],
        {
          cwd: authoring,
          env: {
            ...baseEnvironment(options, join(temporary, "policy-dry-run-home")),
            DOCKER_CONFIG: invalidDocker,
            HTTPS_PROXY: "http://127.0.0.1:1",
            ROOTFORM_OFFLINE: "1",
          },
          forbidden,
          label: "offline Policy Pack publication dry-run",
        },
      ).stdout,
      options,
      true,
    );

    const publish = (): Publication =>
      publicationOf(
        run(
          [
            options.rootformBinary,
            "publish",
            "dialects",
            layout,
            "--to",
            options.repository,
            "--index",
            "--format",
            "json",
          ],
          {
            env: baseEnvironment(options, join(temporary, "publish-home")),
            forbidden,
            label: "live dialect publication",
          },
        ).stdout,
        options,
        false,
      );
    const publication = publish();
    const repeated = publish();
    if (
      publication.dialects[0]?.manifest_digest !== dryRun.dialects[0]?.manifest_digest ||
      publication.index.manifest_digest !== dryRun.index.manifest_digest ||
      repeated.dialects[0]?.status !== "already_present" ||
      repeated.index.status !== "already_present"
    ) {
      throw new Error("publication is not deterministic and idempotent");
    }

    const publishPolicyPack = (): PolicyPackPublication =>
      policyPackPublicationOf(
        run(
          [
            options.rootformBinary,
            "publish",
            "policy-packs",
            policyLayout,
            "--to",
            options.repository,
            "--format",
            "json",
          ],
          {
            env: baseEnvironment(options, join(temporary, "policy-publish-home")),
            forbidden,
            label: "live Policy Pack publication",
          },
        ).stdout,
        options,
        false,
      );
    const policyPublication = publishPolicyPack();
    const repeatedPolicyPublication = publishPolicyPack();
    if (
      policyPublication.policy_packs[0]?.manifest_digest !==
        policyDryRun.policy_packs[0]?.manifest_digest ||
      repeatedPolicyPublication.policy_packs[0]?.status !== "already_present"
    ) {
      throw new Error("Policy Pack publication is not deterministic and idempotent");
    }

    const dialect = publication.dialects[0] as PublicationEntry;
    const references = {
      digest: `${options.repository}@${dialect.manifest_digest}`,
      index: `${options.repository}:${publication.index.tag}`,
      tag: `${options.repository}:${dialect.tag}`,
    };
    const publishedPolicyPack = policyPublication.policy_packs[0] as PublicationEntry;
    const policyReferences = {
      digest: `${options.repository}@${publishedPolicyPack.manifest_digest}`,
      index: `${options.repository}:${publishedPolicyPack.tag}`,
      tag: `${options.repository}:${publishedPolicyPack.tag}`,
    };
    const projects = new Map<
      keyof typeof references,
      { artifact: ArtifactEvidence; pack: PolicyPackArtifactEvidence; root: string }
    >();
    for (const [kind, reference] of Object.entries(references) as Array<
      [keyof typeof references, string]
    >) {
      const project = join(temporary, `${kind}-project`);
      const home = join(temporary, `${kind}-home`);
      writeProject(project);
      run(
        [
          options.rootformBinary,
          "init",
          ".",
          "--source",
          reference,
          "--policy-pack",
          policyReferences[kind],
          "--no-input",
          "--format",
          "json",
        ],
        {
          cwd: project,
          env: baseEnvironment(options, home),
          forbidden,
          label: `${kind} source initialization`,
        },
      );
      projects.set(kind, {
        artifact: lockEvidence(join(project, "rootform.lock"), reference, publication, forbidden),
        pack: policyPackLockEvidence(
          join(project, "rootform.lock"),
          policyReferences[kind],
          policyPublication,
          forbidden,
        ),
        root: project,
      });
    }

    const tag = projects.get("tag");
    const digest = projects.get("digest");
    const index = projects.get("index");
    if (
      !tag ||
      !digest ||
      !index ||
      JSON.stringify(tag.artifact) !== JSON.stringify(digest.artifact) ||
      JSON.stringify(tag.artifact) !== JSON.stringify(index.artifact) ||
      JSON.stringify(tag.pack) !== JSON.stringify(digest.pack) ||
      JSON.stringify(tag.pack) !== JSON.stringify(index.pack)
    ) {
      throw new Error("tag, digest, or index resolution selected different content");
    }

    const lockedProject = join(temporary, "locked-project");
    const lockedHome = join(temporary, "locked-home");
    copyProject(tag.root, lockedProject);
    const lockPath = join(lockedProject, "rootform.lock");
    const lockedDigest = sha256(readFileSync(lockPath));
    run([options.rootformBinary, "init", ".", "--locked", "--no-input", "--format", "json"], {
      cwd: lockedProject,
      env: baseEnvironment(options, lockedHome),
      forbidden,
      label: "locked empty-store acquisition",
    });
    if (sha256(readFileSync(lockPath)) !== lockedDigest) {
      throw new Error("locked acquisition changed rootform.lock");
    }
    regularFile(
      join(lockedHome, "dialects", DIALECT_NAME, DIALECT_VERSION, "dialect.rf"),
      "locked installed dialect",
    );
    regularFile(
      join(lockedHome, "policy-packs", POLICY_PACK_NAME, POLICY_PACK_VERSION, "pack.rf"),
      "locked installed Policy Pack",
    );
    validateInspection(
      run([options.rootformBinary, "show", "dialect", DIALECT_NAME, "--format", "json"], {
        cwd: lockedProject,
        env: baseEnvironment(options, lockedHome),
        forbidden,
        label: "stored dialect inspection",
      }).stdout,
      publication,
      tag.artifact,
      options,
      "store",
    );
    validatePolicyPackInspection(
      run([options.rootformBinary, "show", "policy-pack", POLICY_PACK_NAME, "--format", "json"], {
        cwd: lockedProject,
        env: baseEnvironment(options, lockedHome),
        forbidden,
        label: "stored Policy Pack inspection",
      }).stdout,
      policyPublication,
      tag.pack,
      options,
      "store",
    );
    const listed = parseJSONValue(
      run([options.rootformBinary, "list", "dialects", "--format", "json"], {
        cwd: lockedProject,
        env: baseEnvironment(options, lockedHome),
        forbidden,
        label: "selected dialect listing",
      }).stdout,
      "selected dialect listing",
    );
    if (!Array.isArray(listed) || listed.length !== 1) {
      throw new Error("selected dialect listing is invalid");
    }
    validateInspection(JSON.stringify(listed[0]), publication, tag.artifact, options, "store");
    const listedPolicyPacks = parseJSONValue(
      run([options.rootformBinary, "list", "policy-packs", "--format", "json"], {
        cwd: lockedProject,
        env: baseEnvironment(options, lockedHome),
        forbidden,
        label: "selected Policy Pack listing",
      }).stdout,
      "selected Policy Pack listing",
    );
    if (!Array.isArray(listedPolicyPacks) || listedPolicyPacks.length !== 1) {
      throw new Error("selected Policy Pack listing is invalid");
    }
    validatePolicyPackInspection(
      JSON.stringify(listedPolicyPacks[0]),
      policyPublication,
      tag.pack,
      options,
      "store",
    );
    const installed = parseJSONValue(
      run([options.rootformBinary, "list", "dialects", "--installed", "--format", "json"], {
        cwd: lockedProject,
        env: baseEnvironment(options, lockedHome),
        forbidden,
        label: "installed dialect listing",
      }).stdout,
      "installed dialect listing",
    );
    if (!Array.isArray(installed) || installed.length !== 1) {
      throw new Error("installed dialect listing is invalid");
    }
    validateInspection(JSON.stringify(installed[0]), publication, tag.artifact, options, "store");

    const vendorProject = join(temporary, "vendor-project");
    const vendorHome = join(temporary, "vendor-home");
    copyProject(tag.root, vendorProject);
    const vendorLock = join(vendorProject, "rootform.lock");
    const vendorLockDigest = sha256(readFileSync(vendorLock));
    run([options.rootformBinary, "vendor", "dialects"], {
      cwd: vendorProject,
      env: baseEnvironment(options, vendorHome),
      forbidden,
      label: "exact registry vendor repair",
    });
    run([options.rootformBinary, "vendor", "policy-packs"], {
      cwd: vendorProject,
      env: baseEnvironment(options, vendorHome),
      forbidden,
      label: "exact Policy Pack registry vendor repair",
    });
    const vendorRoot = join(vendorProject, ".rootform", "dialects", DIALECT_NAME);
    const vendorPackRoot = join(vendorProject, ".rootform", "policy-packs", POLICY_PACK_NAME);
    regularFile(join(vendorRoot, "dialect.rf"), "vendored dialect");
    regularFile(join(vendorRoot, "LICENSE"), "vendored license");
    regularFile(join(vendorRoot, "NOTICE"), "vendored notice");
    regularFile(join(vendorPackRoot, "pack.rf"), "vendored Policy Pack");
    regularFile(join(vendorPackRoot, "LICENSE"), "vendored Policy Pack license");
    regularFile(join(vendorPackRoot, "NOTICE"), "vendored Policy Pack notice");
    if (
      readFileSync(join(vendorRoot, "LICENSE"), "utf8") !==
        readFileSync(join(options.root, "LICENSE"), "utf8") ||
      readFileSync(join(vendorPackRoot, "LICENSE"), "utf8") !==
        readFileSync(join(options.root, "LICENSE"), "utf8") ||
      existsSync(join(vendorRoot, ".rootform-artifact.json")) ||
      existsSync(join(vendorPackRoot, ".rootform-artifact.json")) ||
      hasFiles(join(vendorHome, "dialects")) ||
      hasFiles(join(vendorHome, "policy-packs")) ||
      sha256(readFileSync(vendorLock)) !== vendorLockDigest
    ) {
      throw new Error("vendor content, store boundary, or lock identity differs");
    }

    rmSync(vendorHome, { force: true, recursive: true });
    mkdirSync(vendorHome, { mode: 0o755 });
    const offlineEnvironment = {
      ...baseEnvironment(options, vendorHome),
      DOCKER_CONFIG: invalidDocker,
      HTTPS_PROXY: "http://127.0.0.1:1",
      ROOTFORM_OFFLINE: "1",
    };
    for (const command of ["build", "check"] as const) {
      run(
        [
          options.rootformBinary,
          command,
          ".",
          "--locked",
          "--offline",
          "--no-input",
          "--format",
          "json",
        ],
        {
          cwd: vendorProject,
          env: offlineEnvironment,
          forbidden,
          label: `vendored offline ${command}`,
        },
      );
    }
    validateInspection(
      run([options.rootformBinary, "show", "dialect", DIALECT_NAME, "--format", "json"], {
        cwd: vendorProject,
        env: offlineEnvironment,
        forbidden,
        label: "vendored dialect inspection",
      }).stdout,
      publication,
      tag.artifact,
      options,
      "vendor",
    );
    validatePolicyPackInspection(
      run([options.rootformBinary, "show", "policy-pack", POLICY_PACK_NAME, "--format", "json"], {
        cwd: vendorProject,
        env: offlineEnvironment,
        forbidden,
        label: "vendored Policy Pack inspection",
      }).stdout,
      policyPublication,
      tag.pack,
      options,
      "vendor",
    );

    rmSync(join(vendorRoot, "dialect.rf"));
    const partial = expectFailure(
      [options.rootformBinary, "build", ".", "--locked", "--no-input", "--format", "json"],
      {
        cwd: vendorProject,
        env: { ...baseEnvironment(options, vendorHome), DOCKER_CONFIG: invalidDocker },
        forbidden,
        label: "partial vendor execution",
      },
    );
    if (!partial.stderr.includes("rootform vendor dialects")) {
      throw new Error("partial vendor did not fail at explicit repair boundary");
    }
    run([options.rootformBinary, "vendor", "dialects"], {
      cwd: vendorProject,
      env: baseEnvironment(options, vendorHome),
      forbidden,
      label: "explicit partial vendor repair",
    });
    regularFile(join(vendorRoot, "dialect.rf"), "repaired vendored dialect");
    if (sha256(readFileSync(vendorLock)) !== vendorLockDigest) {
      throw new Error("vendor repair changed rootform.lock");
    }

    rmSync(join(vendorPackRoot, "pack.rf"));
    const partialPack = expectFailure(
      [options.rootformBinary, "check", ".", "--locked", "--no-input", "--format", "json"],
      {
        cwd: vendorProject,
        env: { ...baseEnvironment(options, vendorHome), DOCKER_CONFIG: invalidDocker },
        forbidden,
        label: "partial Policy Pack vendor execution",
      },
    );
    if (!`${partialPack.stdout}\n${partialPack.stderr}`.includes("rootform vendor policy-packs")) {
      throw new Error("partial Policy Pack vendor did not fail at explicit repair boundary");
    }
    run([options.rootformBinary, "vendor", "policy-packs"], {
      cwd: vendorProject,
      env: baseEnvironment(options, vendorHome),
      forbidden,
      label: "explicit partial Policy Pack vendor repair",
    });
    regularFile(join(vendorPackRoot, "pack.rf"), "repaired vendored Policy Pack");
    if (sha256(readFileSync(vendorLock)) !== vendorLockDigest) {
      throw new Error("Policy Pack vendor repair changed rootform.lock");
    }

    if (options.credentialProof) {
      regularFile(options.credentialProof, "Docker credential-helper proof");
      const expectedHost = options.repository.split("/", 1)[0];
      if (readFileSync(options.credentialProof, "utf8").trim() !== expectedHost) {
        throw new Error("Docker credential helper received another registry host");
      }
    }

    const evidence = {
      artifact: {
        layer_digest: tag.artifact.layerDigest,
        manifest_digest: tag.artifact.manifestDigest,
        name: DIALECT_NAME,
        presentation_digest: tag.artifact.presentationDigest,
        semantic_digest: tag.artifact.semanticDigest,
        tag: dialect.tag,
        version: DIALECT_VERSION,
      },
      capabilities: {
        additional_index: true,
        custom_media_types: true,
        docker_credential_helper: Boolean(options.credentialProof),
        locked_empty_store: true,
        offline_vendor_execution: true,
        policy_pack_locked_empty_store: true,
        policy_pack_offline_vendor_execution: true,
        policy_pack_pull_by_digest: true,
        policy_pack_pull_by_tag: true,
        policy_pack_vendor_exact_repair: true,
        policy_pack_vendor_exclusive: true,
        publish: true,
        publish_idempotent: true,
        pull_by_digest: true,
        pull_by_tag: true,
        vendor_exact_repair: true,
        vendor_exclusive: true,
      },
      format_version: "1",
      index: {
        manifest_digest: publication.index.manifest_digest,
        tag: publication.index.tag,
      },
      policy_pack: {
        layer_digest: tag.pack.layerDigest,
        manifest_digest: tag.pack.manifestDigest,
        name: POLICY_PACK_NAME,
        pack_digest: tag.pack.packDigest,
        tag: publishedPolicyPack.tag,
        version: POLICY_PACK_VERSION,
      },
      profile: "rootform-oci-core-v1",
      provenance: {
        documentation: options.documentationURL,
        licenses: options.licenses,
        revision: options.revision,
        source: options.sourceURL,
      },
      repository: options.repository,
    };
    const encodedEvidence = `${JSON.stringify(evidence, null, 2)}\n`;
    for (const value of forbidden) {
      if (value && encodedEvidence.includes(value)) {
        throw new Error("registry evidence contains local or secret input");
      }
    }
    writeFileSync(options.evidence, encodedEvidence, {
      flag: "wx",
      mode: 0o644,
    });
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
}

if (import.meta.main) {
  try {
    const options = parseRegistryQualificationArguments(process.argv.slice(2));
    qualifyRegistry(options);
    console.log("Rootform OCI registry compatibility passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
