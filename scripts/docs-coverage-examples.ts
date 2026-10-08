#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import {
  assertExportScripts,
  explorerModuleEntrypoint,
  readLocalModuleGraph,
} from "./renderer-runtime-proof.ts";

type Probe = {
  address: string;
  kind: "managed" | "data";
  name: string;
  provider: "registry.terraform.io/hashicorp/aws" | "registry.terraform.io/acme/unbound";
  providerKey: "aws" | "unbound";
  type: string;
};

const probes: Probe[] = [
  {
    address: "aws_unmodeled_coverage.bound_resource",
    kind: "managed",
    name: "bound_resource",
    provider: "registry.terraform.io/hashicorp/aws",
    providerKey: "aws",
    type: "aws_unmodeled_coverage",
  },
  {
    address: "data.aws_unmodeled_coverage.bound_lookup",
    kind: "data",
    name: "bound_lookup",
    provider: "registry.terraform.io/hashicorp/aws",
    providerKey: "aws",
    type: "aws_unmodeled_coverage",
  },
  {
    address: "acme_unbound_service.unbound_resource",
    kind: "managed",
    name: "unbound_resource",
    provider: "registry.terraform.io/acme/unbound",
    providerKey: "unbound",
    type: "acme_unbound_service",
  },
  {
    address: "data.acme_unbound_lookup.unbound_lookup",
    kind: "data",
    name: "unbound_lookup",
    provider: "registry.terraform.io/acme/unbound",
    providerKey: "unbound",
    type: "acme_unbound_lookup",
  },
];

const emptyLock = {
  format_version: "1",
  dialects: [],
  policy_packs: [],
  excluded_owners: [],
  replacements: [],
};

