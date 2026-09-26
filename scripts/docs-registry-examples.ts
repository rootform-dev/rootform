#!/usr/bin/env bun

import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { markedCommand } from "./docs-core-examples.ts";

export const registryMarkers = [
  "external-content-2",
  "external-add-oci",
  "external-update-oci",
  "docs-dialect-authoring-4",
  "authoring-add-published",
  "docs-language-write-policy-pack-4",
  "policy-authoring-add-published",
] as const;

type Options = { binary: string; registry: string; caFile: string };
type Result = { stdout: string; stderr: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs registry: ${message}`);
}

function parseArguments(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index++) {
    const argument = args[index] ?? "";
    const match = /^--(rootform-bin|registry|ca-file)(?:=(.*))?$/u.exec(argument);
    assert(match, `unknown argument ${argument}`);
    const name = match[1] as string;
    assert(!values.has(name), `duplicate --${name}`);
    const value = match[2] ?? args[++index];
    assert(value && !value.startsWith("--"), `--${name} requires a value`);
    values.set(name, value);
  }
  for (const name of ["rootform-bin", "registry", "ca-file"]) {
    assert(values.has(name), `--${name} is required`);
  }
  const binary = values.get("rootform-bin") as string;
  const registry = values.get("registry") as string;
  const caFile = values.get("ca-file") as string;
  assert(
    isAbsolute(binary) && basename(binary) === "rootform",
    "binary must be an absolute rootform path",
  );
  assert(existsSync(binary), `binary missing: ${binary}`);
  assert(/^[a-z0-9.-]+(?::[0-9]+)?$/u.test(registry), "registry must be host:port");
  assert(existsSync(caFile), `CA file missing: ${caFile}`);
  return { binary, registry, caFile: resolve(caFile) };
}

function digestOf(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const digest = digestOf(item);
      if (digest) return digest;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.manifest_digest === "string") return record.manifest_digest;
  for (const item of Object.values(record)) {
    const digest = digestOf(item);
    if (digest) return digest;
  }
  return undefined;
}

function lockEntry(project: string, family: "dialects" | "policy_packs", name: string) {
  const lock = JSON.parse(readFileSync(join(project, "rootform.lock"), "utf8"));
  const entries = lock[family] as Array<Record<string, unknown>>;
  return entries?.find((entry) => entry.owner === name || entry.name === name);
}

function pinnedDigest(entry: Record<string, unknown> | undefined): string | undefined {
  const source = entry?.source as { oci?: { manifest_digest?: string } } | undefined;
  return source?.oci?.manifest_digest;
}

function publishedDigest(output: string): string {
  const digest = /^ {2}Digest {4}(sha256:[0-9a-f]{64})$/mu.exec(output)?.[1];
  assert(digest, `publish output has no digest: ${output}`);
  return digest;
}

export function verifyRegistryExamples(options: Options): string[] {
  const root = resolve(import.meta.dir, "..");
  const scratch = join(root, "..", "notes", "tmp");
  mkdirSync(scratch, { recursive: true });
  const workspace = mkdtempSync(join(scratch, "docs-registry-"));
  const prefix = `docs-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const registryBase = `${options.registry}/${prefix}`;
  const docker = join(workspace, "docker");
  mkdirSync(docker);
  writeFileSync(join(docker, "config.json"), "{}\n");
  /* Pages call "rootform" by name. A directory holding only a link to the
     binary under test keeps an older rootform elsewhere on PATH out of reach. */
  const tools = join(workspace, "bin");
  mkdirSync(tools);
  symlinkSync(options.binary, join(tools, "rootform"));
  const page = (path: string) => readFileSync(join(root, "docs", path), "utf8");
  const home = (name: string) => {
    const path = join(workspace, "homes", name);
    mkdirSync(path, { recursive: true });
    return path;
  };
  const environment = (name: string) => ({
    ...process.env,
    ROOTFORM_HOME: home(name),
    ROOTFORM_INPUT: "0",
    DOCKER_CONFIG: docker,
    SSL_CERT_FILE: options.caFile,
    PATH: `${tools}:${process.env.PATH ?? ""}`,
    NO_COLOR: "1",
  });
  function run(command: string[], cwd: string, homeName: string, expected = 0): Result {
    const result = Bun.spawnSync(command, {
      cwd,
      env: environment(homeName),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    });
    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();
    assert(
      result.exitCode === expected,
      `${command.join(" ")} exited ${result.exitCode}, expected ${expected}\n${stdout}${stderr}`,
    );
    return { stdout, stderr };
  }
  function marked(
    document: string,
    marker: (typeof registryMarkers)[number],
    cwd: string,
    homeName: string,
  ) {
    // Substitute only the docs' illustrative registry hosts. The marked shell
    // block, including all remaining arguments and commands, runs verbatim.
    const command = markedCommand(page(document), marker)
      .replaceAll("registry.example.com/", `${registryBase}/`)
      .replaceAll("registry.example/", `${registryBase}/`);
    return run(["sh", "-eu", "-c", command], cwd, homeName);
  }
  function project(name: string, source: string): string {
    const path = join(workspace, name);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "main.tf"), source);
    return path;
  }
  function payments(destination: string, version: string): void {
    mkdirSync(destination, { recursive: true });
    cpSync(
      join(root, "dialects/secrets/presentation.json"),
      join(destination, "presentation.json"),
    );
    const declaration = readFileSync(join(root, "dialects/secrets/dialect.rf.hcl"), "utf8");
    assert(
      declaration.includes('dialect "secrets"') && declaration.includes('version = "0.1.0"'),
      "payments fixture changed",
    );
    writeFileSync(
      join(destination, "dialect.rf.hcl"),
      declaration
        .replace('dialect "secrets"', 'dialect "payments"')
        .replace('version = "0.1.0"', `version = "${version}"`),
    );
  }
  const provenance = [
    "--source-url",
    "https://example.com/team/rootform",
    "--revision",
    "0000000000000000000000000000000000000000",
    "--documentation-url",
    "https://example.com/team/rootform/docs",
    "--licenses",
    "MPL-2.0",
  ];
  function packageAndPublish(
    family: "dialects" | "policy-packs",
    source: string,
    layout: string,
    repository: string,
  ): string {
    run(
      [options.binary, "package", family, source, "--to", layout, ...provenance],
      workspace,
      "setup",
    );
    const published = run(
      [options.binary, "publish", family, layout, "--to", repository, "--format", "json"],
      workspace,
      "setup",
    );
    const digest = digestOf(JSON.parse(published.stdout));
    assert(
      digest && /^sha256:[0-9a-f]{64}$/u.test(digest),
      `publication at ${repository} has no manifest digest`,
    );
    return digest;
  }
  const main = readFileSync(
    join(root, "examples/playground/commerce-platform/base/main.tf"),
    "utf8",
  );
  const checks: string[] = [];
  try {
    const paymentRepository = `${registryBase}/acme/rootform/payments`;
    const baselineRepository = `${registryBase}/acme/rootform/baseline`;
    const seed = join(workspace, "seed");
    mkdirSync(seed);
    const paymentDigests = new Map<string, string>();
    for (const version of ["0.1.0", "0.2.0"]) {
      const source = join(seed, `payments-${version}`);
      payments(source, version);
      paymentDigests.set(
        version,
        packageAndPublish("dialects", source, join(seed, `oci-${version}`), paymentRepository),
      );
    }
    const baseline = join(seed, "baseline");
    cpSync(join(root, "policy-packs/baseline"), baseline, { recursive: true });
    const baselineDigest = packageAndPublish(
      "policy-packs",
      baseline,
      join(seed, "baseline-oci"),
      baselineRepository,
    );

    const installedProject = project("install-only", main);
    const installed = marked(
      "concepts/external-content.md",
      "external-content-2",
      installedProject,
      "install-only",
    );
    assert(
      installed.stdout.includes("payments") && installed.stdout.includes("0.1.0"),
      "install did not report owner and version",
    );
    assert(
      existsSync(join(home("install-only"), "dialects/payments/0.1.0")),
      "install did not populate Rootform home",
    );
    assert(
      !existsSync(join(installedProject, "rootform.lock")),
      "install changed project selection",
    );
    checks.push("external-content-2 installed payments without selecting it");

    const selection = project("selection", main);
    const added = marked("guides/external-content.md", "external-add-oci", selection, "selection");
    assert(
      (added.stdout.match(/rootform.lock updated/gu) ?? []).length === 2,
      "add did not report two lock changes",
    );
    const firstDialect = lockEntry(selection, "dialects", "payments");
    const firstPack = lockEntry(selection, "policy_packs", "baseline");
    assert(
      pinnedDigest(firstDialect) === paymentDigests.get("0.1.0"),
      "Dialect lock omitted published digest",
    );
    assert(pinnedDigest(firstPack) === baselineDigest, "Policy Pack lock omitted published digest");
    assert(
      existsSync(join(home("selection"), "dialects/payments/0.1.0")) &&
        existsSync(join(home("selection"), "policy-packs/baseline/0.1.0")),
      "add did not install both units",
    );
    const originalLock = readFileSync(join(selection, "rootform.lock"));
    const repeated = run(
      [options.binary, "add", "dialects", `${paymentRepository}:dialect-payments-0.1.0`],
      selection,
      "selection",
    );
    assert(
      repeated.stdout.includes("rootform.lock already matches; nothing changed") &&
        readFileSync(join(selection, "rootform.lock")).equals(originalLock),
      "repeated add changed lock",
    );
    checks.push("external-add-oci selected digest-pinned Dialect and Policy Pack");

    const updated = marked(
      "guides/external-content.md",
      "external-update-oci",
      selection,
      "selection",
    );
    const nextDialect = lockEntry(selection, "dialects", "payments");
    assert(
      updated.stdout.includes("rootform.lock updated") &&
        pinnedDigest(nextDialect) === paymentDigests.get("0.2.0") &&
        pinnedDigest(nextDialect) !== pinnedDigest(firstDialect),
      "update did not move version and digest",
    );
    assert(
      nextDialect?.version === "0.2.0" &&
        existsSync(join(home("selection"), "dialects/payments/0.2.0")),
      "updated version was not installed",
    );
    checks.push("external-update-oci moved payments to version 0.2.0 and its digest");

    const dialectAuthoring = project("dialect-authoring", main);
    payments(join(dialectAuthoring, "dialects/payments"), "0.1.0");
    run(
      [
        options.binary,
        "package",
        "dialects",
        "./dialects/payments",
        "--to",
        "artifacts/oci",
        ...provenance,
      ],
      dialectAuthoring,
      "authoring-package",
    );
    const dialectPublished = marked(
      "dialect-authoring.md",
      "docs-dialect-authoring-4",
      dialectAuthoring,
      "authoring-publish",
    );
    assert(
      dialectPublished.stdout.includes("Published dialect payments@0.1.0") &&
        dialectPublished.stdout.includes(`${registryBase}/team/dialects`),
      `Dialect publish omitted identity and digest: ${dialectPublished.stdout}${dialectPublished.stderr}`,
    );
    const dialectPublishDigest = publishedDigest(dialectPublished.stdout);
    mkdirSync(join(dialectAuthoring, "infra"));
    writeFileSync(join(dialectAuthoring, "infra/main.tf"), main);
    const authoringAdd = marked(
      "dialect-authoring.md",
      "authoring-add-published",
      dialectAuthoring,
      "authoring-consumer",
    );
    assert(
      authoringAdd.stdout.includes("rootform.lock updated"),
      "published Dialect was not selected",
    );
    const authoringProject = join(dialectAuthoring, "infra");
    const authoringDigest = pinnedDigest(lockEntry(authoringProject, "dialects", "payments"));
    assert(
      authoringDigest === dialectPublishDigest,
      "published Dialect selection differs from published digest",
    );
    const dialectLock = readFileSync(join(authoringProject, "rootform.lock"));
    run(
      [options.binary, "init", ".", "--locked", "--no-input"],
      authoringProject,
      "authoring-fresh",
    );
    assert(
      existsSync(join(home("authoring-fresh"), "dialects/payments/0.1.0")) &&
        readFileSync(join(authoringProject, "rootform.lock")).equals(dialectLock),
      "fresh Dialect init failed to restore exact selection",
    );
    checks.push(
      "docs-dialect-authoring-4 and authoring-add-published published, selected, and restored payments",
    );

    const policyAuthoring = join(workspace, "policy-authoring");
    mkdirSync(policyAuthoring);
    cpSync(join(root, "policy-packs/baseline"), join(policyAuthoring, "baseline"), {
      recursive: true,
    });
    run(
      [
        options.binary,
        "package",
        "policy-packs",
        "./baseline",
        "--to",
        "./artifacts/policies",
        ...provenance,
      ],
      policyAuthoring,
      "policy-package",
    );
    const policyPublished = marked(
      "language/write-policy-pack.md",
      "docs-language-write-policy-pack-4",
      policyAuthoring,
      "policy-publish",
    );
    assert(
      policyPublished.stdout.includes("Published Policy Pack baseline@0.1.0") &&
        policyPublished.stdout.includes(`${registryBase}/team/policy-packs`),
      `Policy Pack publish omitted identity and digest: ${policyPublished.stdout}${policyPublished.stderr}`,
    );
    const policyPublishDigest = publishedDigest(policyPublished.stdout);
    const policyProject = join(policyAuthoring, "infra");
    mkdirSync(policyProject);
    writeFileSync(
      join(policyProject, "main.tf"),
      'terraform {\n  required_providers {\n    google = {\n      source  = "hashicorp/google"\n      version = "= 8.0.0"\n    }\n  }\n}\n\nresource "google_compute_network" "main" {\n  name = "main"\n}\n\nresource "google_container_cluster" "example" {\n  name    = "example"\n  network = google_compute_network.main.id\n}\n\nresource "google_sql_database_instance" "example" {\n  name = "example"\n  settings {\n    ip_configuration {\n      private_network = google_compute_network.main.id\n    }\n  }\n}\n',
    );
    const policyAdd = marked(
      "language/write-policy-pack.md",
      "policy-authoring-add-published",
      policyAuthoring,
      "policy-consumer",
    );
    assert(
      policyAdd.stdout.includes("rootform.lock updated"),
      "published Policy Pack was not selected",
    );
    const policyDigest = pinnedDigest(lockEntry(policyProject, "policy_packs", "baseline"));
    assert(
      policyDigest === policyPublishDigest,
      "published Policy Pack selection differs from published digest",
    );
    const policyLock = readFileSync(join(policyProject, "rootform.lock"));
    run([options.binary, "init", ".", "--locked", "--no-input"], policyProject, "policy-fresh");
    assert(
      existsSync(join(home("policy-fresh"), "policy-packs/baseline/0.1.0")) &&
        readFileSync(join(policyProject, "rootform.lock")).equals(policyLock),
      "fresh Policy Pack init failed to restore exact selection",
    );
    checks.push(
      "docs-language-write-policy-pack-4 and policy-authoring-add-published published, selected, and restored baseline",
    );
    return checks;
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const checks = verifyRegistryExamples(parseArguments(Bun.argv.slice(2)));
  for (const check of checks) console.log(check);
  console.log(`${registryMarkers.length}/${registryMarkers.length} registry markers verified`);
}
