#!/usr/bin/env bun

import { createHash } from "node:crypto";
import {
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
import { dirname, isAbsolute, join, resolve } from "node:path";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const DIALECT_OWNER = "registry-compat";
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
  owner?: string;
  name?: string;
  provenance: Provenance;
  repository: string;
  size: number;
  status: "already_present" | "planned" | "published";
  tag: string;
  version: string;
};

export type PackagePin = {
  contentDigest: string;
  downloadSize: number;
  installSize: number;
  layerDigest: string;
  manifestDigest: string;
  manifestSize: number;
  presentationDigest?: string;
  semanticDigest?: string;
  tag: string;
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
    return object(JSON.parse(body) as unknown, label);
  } catch (error) {
    if (error instanceof Error && error.message === `${label} must be an object`) throw error;
    throw new Error(`${label} is not valid JSON`);
  }
}

function parseJSONArray(body: string, label: string): unknown[] {
  try {
    const value = JSON.parse(body) as unknown;
    if (!Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new Error(`${label} is not a JSON array`);
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

function canonicalRepository(value: string): string {
  if (
    value.length > 255 ||
    !/^[a-zA-Z0-9.-]+(?::[0-9]+)?\/[a-z0-9._/-]+$/u.test(value) ||
    value.includes("..") ||
    value.includes("//") ||
    value.endsWith("/") ||
    value.includes("@") ||
    /:[^/]+$/u.test(value)
  ) {
    throw new Error("--repository must be a canonical tagless OCI repository");
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
  arguments_: string[],
  cwd = process.cwd(),
): Options {
  const optional = new Set(["ca-file", "credential-proof"]);
  const required = [
    "documentation-url",
    "evidence",
    "licenses",
    "repository",
    "revision",
    "rootform-bin",
    "source-url",
  ];
  const accepted = new Set([...optional, ...required]);
  const values = new Map<string, string>();
  for (let position = 0; position < arguments_.length; position++) {
    const argument = arguments_[position] ?? "";
    const name = [...accepted].find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown registry qualification argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate registry qualification argument: --${name}`);
    const value = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++position];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  for (const name of required) {
    if (!values.has(name)) throw new Error(`--${name} is required`);
  }
  const revision = values.get("revision") as string;
  if (!/^[0-9a-f]{40}$/u.test(revision)) throw new Error("--revision must be one exact Git commit");
  const licenses = values.get("licenses") as string;
  if (licenses.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9 .()+-]*$/u.test(licenses)) {
    throw new Error("--licenses must be a bounded SPDX expression");
  }
  return {
    ...(values.has("ca-file") ? { caFile: absolute(values.get("ca-file") as string, cwd) } : {}),
    ...(values.has("credential-proof")
      ? { credentialProof: absolute(values.get("credential-proof") as string, cwd) }
      : {}),
    documentationURL: canonicalHTTPS(
      values.get("documentation-url") as string,
      "--documentation-url",
    ),
    evidence: absolute(values.get("evidence") as string, cwd),
    licenses,
    repository: canonicalRepository(values.get("repository") as string),
    revision,
    root: join(import.meta.dir, ".."),
    rootformBinary: absolute(values.get("rootform-bin") as string, cwd),
    sourceURL: canonicalHTTPS(values.get("source-url") as string, "--source-url"),
  };
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
  for (const value of forbidden) {
    if (value && output.includes(value)) throw new Error(`${label} exposed private input`);
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
    throw new Error(
      `${options.label} failed with exit ${result.exitCode}: ${result.stderr.trim()}`,
    );
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
    CI: "true",
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

export function writeRegistryQualificationFixture(root: string, repositoryRoot: string): void {
  const dialect = join(root, "dialect-source", DIALECT_OWNER);
  mkdirSync(dialect, { recursive: true, mode: 0o755 });
  writeFileSync(
    join(dialect, "dialect.rf.hcl"),
    `dialect "${DIALECT_OWNER}" {
  version = "${DIALECT_VERSION}"
  provider "examplecorp/portable" { version = "= ${PROVIDER_VERSION}" }
}

concept "portable-service" {
  description = "Portable service used only by registry qualification."
}

rule "portable-service" {
  match {
    type = "portable_service"
  }

  as = concept.portable-service
}
`,
    { flag: "wx", mode: 0o644 },
  );
  writeFileSync(
    join(dialect, "presentation.json"),
    '{"format_version":"1","resources":{},"rules":{},"concepts":{},"resource_labels":{},"rule_labels":{},"concept_labels":{}}\n',
    { flag: "wx", mode: 0o644 },
  );
  cpSync(join(repositoryRoot, "LICENSE"), join(dialect, "LICENSE"), {
    errorOnExist: true,
    force: false,
  });
  writeFileSync(
    join(dialect, "NOTICE"),
    "Rootform registry compatibility fixture. Not a production Dialect.\n",
    { flag: "wx", mode: 0o644 },
  );

  const policyPack = join(root, "policy-source");
  mkdirSync(join(policyPack, "policies"), { recursive: true, mode: 0o755 });
  writeFileSync(
    join(policyPack, "pack.rf.hcl"),
    `policy_pack "${POLICY_PACK_NAME}" {
  version = "${POLICY_PACK_VERSION}"
}
`,
    { flag: "wx", mode: 0o644 },
  );
  writeFileSync(
    join(policyPack, "policies", "portable-service.rf.hcl"),
    `policy "portable-service" {
  target {
    concept = ${DIALECT_OWNER}.concept.portable-service
  }

  assert = true

  message = "Portable services are available for registry qualification."
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

export function writeRegistryQualificationProject(root: string): void {
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

resource "portable_service" "main" {}
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
  cpSync(join(import.meta.dir, "fixtures", "portable-plan.json"), join(root, "plan.json"), {
    errorOnExist: true,
    force: false,
  });
}

function readBlob(layout: string, digest: string, label: string): Buffer {
  if (!DIGEST.test(digest)) throw new Error(`${label} digest is invalid`);
  const body = readFileSync(join(layout, "blobs", "sha256", digest.slice("sha256:".length)));
  if (`sha256:${sha256(body)}` !== digest) throw new Error(`${label} digest differs`);
  return body;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`${label} is invalid`);
  return Number(value);
}

export function readPackagePin(
  layout: string,
  tag: string,
  kind: "dialect" | "policy-pack",
): PackagePin {
  const index = parseJSON(readFileSync(join(layout, "index.json"), "utf8"), `${kind} layout index`);
  if (!Array.isArray(index.manifests)) throw new Error(`${kind} layout has no manifests`);
  const roots = index.manifests
    .map((value, position) => object(value, `${kind} layout descriptor ${position}`))
    .filter((descriptor) => {
      const annotations = object(descriptor.annotations ?? {}, `${kind} descriptor annotations`);
      return annotations["org.opencontainers.image.ref.name"] === tag;
    });
  if (roots.length !== 1) throw new Error(`${kind} layout has no unique ${tag} package`);
  const root = roots[0] as JsonObject;
  const manifestDigest = String(root.digest ?? "");
  const manifestSize = positiveInteger(root.size, `${kind} manifest size`);
  const manifestBody = readBlob(layout, manifestDigest, `${kind} manifest`);
  if (manifestBody.byteLength !== manifestSize) throw new Error(`${kind} manifest size differs`);
  const manifest = parseJSON(manifestBody.toString("utf8"), `${kind} manifest`);
  const configDescriptor = object(manifest.config, `${kind} config descriptor`);
  const configDigest = String(configDescriptor.digest ?? "");
  const configBody = readBlob(layout, configDigest, `${kind} config`);
  if (configBody.byteLength !== positiveInteger(configDescriptor.size, `${kind} config size`)) {
    throw new Error(`${kind} config size differs`);
  }
  if (!Array.isArray(manifest.layers) || manifest.layers.length !== 1) {
    throw new Error(`${kind} manifest must have one layer`);
  }
  const layer = object(manifest.layers[0], `${kind} layer descriptor`);
  const layerDigest = String(layer.digest ?? "");
  const config = parseJSON(configBody.toString("utf8"), `${kind} config`);
  if (config.layer_digest !== layerDigest) throw new Error(`${kind} layer digest differs`);
  const contentDigest = String(
    kind === "dialect" ? (config.content_digest ?? "") : (config.policy_pack_digest ?? ""),
  );
  if (!DIGEST.test(contentDigest)) throw new Error(`${kind} content digest is invalid`);
  return {
    contentDigest,
    downloadSize: positiveInteger(config.download_size, `${kind} download size`),
    installSize: positiveInteger(config.install_size, `${kind} install size`),
    layerDigest,
    manifestDigest,
    manifestSize,
    ...(kind === "dialect"
      ? {
          presentationDigest: String(config.presentation_digest ?? ""),
          semanticDigest: String(config.semantic_digest ?? ""),
        }
      : {}),
    tag,
  };
}

function provenance(options: Options): Provenance {
  return {
    documentation: options.documentationURL,
    licenses: options.licenses,
    revision: options.revision,
    source: options.sourceURL,
  };
}

function publicationEntry(
  body: string,
  options: Options,
  kind: "dialect" | "policy-pack",
  dryRun: boolean,
): PublicationEntry {
  const result = parseJSON(body, `${kind} publication result`);
  const collectionName = kind === "dialect" ? "dialects" : "policy_packs";
  const entries = result[collectionName];
  if (
    result.format_version !== "1" ||
    result.repository !== options.repository ||
    result.dry_run !== dryRun ||
    !Array.isArray(entries) ||
    entries.length !== 1
  ) {
    throw new Error(`${kind} publication result is invalid`);
  }
  const entry = object(entries[0], `${kind} publication entry`);
  const parsed: PublicationEntry = {
    manifest_digest: String(entry.manifest_digest ?? ""),
    manifest_size: positiveInteger(entry.manifest_size, `${kind} publication manifest size`),
    ...(kind === "dialect"
      ? { owner: String(entry.owner ?? "") }
      : { name: String(entry.name ?? "") }),
    provenance: object(entry.provenance, `${kind} publication provenance`) as Provenance,
    repository: String(entry.repository ?? ""),
    size: positiveInteger(entry.size, `${kind} publication size`),
    status: String(entry.status ?? "") as PublicationEntry["status"],
    tag: String(entry.tag ?? ""),
    version: String(entry.version ?? ""),
  };
  const expectedIdentity = kind === "dialect" ? DIALECT_OWNER : POLICY_PACK_NAME;
  const expectedVersion = kind === "dialect" ? DIALECT_VERSION : POLICY_PACK_VERSION;
  const expectedTag = `${kind === "dialect" ? "dialect" : "policy-pack"}-${expectedIdentity}-${expectedVersion}`;
  if (
    (kind === "dialect" ? parsed.owner : parsed.name) !== expectedIdentity ||
    parsed.version !== expectedVersion ||
    parsed.repository !== options.repository ||
    parsed.tag !== expectedTag ||
    !DIGEST.test(parsed.manifest_digest) ||
    !["already_present", "planned", "published"].includes(parsed.status) ||
    JSON.stringify(parsed.provenance) !== JSON.stringify(provenance(options))
  ) {
    throw new Error(`${kind} publication entry is invalid`);
  }
  return parsed;
}

export function encodeSelectionLock(
  repository: string,
  dialect: PackagePin,
  policyPack: PackagePin,
): string {
  const lock = {
    format_version: "1",
    dialects: [
      {
        owner: DIALECT_OWNER,
        version: DIALECT_VERSION,
        content_digest: dialect.contentDigest,
        source: {
          oci: {
            repository,
            manifest_digest: dialect.manifestDigest,
            layer_digest: dialect.layerDigest,
            download_size: dialect.downloadSize,
            install_size: dialect.installSize,
          },
        },
      },
    ],
    policy_packs: [
      {
        name: POLICY_PACK_NAME,
        version: POLICY_PACK_VERSION,
        content_digest: policyPack.contentDigest,
        source: {
          oci: {
            repository,
            manifest_digest: policyPack.manifestDigest,
            layer_digest: policyPack.layerDigest,
            download_size: policyPack.downloadSize,
            install_size: policyPack.installSize,
          },
        },
      },
    ],
    excluded_owners: [],
    replacements: [],
  };
  return `${JSON.stringify(lock, null, 2)}\n`;
}

function hasFiles(path: string): boolean {
  return (
    existsSync(path) &&
    Bun.spawnSync(["find", path, "-type", "f", "-print", "-quit"]).stdout.length > 0
  );
}

function verifyJSON(body: string, label: string): JsonObject {
  return parseJSON(body, label);
}

function verifyPlan(body: string, label: string): void {
  const document = parseJSON(body, label);
  const semantics = object(document.semantics, `${label} semantics`);
  const stages = object(document.stages, `${label} stages`);
  const planned = object(stages.planned, `${label} planned stage`);
  if (
    document.format_version !== "1" ||
    document.kind !== "plan" ||
    !Array.isArray(semantics.owners) ||
    !semantics.owners.some((value) => {
      const owner = object(value, `${label} owner`);
      return owner.id === DIALECT_OWNER && owner.version === DIALECT_VERSION;
    }) ||
    !Array.isArray(planned.representations) ||
    !planned.representations.some((value) => {
      const representation = object(value, `${label} representation`);
      return (
        representation.address === "portable_service.main" &&
        object(representation.interpretation, `${label} interpretation`).status === "applied"
      );
    })
  ) {
    throw new Error(`${label} omitted selected Dialect or portable service`);
  }
}

function verifyPolicySARIF(path: string, label: string): void {
  const report = parseJSON(readFileSync(path, "utf8"), label);
  const runs = report.runs;
  if (report.version !== "2.1.0" || !Array.isArray(runs) || runs.length !== 1) {
    throw new Error(`${label} is not SARIF 2.1.0`);
  }
  const results = object(runs[0], `${label} run`).results;
  if (!Array.isArray(results) || results.length !== 1)
    throw new Error(`${label} did not evaluate one policy`);
  const result = object(results[0], `${label} result`);
  if (result.ruleId !== `${POLICY_PACK_NAME}/portable-service` || result.kind !== "pass") {
    throw new Error(`${label} did not pass the selected Policy Pack`);
  }
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
  const commandOptions = (
    label: string,
    cwd: string,
    home: string,
    extra: Record<string, string | undefined> = {},
  ) => ({
    cwd,
    env: { ...baseEnvironment(options, home), ...extra },
    forbidden,
    label,
  });
  try {
    const authoring = join(temporary, "authoring");
    const dialectLayout = join(authoring, "dialect-layout");
    const policyLayout = join(authoring, "policy-layout");
    const invalidDocker = join(temporary, "invalid-docker");
    mkdirSync(authoring, { mode: 0o755 });
    mkdirSync(invalidDocker, { mode: 0o700 });
    writeFileSync(join(invalidDocker, "config.json"), "{invalid\n", { flag: "wx", mode: 0o600 });
    writeRegistryQualificationFixture(authoring, options.root);

    const offline = {
      DOCKER_CONFIG: invalidDocker,
      HTTPS_PROXY: "http://127.0.0.1:1",
      ROOTFORM_OFFLINE: "1",
    };
    run(
      [
        options.rootformBinary,
        "package",
        "dialects",
        "dialect-source",
        "--to",
        "dialect-layout",
        "--source-url",
        options.sourceURL,
        "--revision",
        options.revision,
        "--documentation-url",
        options.documentationURL,
        "--licenses",
        options.licenses,
      ],
      commandOptions(
        "offline Dialect package",
        authoring,
        join(temporary, "package-home"),
        offline,
      ),
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
      commandOptions(
        "offline Policy Pack package",
        authoring,
        join(temporary, "package-home"),
        offline,
      ),
    );

    const dialectTag = `dialect-${DIALECT_OWNER}-${DIALECT_VERSION}`;
    const policyTag = `policy-pack-${POLICY_PACK_NAME}-${POLICY_PACK_VERSION}`;
    const dialectPin = readPackagePin(dialectLayout, dialectTag, "dialect");
    const policyPin = readPackagePin(policyLayout, policyTag, "policy-pack");

    const dryDialect = publicationEntry(
      run(
        [
          options.rootformBinary,
          "publish",
          "dialects",
          dialectLayout,
          "--to",
          options.repository,
          "--dry-run",
          "--format",
          "json",
        ],
        commandOptions(
          "offline Dialect publication dry-run",
          authoring,
          join(temporary, "dry-home"),
          offline,
        ),
      ).stdout,
      options,
      "dialect",
      true,
    );
    const dryPolicy = publicationEntry(
      run(
        [
          options.rootformBinary,
          "publish",
          "policy-packs",
          policyLayout,
          "--to",
          options.repository,
          "--dry-run",
          "--format",
          "json",
        ],
        commandOptions(
          "offline Policy Pack publication dry-run",
          authoring,
          join(temporary, "dry-home"),
          offline,
        ),
      ).stdout,
      options,
      "policy-pack",
      true,
    );
    if (
      dryDialect.manifest_digest !== dialectPin.manifestDigest ||
      dryPolicy.manifest_digest !== policyPin.manifestDigest
    ) {
      throw new Error("dry-run publication differs from packaged OCI content");
    }

    const publish = (kind: "dialect" | "policy-pack", layout: string): PublicationEntry =>
      publicationEntry(
        run(
          [
            options.rootformBinary,
            "publish",
            kind === "dialect" ? "dialects" : "policy-packs",
            layout,
            "--to",
            options.repository,
            "--format",
            "json",
          ],
          commandOptions(`live ${kind} publication`, authoring, join(temporary, "publish-home")),
        ).stdout,
        options,
        kind,
        false,
      );
    const publishedDialect = publish("dialect", dialectLayout);
    const publishedPolicy = publish("policy-pack", policyLayout);
    const repeatedDialect = publish("dialect", dialectLayout);
    const repeatedPolicy = publish("policy-pack", policyLayout);
    if (
      publishedDialect.manifest_digest !== dryDialect.manifest_digest ||
      publishedPolicy.manifest_digest !== dryPolicy.manifest_digest ||
      repeatedDialect.status !== "already_present" ||
      repeatedPolicy.status !== "already_present"
    ) {
      throw new Error("publication is not deterministic and idempotent");
    }

    const project = join(temporary, "project");
    const home = join(temporary, "home");
    writeRegistryQualificationProject(project);
    mkdirSync(home, { mode: 0o755 });
    const lockPath = join(project, "rootform.lock");
    writeFileSync(lockPath, encodeSelectionLock(options.repository, dialectPin, policyPin), {
      flag: "wx",
      mode: 0o644,
    });
    const lockDigest = sha256(readFileSync(lockPath));
    verifyJSON(
      run(
        [options.rootformBinary, "init", ".", "--locked", "--no-input", "--format", "json"],
        commandOptions("locked empty-store acquisition", project, home),
      ).stdout,
      "init result",
    );
    if (sha256(readFileSync(lockPath)) !== lockDigest)
      throw new Error("init changed rootform.lock");
    regularFile(
      join(home, "dialects", DIALECT_OWNER, DIALECT_VERSION, "dialect.rf.hcl"),
      "installed Dialect",
    );
    regularFile(
      join(home, "policy-packs", POLICY_PACK_NAME, POLICY_PACK_VERSION, "pack.rf.hcl"),
      "installed Policy Pack",
    );

    const dialects = parseJSONArray(
      run(
        [options.rootformBinary, "list", "dialects", "--format", "json"],
        commandOptions("effective Dialect listing", project, home),
      ).stdout,
      "effective Dialect listing",
    );
    if (!dialects.some((entry) => object(entry, "Dialect list entry").owner === DIALECT_OWNER)) {
      throw new Error("selected third-party Dialect is absent from effective catalog");
    }
    verifyPlan(
      run(
        [
          options.rootformBinary,
          "run",
          "plan.json",
          "--project",
          ".",
          "--locked",
          "--no-serve",
          "--format",
          "json",
        ],
        commandOptions("locked run", project, home),
      ).stdout,
      "locked run result",
    );
    run(
      [
        options.rootformBinary,
        "run",
        "plan.json",
        "--project",
        ".",
        "--locked",
        "--policy",
        `${POLICY_PACK_NAME}/*`,
        "--no-serve",
        "-o",
        "results.sarif",
      ],
      commandOptions("locked Policy evaluation", project, home),
    );
    verifyPolicySARIF(join(project, "results.sarif"), "locked Policy result");

    const vendorProject = join(temporary, "vendor-project");
    const vendorHome = join(temporary, "vendor-home");
    cpSync(project, vendorProject, { recursive: true });
    mkdirSync(vendorHome, { mode: 0o755 });
    run(
      [options.rootformBinary, "vendor", "dialects"],
      commandOptions("exact Dialect vendor", vendorProject, vendorHome),
    );
    run(
      [options.rootformBinary, "vendor", "policy-packs"],
      commandOptions("exact Policy Pack vendor", vendorProject, vendorHome),
    );
    const vendorDialect = join(vendorProject, ".rootform", "dialects", DIALECT_OWNER);
    const vendorPolicy = join(vendorProject, ".rootform", "policy-packs", POLICY_PACK_NAME);
    regularFile(join(vendorDialect, "dialect.rf.hcl"), "vendored Dialect");
    regularFile(join(vendorPolicy, "pack.rf.hcl"), "vendored Policy Pack");
    if (hasFiles(join(vendorHome, "dialects")) || hasFiles(join(vendorHome, "policy-packs"))) {
      throw new Error("vendor unexpectedly populated user store");
    }
    rmSync(vendorHome, { recursive: true, force: true });
    mkdirSync(vendorHome, { mode: 0o755 });
    const vendorOffline = { ...offline, ROOTFORM_OFFLINE: "1" };
    verifyPlan(
      run(
        [
          options.rootformBinary,
          "run",
          "plan.json",
          "--project",
          ".",
          "--locked",
          "--no-serve",
          "--format",
          "json",
        ],
        commandOptions("vendored offline run", vendorProject, vendorHome, vendorOffline),
      ).stdout,
      "vendored run result",
    );
    run(
      [
        options.rootformBinary,
        "run",
        "plan.json",
        "--project",
        ".",
        "--locked",
        "--policy",
        `${POLICY_PACK_NAME}/*`,
        "--no-serve",
        "-o",
        "vendor-results.sarif",
      ],
      commandOptions(
        "vendored offline Policy evaluation",
        vendorProject,
        vendorHome,
        vendorOffline,
      ),
    );
    verifyPolicySARIF(join(vendorProject, "vendor-results.sarif"), "vendored Policy result");

    rmSync(join(vendorDialect, "dialect.rf.hcl"));
    const partial = expectFailure(
      [
        options.rootformBinary,
        "run",
        "plan.json",
        "--project",
        ".",
        "--locked",
        "--no-serve",
        "--format",
        "json",
      ],
      commandOptions("partial Dialect vendor", vendorProject, vendorHome, offline),
    );
    if (!partial.stderr.includes("rootform vendor dialects")) {
      throw new Error("partial Dialect vendor missed explicit repair boundary");
    }
    run(
      [options.rootformBinary, "vendor", "dialects"],
      commandOptions("explicit Dialect vendor repair", vendorProject, vendorHome),
    );
    regularFile(join(vendorDialect, "dialect.rf.hcl"), "repaired vendored Dialect");
    if (sha256(readFileSync(join(vendorProject, "rootform.lock"))) !== lockDigest) {
      throw new Error("vendor changed rootform.lock");
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
        content_digest: dialectPin.contentDigest,
        layer_digest: dialectPin.layerDigest,
        manifest_digest: dialectPin.manifestDigest,
        owner: DIALECT_OWNER,
        presentation_digest: dialectPin.presentationDigest,
        semantic_digest: dialectPin.semanticDigest,
        tag: dialectTag,
        version: DIALECT_VERSION,
      },
      capabilities: {
        custom_media_types: true,
        docker_credential_helper: Boolean(options.credentialProof),
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
        content_digest: policyPin.contentDigest,
        layer_digest: policyPin.layerDigest,
        manifest_digest: policyPin.manifestDigest,
        name: POLICY_PACK_NAME,
        tag: policyTag,
        version: POLICY_PACK_VERSION,
      },
      profile: "rootform-oci-core-v1",
      provenance: provenance(options),
      repository: options.repository,
    };
    const encoded = `${JSON.stringify(evidence, null, 2)}\n`;
    for (const value of forbidden) {
      if (value && encoded.includes(value))
        throw new Error("registry evidence contains private input");
    }
    writeFileSync(options.evidence, encoded, { flag: "wx", mode: 0o644 });
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
