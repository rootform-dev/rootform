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
import { dirname, isAbsolute, join, resolve } from "node:path";
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
const INDEX_TAG = "official-index-v1";

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

function writableDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o777 });
  chmodSync(path, 0o777);
}

function writeDockerConfiguration(directory: string, content: Record<string, unknown>): void {
  mkdirSync(directory, { mode: 0o755 });
  writeFileSync(join(directory, "config.json"), `${JSON.stringify(content)}\n`, {
    flag: "wx",
    mode: 0o644,
  });
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
    const awsDialectVersion = publishedDialectVersion(publication, "aws");
    const coreDialectVersion = publishedDialectVersion(publication, "core");

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
    const armImage = tags.get("arm64") as string;
    const amdImage = tags.get("amd64") as string;
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
    const privateProject = join(temporary, "private-project");
    cpSync(project, privateProject, { recursive: true });
    const privateLockPath = join(privateProject, "rootform.lock");
    const privateLock = rewriteArtifactPins(baseLock, {
      aws: { repository: PRIVATE_DIALECT_REPOSITORY },
      core: { repository: PRIVATE_DIALECT_REPOSITORY },
    });
    writeFileSync(privateLockPath, privateLock, { mode: 0o644 });
    const privateLockDigest = sha256(readFileSync(privateLockPath));

    const privateDockerConfig = join(temporary, "private-docker-config");
    writeDockerConfiguration(
      privateDockerConfig,
      privateDockerConfiguration("private.rootform.test", registryUsername, registryPassword),
    );
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
        index_manifest_digest: publication.index.manifest_digest,
        repositories: [OFFICIAL_DIALECT_REPOSITORY, PRIVATE_DIALECT_REPOSITORY],
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
        gitlab_shell_injection: true,
        locked_direct_pins_without_index: true,
        multi_repository_lock: true,
        offline_network_none: true,
        private_basic_registry: true,
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
