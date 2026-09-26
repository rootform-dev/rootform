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
  imageRuntimeBuildArguments,
} from "./build-image.ts";
import {
  encodeSelectionLock,
  readPackagePin,
  writeRegistryQualificationFixture,
  writeRegistryQualificationProject,
} from "./qualify-registry.ts";
import { normalizeVersion } from "./release/contract.ts";
import { sha256 } from "./release/digest.ts";

const REGISTRY_IMAGE =
  "registry:3.0.0@sha256:6c5666b861f3505b116bb9aa9b25175e71210414bd010d92035ff64018f9457e";
const REGISTRY_HOST = "registry.rootform.test";
const REGISTRY_REPOSITORY = `${REGISTRY_HOST}/acme/rootform-qualification`;
const DIALECT_OWNER = "registry-compat";
const DIALECT_VERSION = "0.1.0";
const POLICY_PACK_NAME = "registry-compat-policies";
const POLICY_PACK_VERSION = "0.1.0";

type QualificationOptions = {
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

type RootformRunOptions = {
  architecture: ImageArchitecture;
  arguments: string[];
  ca?: string;
  home: string;
  homeReadOnly?: boolean;
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

type JsonObject = Record<string, unknown>;

function absolute(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function requireRegularFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink() || status.size < 1) {
    throw new Error(`${label} must be a non-empty regular file`);
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
  const names = ["evidence", "image", "oras", "revision", "rootform-bin", "trivy", "version"];
  const values = new Map<string, string>();
  for (let position = 0; position < arguments_.length; position++) {
    const argument = arguments_[position] ?? "";
    const name = names.find(
      (candidate) => argument === `--${candidate}` || argument.startsWith(`--${candidate}=`),
    );
    if (!name) throw new Error(`unknown image qualification argument: ${argument}`);
    if (values.has(name)) throw new Error(`duplicate image qualification argument: --${name}`);
    const value = argument.startsWith(`--${name}=`)
      ? argument.slice(`--${name}=`.length)
      : arguments_[++position];
    if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
    values.set(name, value);
  }
  for (const name of names) {
    if (!values.has(name)) throw new Error(`--${name} is required`);
  }
  const revision = values.get("revision") as string;
  if (!/^[0-9a-f]{40}$/u.test(revision)) throw new Error("--revision must be one exact commit");
  return {
    evidence: absolute(values.get("evidence") as string, cwd),
    image: absolute(values.get("image") as string, cwd),
    oras: absolute(values.get("oras") as string, cwd),
    revision,
    rootformBinary: absolute(values.get("rootform-bin") as string, cwd),
    trivy: absolute(values.get("trivy") as string, cwd),
    version: normalizeVersion(values.get("version") as string),
  };
}

function execute(command: string[], options: { cwd?: string } = {}): CommandResult {
  const result = Bun.spawnSync({
    cmd: command,
    cwd: options.cwd,
    env: process.env,
    stderr: "pipe",
    stdout: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  };
}

function run(command: string[], options: { cwd?: string } = {}): CommandResult {
  const result = execute(command, options);
  if (result.exitCode !== 0) {
    throw new Error(
      `${command[0] ?? "command"} exited ${result.exitCode}: ${result.stderr.trim()}`,
    );
  }
  return result;
}

function docker(arguments_: string[]): CommandResult {
  return run(["docker", ...arguments_]);
}

function parseJson(body: string, label: string): JsonObject {
  try {
    const value = JSON.parse(body) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error();
    return value as JsonObject;
  } catch {
    throw new Error(`${label} is not a JSON object`);
  }
}

function imageTag(suffix: string, architecture: ImageArchitecture): string {
  return `rootform-qualification:${suffix}-${architecture}`;
}

function dockerMount(host: string, container: string, readOnly = false): string {
  return `${host}:${container}${readOnly ? ":ro" : ""}`;
}

export function temporaryPermissionRepairArguments(image: string, temporary: string): string[] {
  const resolved = resolve(temporary);
  if (
    !resolved.startsWith(`${resolve(tmpdir())}/rootform-image-qualification-`) ||
    resolved === resolve(tmpdir())
  ) {
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
    `${resolved}:/cleanup`,
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

function writableDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o777 });
  chmodSync(path, 0o777);
}

export function rootformDockerArguments(options: RootformRunOptions): string[] {
  const arguments_ = [
    "run",
    "--rm",
    "--platform",
    `linux/${options.architecture}`,
    "--network",
    options.network,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--volume",
    dockerMount(options.project, "/workspace", options.projectReadOnly),
    "--volume",
    dockerMount(options.home, "/home/rootform/.rootform", options.homeReadOnly),
  ];
  if (options.user) arguments_.push("--user", options.user);
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
    throw new Error(`rootform container exited ${result.exitCode}: ${result.stderr.trim()}`);
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

export function registryCompletedRequestCount(logs: string): number {
  return logs
    .split(/\r?\n/u)
    .filter((line) => line.includes("response completed") && /http\.request\.method=/u.test(line))
    .length;
}

function publishLayoutTag(options: {
  ca: string;
  destination: string;
  layout: string;
  oras: string;
  tag: string;
}): void {
  run([
    options.oras,
    "cp",
    "--from-oci-layout",
    "--no-tty",
    "--to-ca-file",
    options.ca,
    `${options.layout}:${options.tag}`,
    `${options.destination}:${options.tag}`,
  ]);
}

function writeSuppliedDialectProject(root: string): void {
  writableDirectory(root);
  writeFileSync(
    join(root, "main.tf"),
    `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

provider "aws" {}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "application" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
}
`,
    { flag: "wx", mode: 0o644 },
  );
  writeFileSync(
    join(root, ".terraform.lock.hcl"),
    `provider "registry.terraform.io/hashicorp/aws" {
  version     = "6.62.0"
  constraints = "= 6.62.0"
}
`,
    { flag: "wx", mode: 0o644 },
  );
  writeFileSync(
    join(root, "rootform.lock"),
    '{"format_version":"1","dialects":[],"policy_packs":[],"excluded_owners":[],"replacements":[]}\n',
    { flag: "wx", mode: 0o644 },
  );
}

function assertArchitecture(
  body: string,
  expectedOwner: string,
  expectedType: string,
  label: string,
): void {
  const document = parseJson(body, label);
  const semantics = parseJson(JSON.stringify(document.semantics), `${label} semantics`);
  const owners = semantics.owners;
  if (
    !Array.isArray(owners) ||
    !owners.some((value) => {
      const owner = typeof value === "object" && value !== null ? (value as JsonObject) : {};
      return owner.id === expectedOwner && owner.kind === "dialect";
    })
  ) {
    throw new Error(`${label} omits expected Dialect owner`);
  }
  if (document.format_version !== "1" || document.kind !== "plan") {
    throw new Error(`${label} is not a format-1 plan`);
  }
  const forms = parseJson(JSON.stringify(document.forms), `${label} forms`);
  const planned = parseJson(JSON.stringify(forms.planned), `${label} planned Form`);
  const representations = planned.representations;
  if (
    !Array.isArray(representations) ||
    !representations.some((value) => {
      const representation =
        typeof value === "object" && value !== null ? (value as JsonObject) : {};
      return (
        String(representation.address ?? "").startsWith(`${expectedType}.`) &&
        typeof representation.interpretation === "object" &&
        representation.interpretation !== null &&
        (representation.interpretation as JsonObject).status === "applied"
      );
    })
  ) {
    throw new Error(`${label} omits expected resource base`);
  }
}

function assertPolicySARIF(path: string, label: string): void {
  const report = parseJson(readFileSync(path, "utf8"), label);
  if (report.version !== "2.1.0" || !Array.isArray(report.runs) || report.runs.length !== 1) {
    throw new Error(`${label} is not SARIF 2.1.0`);
  }
  const run = parseJson(JSON.stringify(report.runs[0]), `${label} run`);
  if (!Array.isArray(run.results) || run.results.length !== 1) {
    throw new Error(`${label} did not evaluate one policy`);
  }
  const result = parseJson(JSON.stringify(run.results[0]), `${label} result`);
  if (result.ruleId !== `${POLICY_PACK_NAME}/portable-service` || result.kind !== "pass") {
    throw new Error(`${label} did not pass the selected Policy Pack`);
  }
}

function vulnerabilityCount(path: string): number {
  const report = parseJson(readFileSync(path, "utf8"), "Trivy report");
  if (!Array.isArray(report.Results)) return 0;
  return report.Results.reduce((total, result) => {
    if (typeof result !== "object" || result === null || Array.isArray(result)) return total;
    const vulnerabilities = (result as JsonObject).Vulnerabilities;
    return total + (Array.isArray(vulnerabilities) ? vulnerabilities.length : 0);
  }, 0);
}

function qualifyPodman(archive: string, version: string): PodmanEvidence {
  if (!Bun.which("podman")) return { reason: "podman is not installed", status: "unavailable" };
  const info = execute(["podman", "info", "--format", "json"]);
  if (info.exitCode !== 0)
    return { reason: "podman service is unavailable", status: "unavailable" };
  const decoded = parseJson(info.stdout, "Podman information");
  const host = (decoded.host ?? decoded.Host) as JsonObject | undefined;
  const observed = String(host?.arch ?? host?.Arch ?? "").toLowerCase();
  const architecture = observed.includes("arm") || observed.includes("aarch") ? "arm64" : "amd64";
  run(["podman", "load", "--input", archive]);
  try {
    const result = run([
      "podman",
      "run",
      "--rm",
      "--platform",
      `linux/${architecture}`,
      `${IMAGE_REFERENCE}:${version}`,
      "rootform",
      "version",
    ]);
    if (result.stdout.trim() !== `rootform ${version}`) {
      throw new Error("Podman image reports another Rootform version");
    }
  } finally {
    execute(["podman", "image", "rm", `${IMAGE_REFERENCE}:${version}`]);
  }
  return { architecture: `linux/${architecture}`, status: "passed" };
}

export function qualifyImage(options: QualificationOptions & { root: string }): void {
  requireDirectory(options.image, "image build output");
  requireRegularFile(options.oras, "ORAS executable");
  requireRegularFile(options.rootformBinary, "Rootform executable");
  requireRegularFile(options.trivy, "Trivy executable");
  requireRegularFile(join(options.root, "LICENSE"), "repository license");
  if (existsSync(options.evidence)) throw new Error("image qualification evidence already exists");
  mkdirSync(dirname(options.evidence), { recursive: true });

  const localVersion = run([options.rootformBinary, "version"]).stdout.trim();
  if (localVersion !== `rootform ${options.version}`) {
    throw new Error("qualification binary reports another Rootform version");
  }

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
  const registry = `rootform-registry-${suffix}`;
  const tags = new Map<ImageArchitecture, string>();
  let networkCreated = false;
  let registryCreated = false;
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
      );
      const version = docker([
        "run",
        "--rm",
        "--platform",
        `linux/${architecture}`,
        tag,
        "rootform",
        "version",
      ]).stdout.trim();
      if (version !== `rootform ${options.version}`) {
        throw new Error(`${architecture} image reports another Rootform version`);
      }
    }
    const amdImage = tags.get("amd64") as string;
    const armImage = tags.get("arm64") as string;

    const authoring = join(temporary, "authoring");
    const packageHome = join(temporary, "package-home");
    writableDirectory(authoring);
    writableDirectory(packageHome);
    writeRegistryQualificationFixture(authoring, options.root);
    rootformRun({
      architecture: "amd64",
      arguments: [
        "package",
        "dialects",
        "dialect-source",
        "--to",
        "dialect-layout",
        "--source-url",
        "https://example.com/rootform/dialects",
        "--revision",
        "c".repeat(40),
        "--documentation-url",
        "https://example.com/rootform/dialects/docs",
        "--licenses",
        "Apache-2.0",
      ],
      home: packageHome,
      image: amdImage,
      network: "none",
      project: authoring,
    });
    rootformRun({
      architecture: "amd64",
      arguments: [
        "package",
        "policy-packs",
        "policy-source",
        "--to",
        "policy-layout",
        "--source-url",
        "https://example.com/rootform/policies",
        "--revision",
        "d".repeat(40),
        "--documentation-url",
        "https://example.com/rootform/policies/docs",
        "--licenses",
        "Apache-2.0",
      ],
      home: packageHome,
      image: amdImage,
      network: "none",
      project: authoring,
    });

    const dialectLayout = join(authoring, "dialect-layout");
    const policyLayout = join(authoring, "policy-layout");
    const dialectTag = `dialect-${DIALECT_OWNER}-${DIALECT_VERSION}`;
    const policyTag = `policy-pack-${POLICY_PACK_NAME}-${POLICY_PACK_VERSION}`;
    const dialectPin = readPackagePin(dialectLayout, dialectTag, "dialect");
    const policyPin = readPackagePin(policyLayout, policyTag, "policy-pack");

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
      `/CN=${REGISTRY_HOST}`,
      "-addext",
      `subjectAltName=DNS:${REGISTRY_HOST},DNS:localhost,IP:127.0.0.1`,
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
      registry,
      "--network",
      network,
      "--network-alias",
      REGISTRY_HOST,
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
    registryCreated = true;
    waitForRegistry(registry);
    const port = registryPort(registry);
    const hostRepository = `127.0.0.1:${port}/acme/rootform-qualification`;
    publishLayoutTag({
      ca,
      destination: hostRepository,
      layout: dialectLayout,
      oras: options.oras,
      tag: dialectTag,
    });
    publishLayoutTag({
      ca,
      destination: hostRepository,
      layout: policyLayout,
      oras: options.oras,
      tag: policyTag,
    });

    const project = join(temporary, "project");
    const home = join(temporary, "home");
    writableDirectory(project);
    writableDirectory(home);
    writeRegistryQualificationProject(project);
    writeFileSync(
      join(project, "rootform.lock"),
      encodeSelectionLock(REGISTRY_REPOSITORY, dialectPin, policyPin),
      {
        flag: "wx",
        mode: 0o644,
      },
    );
    const lockDigest = sha256(readFileSync(join(project, "rootform.lock")));
    parseJson(
      rootformRun({
        architecture: "arm64",
        arguments: ["init", ".", "--locked", "--no-input", "--format", "json"],
        ca,
        home,
        image: armImage,
        network,
        project,
        projectReadOnly: true,
      }).stdout,
      "third-party init result",
    );
    requireRegularFile(
      join(home, "dialects", DIALECT_OWNER, DIALECT_VERSION, "dialect.rf.hcl"),
      "installed third-party Dialect",
    );
    requireRegularFile(
      join(home, "policy-packs", POLICY_PACK_NAME, POLICY_PACK_VERSION, "pack.rf.hcl"),
      "installed Policy Pack",
    );
    if (sha256(readFileSync(join(project, "rootform.lock"))) !== lockDigest) {
      throw new Error("third-party init changed rootform.lock");
    }
    for (const architecture of IMAGE_PLATFORMS) {
      const image = tags.get(architecture) as string;
      const architectureBody = rootformRun({
        architecture,
        arguments: [
          "run",
          "plan.json",
          "--project",
          ".",
          "--locked",
          "--policy",
          `${POLICY_PACK_NAME}/*`,
          "--no-serve",
          "--format",
          "json",
        ],
        home,
        image,
        network: "none",
        project,
        projectReadOnly: true,
      }).stdout;
      assertArchitecture(
        architectureBody,
        DIALECT_OWNER,
        "portable_service",
        "third-party architecture",
      );
      const policyPath = join(home, `results-${architecture}.sarif`);
      rootformRun({
        architecture,
        arguments: [
          "run",
          "plan.json",
          "--project",
          ".",
          "--locked",
          "--policy",
          `${POLICY_PACK_NAME}/*`,
          "--no-serve",
          "-o",
          `/home/rootform/.rootform/results-${architecture}.sarif`,
        ],
        home,
        image,
        network: "none",
        project,
        projectReadOnly: true,
      });
      assertPolicySARIF(policyPath, "third-party Policy result");
    }

    rootformRun({
      architecture: "amd64",
      arguments: ["vendor", "dialects"],
      ca,
      home,
      image: amdImage,
      network,
      project,
    });
    rootformRun({
      architecture: "amd64",
      arguments: ["vendor", "policy-packs"],
      ca,
      home,
      image: amdImage,
      network,
      project,
    });
    requireRegularFile(
      join(project, ".rootform", "dialects", DIALECT_OWNER, "dialect.rf.hcl"),
      "vendored Dialect",
    );
    requireRegularFile(
      join(project, ".rootform", "policy-packs", POLICY_PACK_NAME, "pack.rf.hcl"),
      "vendored Policy Pack",
    );
    const vendorHome = join(temporary, "vendor-home");
    writableDirectory(vendorHome);
    rootformRun({
      architecture: "amd64",
      arguments: [
        "run",
        "plan.json",
        "--project",
        ".",
        "--locked",
        "--policy",
        `${POLICY_PACK_NAME}/*`,
        "--no-serve",
        "-o",
        "/home/rootform/.rootform/vendor-results.sarif",
      ],
      home: vendorHome,
      image: amdImage,
      network: "none",
      project,
      projectReadOnly: true,
    });
    assertPolicySARIF(join(vendorHome, "vendor-results.sarif"), "vendored offline Policy result");

    const suppliedProject = join(temporary, "supplied-project");
    writeSuppliedDialectProject(suppliedProject);
    cpSync(
      join(import.meta.dir, "fixtures", "aws-subnet-plan.json"),
      join(suppliedProject, "plan.json"),
    );
    const registryRequestsBefore = registryCompletedRequestCount(
      `${execute(["docker", "logs", registry]).stdout}\n${execute(["docker", "logs", registry]).stderr}`,
    );
    for (const architecture of IMAGE_PLATFORMS) {
      const suppliedHome = join(temporary, `supplied-home-${architecture}`);
      writableDirectory(suppliedHome);
      const result = rootformRun({
        architecture,
        arguments: [
          "run",
          "plan.json",
          "--project",
          ".",
          "--locked",
          "--no-serve",
          "--format",
          "json",
        ],
        home: suppliedHome,
        image: tags.get(architecture) as string,
        network: "none",
        project: suppliedProject,
        projectReadOnly: true,
      });
      assertArchitecture(result.stdout, "aws", "aws_subnet", "supplied architecture");
      if (existsSync(join(suppliedHome, "dialects"))) {
        throw new Error("supplied Dialects were installed into ROOTFORM_HOME");
      }
    }
    const registryLogs = execute(["docker", "logs", registry]);
    const registryRequestsAfter = registryCompletedRequestCount(
      `${registryLogs.stdout}\n${registryLogs.stderr}`,
    );
    if (registryRequestsAfter !== registryRequestsBefore) {
      throw new Error("supplied Dialect execution contacted registry");
    }

    docker([
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      "--entrypoint",
      "/bin/sh",
      amdImage,
      "-eu",
      "-c",
      `test "$(id -u):$(id -g)" = 65532:65532
test "$HOME" = /home/rootform
test "$ROOTFORM_HOME" = /home/rootform/.rootform
command -v sh >/dev/null
command -v grep >/dev/null
test -s /etc/ssl/cert.pem || test -s /etc/ssl/certs/ca-certificates.crt
for forbidden in wget curl git terraform tofu gcc go; do ! command -v "$forbidden" >/dev/null 2>&1; done
test -f /usr/local/share/rootform/ROOTFORM-BINARY-LICENSE.txt
test -f /usr/local/share/rootform/THIRD_PARTY_NOTICES.txt
test -f /usr/local/share/rootform/rootform_${options.version}_sbom.spdx.json
test "$(find /usr/local/share/rootform -type f | wc -l)" -eq 3`,
    ]);

    const reports: Record<string, { high_critical: number; medium_low: number }> = {};
    for (const [position, architecture] of IMAGE_PLATFORMS.entries()) {
      const high = join(dirname(options.evidence), `trivy-${architecture}-high-critical.json`);
      const low = join(dirname(options.evidence), `trivy-${architecture}-medium-low.json`);
      run([
        options.trivy,
        "image",
        ...(position === 0 ? [] : ["--skip-db-update"]),
        "--scanners",
        "vuln",
        "--ignorefile",
        join(options.root, ".trivyignore.yaml"),
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
      format_version: "1",
      platforms: IMAGE_PLATFORMS.map((architecture) => `linux/${architecture}`),
      podman: qualifyPodman(archive, options.version),
      release_set: {
        supplied_dialects_embedded: true,
        supplied_dialects_installed: false,
        supplied_execution_registry_requests: 0,
      },
      scenarios: {
        default_non_root: "65532:65532",
        exact_digest_acquisition: true,
        lock_preserved: true,
        offline_network_none: true,
        read_only_cap_drop_no_new_privileges: true,
        supplied_release_set_offline: true,
        third_party_dialect_package: true,
        third_party_policy_pack_package: true,
        vendor_offline: true,
        workspace_read_only: true,
      },
      third_party: {
        dialect: {
          content_digest: dialectPin.contentDigest,
          layer_digest: dialectPin.layerDigest,
          manifest_digest: dialectPin.manifestDigest,
          owner: DIALECT_OWNER,
          tag: dialectTag,
          version: DIALECT_VERSION,
        },
        policy_pack: {
          content_digest: policyPin.contentDigest,
          layer_digest: policyPin.layerDigest,
          manifest_digest: policyPin.manifestDigest,
          name: POLICY_PACK_NAME,
          tag: policyTag,
          version: POLICY_PACK_VERSION,
        },
        repository: REGISTRY_REPOSITORY,
      },
      version: options.version,
    };
    writeFileSync(options.evidence, `${JSON.stringify(evidence, null, 2)}\n`, {
      flag: "wx",
      mode: 0o644,
    });
  } finally {
    if (registryCreated) execute(["docker", "rm", "--force", registry]);
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
