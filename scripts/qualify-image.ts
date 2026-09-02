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

type PodmanEvidence = {
  architecture?: string;
  reason?: string;
  status: "passed" | "unavailable";
};

type PublicationEvidence = {
  artifacts: Array<{ name: string; version: string }>;
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

function rootformRun(options: {
  architecture: ImageArchitecture;
  arguments: string[];
  ca?: string;
  home: string;
  image: string;
  network: string;
  project: string;
  projectReadOnly?: boolean;
  user?: string;
}): CommandResult {
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
  if (options.ca) {
    arguments_.push(
      "--volume",
      dockerMount(options.ca, "/run/rootform-ca.crt", true),
      "--env",
      "SSL_CERT_FILE=/run/rootform-ca.crt",
    );
  }
  arguments_.push(options.image, "rootform", ...options.arguments);
  return docker(arguments_);
}

function waitForRegistry(container: string): void {
  for (let attempt = 0; attempt < 120; attempt++) {
    const logs = execute(["docker", "logs", container]);
    if (`${logs.stdout}\n${logs.stderr}`.includes("listening on")) return;
    Bun.sleepSync(250);
  }
  throw new Error("ephemeral registry did not become ready");
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
  const registry = `rootform-registry-${suffix}`;
  const runContainer = `rootform-run-${suffix}`;
  const tags = new Map<ImageArchitecture, string>();
  let networkCreated = false;
  let registryCreated = false;
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
      "subjectAltName=DNS:ghcr.io,DNS:localhost,IP:127.0.0.1",
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
    registryCreated = true;
    waitForRegistry(registry);
    const endpoint = docker(["port", registry, "443/tcp"]).stdout.trim().split(/\r?\n/u)[0] ?? "";
    const port = endpoint.match(/:([1-9][0-9]{0,4})$/u)?.[1];
    if (!port) throw new Error("ephemeral registry has no loopback port");

    const registryConfig = join(temporary, "registry-config.json");
    const publicationPath = join(temporary, "dialect-publication.json");
    writeFileSync(registryConfig, "{}\n", { flag: "wx", mode: 0o600 });
    run(
      [
        "bun",
        "scripts/publish.ts",
        "--rootform-version",
        options.version,
        "--test-repository",
        `127.0.0.1:${port}/rootform-dev/dialects`,
        "--ca-file",
        ca,
        "--registry-config",
        registryConfig,
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
    requireDirectory(join(coldHome, "dialects", "aws", options.version), "installed AWS dialect");
    const lockDigest = sha256(readFileSync(lockPath));

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
    requireDirectory(join(pinnedHome, "dialects", "aws", options.version), "pinned AWS dialect");
    const registryLogs = docker(["logs", "--since", since, registry]);
    const pinnedLogs = `${registryLogs.stdout}\n${registryLogs.stderr}`;
    if (pinnedLogs.includes(INDEX_TAG) || !pinnedLogs.includes("/manifests/sha256:")) {
      throw new Error("locked empty-store acquisition consulted mutable discovery");
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
      join(arbitraryHome, "dialects", "aws", options.version),
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
        index_manifest_digest: publication.index.manifest_digest,
        repository: OFFICIAL_DIALECT_REPOSITORY,
        tls: true,
      },
      format_version: "1",
      platforms: IMAGE_PLATFORMS.map((architecture) => `linux/${architecture}`),
      podman,
      scenarios: {
        arbitrary_uid_with_writable_mounts: true,
        cold_init_build_check_run: true,
        default_non_root: "65532:65532",
        gitlab_shell_injection: true,
        locked_direct_pins_without_index: true,
        offline_network_none: true,
        read_only_cap_drop_no_new_privileges: true,
        unsupported_provider_explicit: true,
        vendor_exclusive: true,
        workspace_read_only: true,
      },
      version: options.version,
    };
    writeFileSync(options.evidence, `${JSON.stringify(evidence, null, 2)}\n`, {
      flag: "wx",
      mode: 0o644,
    });
  } finally {
    if (runCreated) execute(["docker", "rm", "--force", runContainer]);
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