type SemanticProvider = { source: string; hosts: string[] };
type SemanticOwner = { id: string; providers?: SemanticProvider[] };
type Declaration = {
  id: string;
  address: string;
  kind: string;
  type: string;
  population: { status: string; instances: number };
};
type Representation = {
  address: string;
  kind: string;
  provider?: { address: string };
  interpretation?: { status: string; candidates: string[] };
  rule?: string | null;
  concept?: string | null;
};
type Dependency = { from: string; to: string; roles: string[] };
type Architecture = {
  stage: string;
  declarations: Declaration[];
  representations: Representation[];
  contexts: unknown[];
  relations: unknown[];
  contributions: unknown[];
  closures: unknown[];
  dependencies: Dependency[];
  accounting: {
    instances: number;
    managed_instances: number;
    data_instances: number;
    uninterpreted_instances: number;
  };
};
type CoverageDocument = {
  format_version?: string;
  kind?: string;
  default_stage?: string;
  evidence?: { origin?: string; input_format_version?: string };
  semantics?: {
    owners?: SemanticOwner[];
    selection?: { active_owners?: string[] };
  };
  stages?: { planned?: Architecture; recorded?: Architecture };
  comparisons?: unknown;
  drift_report?: unknown;
};
type PresentationCatalog = { format_version?: string };
type CoverageModel = {
  counts: {
    instances: number;
    managed: number;
    data: number;
    uninterpreted: number;
    dependencies: number;
    contexts: number;
    relations: number;
    contributions: number;
  };
  representations: Array<{
    address: string;
    kind: string;
    provider: string;
    interpretation?: string;
    candidates?: number;
    rule: string | null;
    concept: string | null;
  }>;
};

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Docs coverage: ${message}`);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readExplorerAddress(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async (): Promise<string> => {
    let received = "";
    while (true) {
      const next = await reader.read();
      if (next.value) received += decoder.decode(next.value, { stream: true });
      assert(received.length <= 65_536, "Explorer address output exceeded the probe limit");
      for (const match of received.matchAll(/http:\/\/127\.0\.0\.1:(\d{1,5})(?=[/\s]|$)/gu)) {
        const port = Number(match[1]);
        if (port >= 1 && port <= 65_535) return match[0];
      }
      assert(!next.done, "rootform run stopped before publishing its loopback address");
    }
  };
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("rootform run did not publish a loopback address")),
      15_000,
    );
  });
  try {
    return await Promise.race([read(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    reader.releaseLock();
  }
}

function syntheticPlan(): Record<string, unknown> {
  const plannedResources = probes.map((probe) => {
    const values: Record<string, unknown> = { id: `synthetic-${probe.name}` };
    if (probe.name === "bound_resource") values.source_ref = "synthetic-unbound-target";
    return {
      address: probe.address,
      mode: probe.kind === "data" ? "data" : "managed",
      type: probe.type,
      name: probe.name,
      provider_name: probe.provider,
      schema_version: 0,
      values,
    };
  });
  const changes = plannedResources.map((resource) => ({
    address: resource.address,
    mode: resource.mode,
    type: resource.type,
    name: resource.name,
    provider_name: resource.provider_name,
    change: {
      actions: resource.mode === "data" ? ["read"] : ["create"],
      before: null,
      after: resource.values,
      after_unknown: {},
      before_sensitive: false,
      after_sensitive: false,
    },
  }));
  const configuredResources = probes.map((probe) => ({
    address: probe.address,
    mode: probe.kind === "data" ? "data" : "managed",
    type: probe.type,
    name: probe.name,
    provider_config_key: probe.providerKey,
    schema_version: 0,
    expressions:
      probe.name === "bound_resource"
        ? { source_ref: { references: ["acme_unbound_service.unbound_resource.id"] } }
        : {},
  }));

  return {
    format_version: "1.2",
    terraform_version: "1.12.2",
    planned_values: { root_module: { resources: plannedResources } },
    resource_changes: changes,
    configuration: {
      provider_config: {
        aws: {
          name: "aws",
          full_name: "registry.terraform.io/hashicorp/aws",
          version_constraint: "6.62.0",
          expressions: {},
        },
        unbound: {
          name: "unbound",
          full_name: "registry.terraform.io/acme/unbound",
          version_constraint: "1.2.3",
          expressions: {},
        },
      },
      root_module: { resources: configuredResources },
    },
    timestamp: "2026-10-03T12:00:00Z",
    applyable: true,
    complete: true,
    errored: false,
  };
}

function syntheticState(): Record<string, unknown> {
  return {
    format_version: "1.0",
    terraform_version: "1.12.2",
    values: {
      root_module: {
        resources: probes.map((probe) => ({
          address: probe.address,
          mode: probe.kind === "data" ? "data" : "managed",
          type: probe.type,
          name: probe.name,
          provider_name: probe.provider,
          schema_version: 0,
          values: { id: `synthetic-${probe.name}` },
        })),
      },
      root_outputs: {},
    },
  };
}

function assertCoverageDocument(
  document: CoverageDocument,
  label: string,
  kind: "plan" | "state" = "plan",
  stageName: "planned" | "recorded" = "planned",
  requireDependency = false,
): CoverageModel {
  assert(
    document.format_version === "1" && document.kind === kind,
    `${label}: expected a format-1 ${kind} Form`,
  );
  const stage = document.stages?.[stageName];
  assert(stage?.stage === stageName, `${label}: ${stageName} architecture is missing`);
  assert(Array.isArray(stage.declarations), `${label}: declarations are missing`);
  assert(Array.isArray(stage.representations), `${label}: Representations are missing`);
  if (kind === "state") {
    assert(
      document.evidence?.origin === "state" && document.evidence.input_format_version === "1.0",
      `${label}: state export evidence identity drifted`,
    );
    assert(document.default_stage === "recorded", `${label}: state default stage is not Recorded`);
    assert(
      Object.keys(document.stages ?? {}).join(",") === "recorded",
      `${label}: state Form must contain only the Recorded stage`,
    );
    assert(
      !document.comparisons && !document.drift_report,
      `${label}: state Form acquired plan reports`,
    );
  }

  const awsOwner = document.semantics?.owners?.find((owner) => owner.id === "aws");
  const awsProvider = awsOwner?.providers?.find(
    (provider) =>
      provider.source === "hashicorp/aws" &&
      Array.isArray(provider.hosts) &&
      provider.hosts.some((host) => host === "registry.terraform.io"),
  );
  assert(awsProvider, `${label}: the selected AWS Dialect no longer binds hashicorp/aws`);
  const selectedProviders = (document.semantics?.owners ?? []).flatMap((owner) =>
    (owner.providers ?? []).map((provider) => provider.source),
  );
  assert(!selectedProviders.includes("acme/unbound"), `${label}: synthetic provider became bound`);

  const declarations = new Map<string, Declaration>(
    stage.declarations.map((declaration) => [declaration.address, declaration] as const),
  );
  const representations = new Map<string, Representation>(
    stage.representations.map(
      (representation) => [representation.address, representation] as const,
    ),
  );
  assert(representations.size === probes.length, `${label}: expected four Representations`);

  for (const probe of probes) {
    const declaration = declarations.get(probe.address);
    const representation = representations.get(probe.address);
    assert(declaration, `${label}: declaration ${probe.address} is missing`);
    assert(representation, `${label}: Representation ${probe.address} is missing`);
    assert(
      declaration.kind === (probe.kind === "data" ? "data" : "resource"),
      `${label}: ${probe.address} has the wrong declaration kind`,
    );
    assert(
      declaration.type === probe.type,
      `${label}: ${probe.address} has the wrong Terraform type`,
    );
    assert(
      declaration.population?.status === "observed" && declaration.population.instances === 1,
      `${label}: ${probe.address} population is not observed`,
    );
    assert(
      representation.kind === probe.kind,
      `${label}: ${probe.address} has the wrong Representation kind`,
    );
    assert(
      representation.provider?.address === probe.provider,
      `${label}: ${probe.address} has the wrong provider identity`,
    );
    assert(
      representation.interpretation?.status === "none",
      `${label}: ${probe.address} unexpectedly has an interpretation`,
    );
    assert(
      representation.interpretation?.candidates?.length === 0,
      `${label}: ${probe.address} unexpectedly has Rule candidates`,
    );
    assert(
      !representation.rule && !representation.concept,
      `${label}: ${probe.address} acquired a Rule or Concept`,
    );
  }

  for (const field of ["contexts", "relations", "contributions", "closures"] as const) {
    assert(
      Array.isArray(stage[field]) && stage[field].length === 0,
      `${label}: unexpected ${field}`,
    );
  }
  assert(stage.accounting?.instances === probes.length, `${label}: instance accounting drifted`);
  assert(stage.accounting?.managed_instances === 2, `${label}: managed population count drifted`);
  assert(stage.accounting?.data_instances === 2, `${label}: data population count drifted`);
  assert(
    stage.accounting?.uninterpreted_instances === probes.length,
    `${label}: uninterpreted population count drifted`,
  );

  const dependency = stage.dependencies.find((item) => {
    const from = stage.declarations.find((declaration) => declaration.id === item.from);
    const to = stage.declarations.find((declaration) => declaration.id === item.to);
    return (
      from?.address === "aws_unmodeled_coverage.bound_resource" &&
      to?.address === "acme_unbound_service.unbound_resource" &&
      item.roles?.includes("reference")
    );
  });
  if (requireDependency) {
    assert(dependency, `${label}: source reference was not retained as dependency evidence`);
  }

  return {
    counts: {
      instances: stage.accounting.instances,
      managed: stage.accounting.managed_instances,
      data: stage.accounting.data_instances,
      uninterpreted: stage.accounting.uninterpreted_instances,
      dependencies: stage.dependencies.length,
      contexts: stage.contexts.length,
      relations: stage.relations.length,
      contributions: stage.contributions.length,
    },
    representations: probes.map((probe) => ({
      address: probe.address,
      kind: probe.kind,
      provider: probe.provider,
      interpretation: representations.get(probe.address)?.interpretation?.status,
      candidates: representations.get(probe.address)?.interpretation?.candidates?.length,
      rule: representations.get(probe.address)?.rule ?? null,
      concept: representations.get(probe.address)?.concept ?? null,
    })),
  };
}

async function readResponse(url: URL): Promise<{ body: string; contentType: string }> {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.text();
  assert(response.ok, `${url.pathname}: Explorer returned HTTP ${response.status}`);
  return { body, contentType: response.headers.get("content-type") ?? "" };
}

function embeddedJson(html: string, id: string): string {
  const marker = `<script id="${id}" type="application/json">`;
  const start = html.indexOf(marker);
  assert(start >= 0 && start === html.lastIndexOf(marker), `${id} must occur once in export`);
  const payloadStart = start + marker.length;
  const end = html.indexOf("</script>", payloadStart);
  assert(end >= 0, `${id} payload is unterminated`);
  const payload = html.slice(payloadStart, end);
  JSON.parse(payload);
  return payload;
}

function assertSelfContainedExport(html: string, workspace: string, binary: string): void {
  assert(/^\s*<!doctype html>/iu.test(html), "HTML export has no doctype");
  assertExportScripts(html);
  assert(
    !html.includes("rootform-document" + `" type="application/json">null`),
    "document placeholder survived export",
  );
  assert(
    !html.includes("rootform-presentation" + `" type="application/json">null`),
    "presentation placeholder survived export",
  );
  assert(!/<script\b[^>]*\bsrc=/iu.test(html), "HTML export references an external script");

  const resources = [
    ...html.matchAll(/<(?:link|img|iframe|source)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/giu),
  ];
  assert(
    resources.every(
      (match) => !/^https?:\/\//iu.test(match[1] ?? "") && !match[1]?.startsWith("//"),
    ),
    "HTML export references a remote resource",
  );
  assert(!html.includes(workspace), "HTML export leaked its local evidence path");
  assert(!html.includes(binary), "HTML export leaked its binary path");
  for (const probe of probes) {
    assert(
      !html.includes(`synthetic-${probe.name}`),
      `HTML export leaked a state value for ${probe.address}`,
    );
  }
}

export type DocsCoverageEvidence = {
  binary: { path: string; version: string; sha256: string };
  commands: {
    cwd: string;
    form: string[];
    state_and_html_export: string[];
    explorer: string[];
  };
  assertions: Record<string, unknown>;
  state_assertions: Record<string, unknown>;
  explorer: Record<string, unknown>;
  export: Record<string, unknown>;
  files: Record<string, string>;
  browser_interaction_verified: false;
};

/** Verify provider coverage claims with a real Rootform binary and Explorer. */
export async function verifyDocsCoverageExamples(
  binaryInput: string,
  evidenceDirectory?: string,
): Promise<DocsCoverageEvidence> {
  const binary = isAbsolute(binaryInput)
    ? resolve(binaryInput)
    : resolve(process.cwd(), binaryInput);
  const persistent = evidenceDirectory !== undefined;
  const workspace = persistent
    ? resolve(evidenceDirectory)
    : mkdtempSync(join(tmpdir(), "rootform-docs-coverage-"));
  const home = mkdtempSync(join(tmpdir(), "rootform-docs-coverage-home-"));
  const project = join(workspace, "project");
  const planPath = join(workspace, "synthetic-plan.json");
  const statePath = join(workspace, "synthetic-state.json");
  const formPath = join(workspace, "form.json");
  const stateFormPath = join(workspace, "state-form.json");
  const stateHtmlPath = join(workspace, "state-explorer.html");
  const explorerDir = join(workspace, "explorer");
  mkdirSync(project, { recursive: true });
  mkdirSync(explorerDir, { recursive: true });
  writeJson(join(project, "rootform.lock"), emptyLock);
  writeJson(planPath, syntheticPlan());
  writeJson(statePath, syntheticState());

  const env: Record<string, string> = {
    HOME: home,
    NO_COLOR: "1",
    PATH: process.env.PATH ?? "",
    ROOTFORM_HOME: home,
    ROOTFORM_OFFLINE: "1",
    TERM: "dumb",
  };
  const spawn = (args: string[]) =>
    Bun.spawnSync({
      cmd: [binary, ...args],
      cwd: workspace,
      env,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 60_000,
    });

  try {
    const versionResult = spawn(["version"]);
    assert(
      versionResult.exitCode === 0,
      `binary version failed: ${versionResult.stderr.toString()}`,
    );
    const version = versionResult.stdout.toString().trim();
    assert(/^rootform \S+$/u.test(version), `unexpected version output: ${version}`);

    const formArgs = ["run", planPath, "--project", project, "--no-serve", "-o", formPath];
    const formResult = spawn(formArgs);
    assert(
      formResult.exitCode === 0,
      `Form run failed (exit ${String(formResult.exitCode)}): ${formResult.stderr.toString()}${formResult.stdout.toString()}`,
    );
    const formBytes = readFileSync(formPath);
    const form = JSON.parse(formBytes.toString("utf8")) as CoverageDocument;
    const model = assertCoverageDocument(form, "Plan Form");

    const stateArgs = [
      "run",
      statePath,
      "--project",
      project,
      "--no-serve",
      "-o",
      stateFormPath,
      "-o",
      stateHtmlPath,
    ];
    const stateResult = spawn(stateArgs);
    assert(
      stateResult.exitCode === 0,
      `State run failed (exit ${String(stateResult.exitCode)}): ${stateResult.stderr.toString()}${stateResult.stdout.toString()}`,
    );
    const stateForm = JSON.parse(readFileSync(stateFormPath, "utf8")) as CoverageDocument;
    const stateModel = assertCoverageDocument(stateForm, "State Form", "state", "recorded");
    const stateHtml = readFileSync(stateHtmlPath, "utf8");
    assertSelfContainedExport(stateHtml, workspace, binary);
    const embeddedForm = JSON.parse(
      embeddedJson(stateHtml, "rootform-document"),
    ) as CoverageDocument;
    const embeddedModel = assertCoverageDocument(
      embeddedForm,
      "Explorer HTML embedded state",
      "state",
      "recorded",
    );
    const presentation = JSON.parse(
      embeddedJson(stateHtml, "rootform-presentation"),
    ) as PresentationCatalog;
    assert(presentation.format_version === "1", "Explorer HTML presentation is not format 1");

    const serverArgs = ["run", planPath, "--project", project, "--no-browser", "--port", "0"];
    const server = Bun.spawn([binary, ...serverArgs], {
      cwd: workspace,
      env,
      stderr: "pipe",
      stdout: "pipe",
    });
    try {
      assert(server.stderr instanceof ReadableStream, "Explorer stderr is unavailable");
      const address = await readExplorerAddress(server.stderr);
      const base = new URL(address);
      assert(
        base.protocol === "http:" && base.hostname === "127.0.0.1",
        "Explorer address is not loopback HTTP",
      );

      const documentResponse = await readResponse(new URL("/api/v1/document", base));
      const presentationResponse = await readResponse(new URL("/api/v1/presentation", base));
      assert(
        documentResponse.contentType.startsWith("application/json"),
        "document endpoint is not JSON",
      );
      assert(
        presentationResponse.contentType.startsWith("application/json"),
        "presentation endpoint is not JSON",
      );
      const display = JSON.parse(documentResponse.body) as CoverageDocument;
      const displayModel = assertCoverageDocument(display, "Explorer document endpoint");
      const livePresentation = JSON.parse(presentationResponse.body) as PresentationCatalog;
      assert(
        livePresentation.format_version === "1",
        "Explorer presentation catalog is not format 1",
      );

      const htmlResponse = await readResponse(base);
      assert(htmlResponse.contentType.startsWith("text/html"), "Explorer root is not HTML");
      assert(/^\s*<!doctype html>/iu.test(htmlResponse.body), "Explorer HTML shell has no doctype");
      assert(htmlResponse.body.includes('id="app"'), "Explorer HTML shell has no app mount");
      const scriptPath = explorerModuleEntrypoint(htmlResponse.body);
      const moduleGraph = await readLocalModuleGraph(new URL(scriptPath, base), readResponse);
      const clientResponse = { body: moduleGraph.get(new URL(scriptPath, base).href) ?? "" };
      assert(moduleGraph.size > 0, "Explorer client module graph is empty");
      const clientModules = [...moduleGraph.values()].join("\n");
      for (const endpoint of ["/api/v1/document", "/api/v1/presentation"])
        assert(
          clientModules.includes(endpoint),
          "Explorer client module graph lost a data endpoint",
        );

      writeFileSync(join(explorerDir, "document.json"), `${JSON.stringify(display, null, 2)}\n`);
      writeFileSync(
        join(explorerDir, "presentation.json"),
        `${JSON.stringify(livePresentation, null, 2)}\n`,
      );
      writeFileSync(join(explorerDir, "index.html"), htmlResponse.body);
      writeFileSync(join(explorerDir, "client.js"), clientResponse.body);

      const evidence: DocsCoverageEvidence = {
        binary: {
          path: binary,
          version,
          sha256: sha256(readFileSync(binary)),
        },
        commands: {
          cwd: workspace,
          form: [binary, ...formArgs],
          state_and_html_export: [binary, ...stateArgs],
          explorer: [binary, ...serverArgs],
        },
        assertions: {
          ...model,
          form_kind: form.kind,
          form_format_version: form.format_version,
          active_owners: form.semantics?.selection?.active_owners ?? [],
          bound_provider: "hashicorp/aws via selected aws Dialect",
          unbound_provider: "acme/unbound",
          source_reference_is_dependency_only: true,
        },
        state_assertions: {
          ...stateModel,
          form_kind: stateForm.kind,
          form_format_version: stateForm.format_version,
          input_origin: stateForm.evidence?.origin,
          input_format_version: stateForm.evidence?.input_format_version,
          default_stage: stateForm.default_stage,
          active_owners: stateForm.semantics?.selection?.active_owners ?? [],
          bound_provider: "hashicorp/aws via selected aws Dialect",
          unbound_provider: "acme/unbound",
        },
        explorer: {
          document_endpoint: "/api/v1/document",
          presentation_endpoint: "/api/v1/presentation",
          display_representation_count: displayModel.counts.instances,
          presentation_format_version: livePresentation.format_version,
          html_content_type: htmlResponse.contentType,
          html_script: scriptPath,
          client_requests_document: true,
          client_requests_presentation: true,
        },
        export: {
          path: stateHtmlPath,
          embedded_kind: embeddedForm.kind,
          embedded_stage: "recorded",
          embedded_representation_count: embeddedModel.counts.instances,
          presentation_format_version: presentation.format_version,
          self_contained: true,
          browser_interaction_verified: false,
        },
        files: {},
        browser_interaction_verified: false,
      };

      const files = [
        planPath,
        statePath,
        join(project, "rootform.lock"),
        formPath,
        stateFormPath,
        stateHtmlPath,
        join(explorerDir, "document.json"),
        join(explorerDir, "presentation.json"),
        join(explorerDir, "index.html"),
        join(explorerDir, "client.js"),
      ];
      for (const file of files) {
        const relativePath = file.slice(workspace.length + 1).replaceAll("\\", "/");
        evidence.files[relativePath] = sha256(readFileSync(file));
      }
      if (persistent) writeJson(join(workspace, "summary.json"), evidence);
      return evidence;
    } finally {
      if (server.exitCode === null) server.kill();
      await server.exited;
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
    if (!persistent) rmSync(workspace, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [binaryInput, evidenceInput] = process.argv.slice(2);
  if (!binaryInput) {
    throw new Error(
      "usage: bun run scripts/docs-coverage-examples.ts <rootform-binary> [evidence-directory]",
    );
  }
  const evidence = await verifyDocsCoverageExamples(binaryInput, evidenceInput);
  console.log(JSON.stringify(evidence, null, 2));
}
