import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTarGz } from "./archive.ts";
import {
  handoffBundleName,
  normalizeVersion,
  RELEASE_TARGETS,
  type ReleaseTarget,
} from "./contract.ts";
import { checksumFile, parseChecksumFile, sha256 } from "./digest.ts";
import { type RuntimeComponent, readRuntimeLicensing } from "./runtime-licenses.ts";

type JsonObject = Record<string, unknown>;

export type VerifiedBinary = {
  body: Buffer;
  sha256: string;
  target: ReleaseTarget;
};

export type VerifiedHandoff = {
  binaries: VerifiedBinary[];
  buildDialectCommit: string;
  bundleName: string;
  bundleSha256: string;
  producerManifestSha256: string;
  producerSourceCommit: string;
  sbom: Buffer;
  schema: Buffer;
  version: string;
};

export type NativeVersionVerifier = (
  binary: Buffer,
  target: ReleaseTarget,
  version: string,
) => void;

function exactObject(value: unknown, label: string, keys: string[]): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const object = value as JsonObject;
  const actual = Object.keys(object).sort((left, right) => left.localeCompare(right, "en"));
  const expected = [...keys].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} has unexpected fields: ${actual.join(", ")}`);
  }
  return object;
}

function canonicalJson(body: string, label: string): unknown {
  if (!body.endsWith("\n")) throw new Error(`${label} must end with newline`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`${label} is invalid JSON`);
  }
  if (`${JSON.stringify(parsed, null, 2)}\n` !== body) {
    throw new Error(`${label} JSON is not canonical`);
  }
  return parsed;
}

function stringField(object: JsonObject, field: string, label: string): string {
  const value = object[field];
  if (typeof value !== "string") throw new Error(`${label}.${field} must be a string`);
  return value;
}

function requireRegularFile(path: string, label: string, maximum = 512 * 1024 * 1024): Buffer {
  if (!existsSync(path)) throw new Error(`${label} is missing`);
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink())
    throw new Error(`${label} must be a regular file`);
  const body = readFileSync(path);
  if (body.byteLength === 0 || body.byteLength > maximum) {
    throw new Error(`${label} has invalid size`);
  }
  return body;
}

function directoryFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .map((entry) => {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error(`handoff contains non-file asset: ${entry.name}`);
      }
      return entry.name;
    })
    .sort((left, right) => left.localeCompare(right, "en"));
}

function hostTarget(target: ReleaseTarget): boolean {
  const operatingSystem = process.platform === "win32" ? "windows" : process.platform;
  const architecture = process.arch === "x64" ? "amd64" : process.arch;
  return target.operatingSystem === operatingSystem && target.architecture === architecture;
}

export function verifyNativeVersion(binary: Buffer, target: ReleaseTarget, version: string): void {
  if (!hostTarget(target)) return;
  const directory = mkdtempSync(join(tmpdir(), "rootform-distribution-version-"));
  const path = join(directory, target.executable);
  try {
    writeFileSync(path, binary, { flag: "wx", mode: 0o755 });
    if (process.platform !== "win32") chmodSync(path, 0o755);
    const reported = execFileSync(path, ["version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (reported !== `rootform ${version}`) {
      throw new Error(`native binary reports unexpected version: ${reported}`);
    }
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function verifyAssetMetadata(
  metadataBody: string,
  files: Map<string, Buffer>,
  expectedNames: string[],
): void {
  const metadata = exactObject(
    canonicalJson(metadataBody, "GitHub asset metadata"),
    "GitHub asset metadata",
    ["assets", "draft", "release_id"],
  );
  if (
    metadata.draft !== true ||
    !Number.isSafeInteger(metadata.release_id) ||
    Number(metadata.release_id) < 1
  ) {
    throw new Error("GitHub handoff metadata must identify one draft release");
  }
  if (!Array.isArray(metadata.assets) || metadata.assets.length !== expectedNames.length) {
    throw new Error("GitHub handoff asset inventory is incomplete");
  }
  const records = metadata.assets.map((value, index) => {
    const record = exactObject(value, `GitHub asset ${index}`, ["digest", "name", "size"]);
    const name = stringField(record, "name", `GitHub asset ${index}`);
    const digest = stringField(record, "digest", `GitHub asset ${index}`);
    if (!Number.isSafeInteger(record.size) || Number(record.size) < 1) {
      throw new Error(`GitHub asset has invalid size: ${name}`);
    }
    return { digest, name, size: Number(record.size) };
  });
  const names = records.map(({ name }) => name);
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error(`GitHub handoff asset inventory drifted: ${names.join(", ")}`);
  }
  for (const record of records) {
    const body = files.get(record.name);
    if (!body || body.byteLength !== record.size || record.digest !== `sha256:${sha256(body)}`) {
      throw new Error(`GitHub asset digest drifted: ${record.name}`);
    }
  }
}

function componentKey(component: RuntimeComponent): string {
  return `${component.kind}:${component.name}@${component.version}`;
}

function componentPurl(component: RuntimeComponent): string | undefined {
  const path = (value: string) => value.split("/").map(encodeURIComponent).join("/");
  switch (component.kind) {
    case "asset":
      return undefined;
    case "dialect-bundle":
      return `pkg:github/rootform-dev/dialects@${component.version}`;
    case "go-module":
      return `pkg:golang/${path(component.name)}@${encodeURIComponent(component.version)}`;
    case "go-runtime":
      return `pkg:golang/stdlib@${encodeURIComponent(component.version)}`;
    case "vendored-source":
    case "web-package":
      return `pkg:npm/${path(component.name)}@${encodeURIComponent(component.version)}`;
  }
}

function verifySpdx(
  body: Buffer,
  version: string,
  created: string,
  producerCommit: string,
  inventory: RuntimeComponent[],
): void {
  const source = body.toString("utf8");
  const document = exactObject(canonicalJson(source, "Engine SBOM"), "Engine SBOM", [
    "SPDXID",
    "creationInfo",
    "dataLicense",
    "documentNamespace",
    "hasExtractedLicensingInfos",
    "name",
    "packages",
    "relationships",
    "spdxVersion",
  ]);
  if (
    document.SPDXID !== "SPDXRef-DOCUMENT" ||
    document.dataLicense !== "CC0-1.0" ||
    document.spdxVersion !== "SPDX-2.3" ||
    document.name !== `rootform-${version}` ||
    document.documentNamespace !== `https://rootform.dev/sbom/rootform/${version}`
  ) {
    throw new Error("Engine SBOM identity drifted");
  }
  const creation = exactObject(document.creationInfo, "Engine SBOM creationInfo", [
    "created",
    "creators",
  ]);
  if (
    creation.created !== created ||
    JSON.stringify(creation.creators) !== JSON.stringify(["Tool: rootform-sbom-builder-1"])
  ) {
    throw new Error("Engine SBOM creation metadata drifted");
  }
  if (!Array.isArray(document.packages) || document.packages.length < 2) {
    throw new Error("Engine SBOM package inventory is empty");
  }
  const product = exactObject(document.packages[0], "Engine SBOM product package", [
    "SPDXID",
    "copyrightText",
    "downloadLocation",
    "filesAnalyzed",
    "licenseConcluded",
    "licenseDeclared",
    "name",
    "supplier",
    "versionInfo",
  ]);
  if (
    product.name !== "rootform" ||
    product.versionInfo !== version ||
    product.downloadLocation !== "NOASSERTION" ||
    product.filesAnalyzed !== false ||
    product.licenseConcluded !== "Elastic-2.0" ||
    product.licenseDeclared !== "Elastic-2.0" ||
    product.copyrightText !== "Copyright 2026 Thierno Bah. All rights reserved." ||
    product.supplier !== "Person: Thierno Bah" ||
    product.SPDXID !== "SPDXRef-Package-Rootform"
  ) {
    throw new Error("Engine SBOM product package drifted");
  }
  if (!Array.isArray(document.hasExtractedLicensingInfos)) {
    throw new Error("Engine SBOM extracted license inventory is invalid");
  }
  const inventoryByKey = new Map(
    inventory.map((component) => [componentKey(component), component]),
  );
  if (inventoryByKey.size !== inventory.length) {
    throw new Error("runtime license inventory contains duplicate components");
  }
  const expectedExtracted = inventory
    .filter(
      (component): component is RuntimeComponent & { extracted_text: string } =>
        typeof component.extracted_text === "string",
    )
    .map((component) => ({
      extractedText: component.extracted_text,
      licenseId: component.license_concluded,
      name: component.name,
    }));
  if (document.hasExtractedLicensingInfos.length !== expectedExtracted.length) {
    throw new Error("Engine SBOM extracted license inventory drifted");
  }
  const extracted = new Set<string>();
  for (const [index, value] of document.hasExtractedLicensingInfos.entries()) {
    const record = exactObject(value, `Engine SBOM extracted license ${index}`, [
      "extractedText",
      "licenseId",
      "name",
    ]);
    const licenseId = stringField(record, "licenseId", `Engine SBOM extracted license ${index}`);
    const expected = expectedExtracted[index];
    if (
      !expected ||
      !/^LicenseRef-[A-Za-z0-9.-]+$/u.test(licenseId) ||
      record.extractedText !== expected.extractedText ||
      record.licenseId !== expected.licenseId ||
      record.name !== expected.name ||
      extracted.has(licenseId)
    ) {
      throw new Error("Engine SBOM extracted license inventory drifted");
    }
    extracted.add(licenseId);
  }
  const expression = /^[A-Za-z0-9.-]+(?: (?:AND|OR) [A-Za-z0-9.-]+)*$/u;
  const componentIds: string[] = [];
  const componentKeys: string[] = [];
  for (const [index, value] of document.packages.slice(1).entries()) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`Engine SBOM component ${index} must be an object`);
    }
    const hasExternalRefs = Object.hasOwn(value, "externalRefs");
    const component = exactObject(value, `Engine SBOM component ${index}`, [
      "SPDXID",
      "copyrightText",
      "downloadLocation",
      ...(hasExternalRefs ? ["externalRefs"] : []),
      "filesAnalyzed",
      "licenseConcluded",
      "licenseDeclared",
      "name",
      "sourceInfo",
      "versionInfo",
    ]);
    const id = stringField(component, "SPDXID", `Engine SBOM component ${index}`);
    const declared = stringField(component, "licenseDeclared", `Engine SBOM component ${index}`);
    const concluded = stringField(component, "licenseConcluded", `Engine SBOM component ${index}`);
    const sourceInfo = stringField(component, "sourceInfo", `Engine SBOM component ${index}`);
    const name = stringField(component, "name", `Engine SBOM component ${index}`);
    const componentVersion = stringField(
      component,
      "versionInfo",
      `Engine SBOM component ${index}`,
    );
    const sourceMatch = sourceInfo.match(
      /^Rootform runtime inventory kind: (asset|dialect-bundle|go-module|go-runtime|vendored-source|web-package); Distributed license text SHA-256: ([0-9a-f]{64})(?:;|$)/u,
    );
    const key = sourceMatch ? `${sourceMatch[1]}:${name}@${componentVersion}` : "";
    const expected = inventoryByKey.get(key);
    if (
      !/^SPDXRef-Component-[0-9a-f]{20}$/u.test(id) ||
      componentIds.includes(id) ||
      !expected ||
      componentKeys.includes(key) ||
      component.downloadLocation !== expected.upstream ||
      component.filesAnalyzed !== false ||
      !expression.test(declared) ||
      !expression.test(concluded) ||
      declared !== expected.license_declared ||
      concluded !== expected.license_concluded ||
      component.copyrightText !== expected.copyright_text ||
      sourceMatch?.[2] !== expected.license_text_sha256
    ) {
      throw new Error(`Engine SBOM component differs from runtime license inventory: ${key}`);
    }
    for (const license of [declared, concluded]) {
      for (const reference of license.match(/LicenseRef-[A-Za-z0-9.-]+/gu) ?? []) {
        if (!extracted.has(reference)) throw new Error(`Engine SBOM omits ${reference}`);
      }
    }
    const expectedPurl = componentPurl(expected);
    if (hasExternalRefs !== (expectedPurl !== undefined)) {
      throw new Error(`Engine SBOM component ${index} external reference drifted`);
    }
    if (hasExternalRefs) {
      if (!Array.isArray(component.externalRefs) || component.externalRefs.length !== 1) {
        throw new Error(`Engine SBOM component ${index} external reference drifted`);
      }
      const reference = exactObject(
        component.externalRefs[0],
        `Engine SBOM component ${index} external reference`,
        ["referenceCategory", "referenceLocator", "referenceType"],
      );
      if (
        reference.referenceCategory !== "PACKAGE-MANAGER" ||
        reference.referenceType !== "purl" ||
        reference.referenceLocator !== expectedPurl
      ) {
        throw new Error(`Engine SBOM component ${index} external reference drifted`);
      }
    }
    componentIds.push(id);
    componentKeys.push(key);
  }
  const canonicalKeys = [...componentKeys].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(componentKeys) !== JSON.stringify(canonicalKeys)) {
    throw new Error("Engine SBOM component inventory is not canonical");
  }
  for (const component of inventory) {
    if (component.kind !== "go-module" && !componentKeys.includes(componentKey(component))) {
      throw new Error(`Engine SBOM omits shipped component: ${componentKey(component)}`);
    }
  }
  if (
    !Array.isArray(document.relationships) ||
    document.relationships.length !== componentIds.length + 1
  ) {
    throw new Error("Engine SBOM relationships are incomplete");
  }
  const describes = exactObject(document.relationships[0], "Engine SBOM describes relationship", [
    "relatedSpdxElement",
    "relationshipType",
    "spdxElementId",
  ]);
  if (
    describes.spdxElementId !== "SPDXRef-DOCUMENT" ||
    describes.relationshipType !== "DESCRIBES" ||
    describes.relatedSpdxElement !== "SPDXRef-Package-Rootform"
  ) {
    throw new Error("Engine SBOM describes relationship drifted");
  }
  const related = document.relationships.slice(1).map((value, index) => {
    const relationship = exactObject(value, `Engine SBOM dependency relationship ${index}`, [
      "relatedSpdxElement",
      "relationshipType",
      "spdxElementId",
    ]);
    if (
      relationship.spdxElementId !== "SPDXRef-Package-Rootform" ||
      relationship.relationshipType !== "DEPENDS_ON"
    ) {
      throw new Error(`Engine SBOM dependency relationship ${index} drifted`);
    }
    return stringField(
      relationship,
      "relatedSpdxElement",
      `Engine SBOM dependency relationship ${index}`,
    );
  });
  if (JSON.stringify(related) !== JSON.stringify(componentIds)) {
    throw new Error("Engine SBOM dependency relationships drifted");
  }
  if (
    /(?:\/Users\/|\/home\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\|rootform-dev\/engine)/u.test(
      source,
    ) ||
    source.includes(producerCommit)
  ) {
    throw new Error("Engine SBOM exposes private producer provenance");
  }
}

type ParsedManifest = {
  buildDialectCommit: string;
  created: string;
  producerCommit: string;
  targetRecords: Array<{
    architecture: string;
    bytes: number;
    file: string;
    operatingSystem: string;
    sha256: string;
  }>;
};

function parseProducerManifest(body: string, version: string): ParsedManifest {
  const manifest = exactObject(canonicalJson(body, "producer manifest"), "producer manifest", [
    "build",
    "format_version",
    "inputs",
    "product",
    "sbom",
    "schema",
    "source",
    "targets",
  ]);
  if (manifest.format_version !== "1") throw new Error("producer manifest format drifted");
  const product = exactObject(manifest.product, "producer product", ["name", "version"]);
  if (product.name !== "rootform" || product.version !== version) {
    throw new Error("producer product identity drifted");
  }
  const source = exactObject(manifest.source, "producer source", ["commit", "repository"]);
  const producerCommit = stringField(source, "commit", "producer source");
  if (source.repository !== "rootform-dev/engine" || !/^[0-9a-f]{40}$/u.test(producerCommit)) {
    throw new Error("producer source identity drifted");
  }
  const inputs = exactObject(manifest.inputs, "producer inputs", ["dialects"]);
  const dialects = exactObject(inputs.dialects, "producer Dialects input", [
    "commit",
    "repository",
  ]);
  const buildDialectCommit = stringField(dialects, "commit", "producer Dialects input");
  if (
    dialects.repository !== "rootform-dev/dialects" ||
    !/^[0-9a-f]{40}$/u.test(buildDialectCommit)
  ) {
    throw new Error("producer Dialects input drifted");
  }
  const build = exactObject(manifest.build, "producer build", [
    "created",
    "settings",
    "toolchains",
  ]);
  const created = stringField(build, "created", "producer build");
  if (Number.isNaN(Date.parse(created)) || new Date(created).toISOString() !== created) {
    throw new Error("producer build time is not canonical UTC");
  }
  const settings = exactObject(build.settings, "producer build settings", [
    "build_tags",
    "buildvcs",
    "cgo_enabled",
    "trimpath",
    "version_injection",
  ]);
  if (
    JSON.stringify(settings.build_tags) !== JSON.stringify(["release"]) ||
    settings.buildvcs !== false ||
    settings.cgo_enabled !== false ||
    settings.trimpath !== true ||
    settings.version_injection !== "main.generatorVersion"
  ) {
    throw new Error("producer build settings drifted");
  }
  const toolchains = exactObject(build.toolchains, "producer toolchains", ["bun", "go"]);
  if (
    !/^[0-9]+\.[0-9]+\.[0-9]+$/u.test(stringField(toolchains, "bun", "producer toolchains")) ||
    !/^go[0-9]+\.[0-9]+\.[0-9]+$/u.test(stringField(toolchains, "go", "producer toolchains"))
  ) {
    throw new Error("producer toolchain identity drifted");
  }
  const schema = exactObject(manifest.schema, "producer schema", ["file", "sha256"]);
  if (
    schema.file !== "architecture-ir.schema.json" ||
    !/^[0-9a-f]{64}$/u.test(stringField(schema, "sha256", "producer schema"))
  ) {
    throw new Error("producer schema descriptor drifted");
  }
  const sbom = exactObject(manifest.sbom, "producer SBOM", ["file", "format", "sha256"]);
  if (
    sbom.file !== "engine-sbom.spdx.json" ||
    sbom.format !== "SPDX-2.3-json" ||
    !/^[0-9a-f]{64}$/u.test(stringField(sbom, "sha256", "producer SBOM"))
  ) {
    throw new Error("producer SBOM descriptor drifted");
  }
  if (!Array.isArray(manifest.targets) || manifest.targets.length !== RELEASE_TARGETS.length) {
    throw new Error("producer target set is incomplete");
  }
  const targetRecords = manifest.targets.map((value, index) => {
    const target = exactObject(value, `producer target ${index}`, [
      "architecture",
      "bytes",
      "file",
      "operating_system",
      "sha256",
      "version_proof",
    ]);
    const file = stringField(target, "file", `producer target ${index}`);
    const architecture = stringField(target, "architecture", `producer target ${index}`);
    const operatingSystem = stringField(target, "operating_system", `producer target ${index}`);
    const digest = stringField(target, "sha256", `producer target ${index}`);
    if (
      !Number.isSafeInteger(target.bytes) ||
      Number(target.bytes) < 1 ||
      !/^[0-9a-f]{64}$/u.test(digest) ||
      target.version_proof !== "cross-compiled-version-marker"
    ) {
      throw new Error(`producer target metadata drifted: ${file}`);
    }
    return {
      architecture,
      bytes: Number(target.bytes),
      file,
      operatingSystem,
      sha256: digest,
    };
  });
  const expectedFiles = [...RELEASE_TARGETS]
    .map(({ handoffFile }) => handoffFile)
    .sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(targetRecords.map(({ file }) => file)) !== JSON.stringify(expectedFiles)) {
    throw new Error("producer target order or inventory drifted");
  }
  return { buildDialectCommit, created, producerCommit, targetRecords };
}

export function verifyHandoffDirectory(
  root: string,
  directory: string,
  metadataPath: string,
  requestedVersion: string,
  nativeVerifier: NativeVersionVerifier = verifyNativeVersion,
): VerifiedHandoff {
  const version = normalizeVersion(requestedVersion);
  const bundleName = handoffBundleName(version);
  const expectedAssets = ["ENGINE_HANDOFF_SHA256SUMS", bundleName].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const actualAssets = directoryFiles(directory);
  if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
    throw new Error(`handoff asset inventory drifted: ${actualAssets.join(", ")}`);
  }
  const bundle = requireRegularFile(join(directory, bundleName), "handoff bundle");
  const outer = requireRegularFile(
    join(directory, "ENGINE_HANDOFF_SHA256SUMS"),
    "handoff outer checksums",
    4096,
  );
  const files = new Map([
    [bundleName, bundle],
    ["ENGINE_HANDOFF_SHA256SUMS", outer],
  ]);
  verifyAssetMetadata(
    requireRegularFile(metadataPath, "GitHub asset metadata", 1024 * 1024).toString("utf8"),
    files,
    expectedAssets,
  );
  const parsedOuter = parseChecksumFile(outer.toString("utf8"));
  if (
    parsedOuter.size !== 1 ||
    parsedOuter.get(bundleName) !== sha256(bundle) ||
    outer.toString("utf8") !== checksumFile([{ body: bundle, name: bundleName }])
  ) {
    throw new Error("handoff outer checksum drifted");
  }

  const entries = readTarGz(bundle);
  const expectedEntries = [
    ...RELEASE_TARGETS.map(({ handoffFile }) => handoffFile),
    "SHA256SUMS",
    "architecture-ir.schema.json",
    "engine-handoff.json",
    "engine-sbom.spdx.json",
  ].sort((left, right) => left.localeCompare(right, "en"));
  const actualEntries = [...entries.keys()].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
    throw new Error(`handoff bundle inventory drifted: ${actualEntries.join(", ")}`);
  }
  for (const [name, entry] of entries) {
    const mode = RELEASE_TARGETS.some(({ handoffFile }) => handoffFile === name) ? 0o755 : 0o644;
    if (entry.mode !== mode) throw new Error(`handoff entry mode drifted: ${name}`);
  }
  const innerBody = Buffer.from(entries.get("SHA256SUMS")?.body ?? []).toString("utf8");
  const checksummed = [...entries.entries()]
    .filter(([name]) => name !== "SHA256SUMS")
    .map(([name, entry]) => ({ body: entry.body, name }));
  if (
    parseChecksumFile(innerBody).size !== checksummed.length ||
    innerBody !== checksumFile(checksummed)
  ) {
    throw new Error("handoff inner checksums drifted");
  }

  const manifestBody = Buffer.from(entries.get("engine-handoff.json")?.body ?? []);
  const manifest = parseProducerManifest(manifestBody.toString("utf8"), version);
  const schema = Buffer.from(entries.get("architecture-ir.schema.json")?.body ?? []);
  const expectedSchema = requireRegularFile(
    join(root, "schemas", "architecture-ir.schema.json"),
    "committed Architecture IR schema",
    16 * 1024 * 1024,
  );
  const publicExport = exactObject(
    canonicalJson(
      requireRegularFile(join(root, "public-export.json"), "public export", 1024 * 1024).toString(
        "utf8",
      ),
      "public export",
    ),
    "public export",
    ["files", "format_version", "source_commit", "source_repository"],
  );
  if (!Array.isArray(publicExport.files)) {
    throw new Error("public export file inventory is invalid");
  }
  const exportFiles = publicExport.files.map((value, index) =>
    exactObject(value, `public export file ${index}`, ["path", "sha256"]),
  );
  const expectedExportPaths = [
    "THIRD_PARTY_NOTICES.txt",
    "dependencies/runtime-components.json",
    "schemas/architecture-ir.schema.json",
    "schemas/rootform-lock.schema.json",
  ].sort((left, right) => left.localeCompare(right, "en"));
  const exportPaths = exportFiles.map((file, index) =>
    stringField(file, "path", `public export file ${index}`),
  );
  if (JSON.stringify(exportPaths) !== JSON.stringify(expectedExportPaths)) {
    throw new Error("public export allow-list drifted");
  }
  if (
    publicExport.format_version !== "1" ||
    publicExport.source_repository !== "rootform-dev/engine" ||
    publicExport.source_commit !== manifest.producerCommit
  ) {
    throw new Error("public export provenance drifted");
  }
  const exportedByPath = new Map(
    exportFiles.map((file, index) => [
      exportPaths[index] ?? "",
      stringField(file, "sha256", `public export file ${index}`),
    ]),
  );
  for (const path of expectedExportPaths) {
    const body = requireRegularFile(join(root, path), `committed public export: ${path}`);
    if (exportedByPath.get(path) !== sha256(body)) {
      throw new Error(`public export digest drifted: ${path}`);
    }
  }
  const runtimeLicensing = readRuntimeLicensing(root);
  const schemaExportDigest = exportedByPath.get("schemas/architecture-ir.schema.json");
  const manifestJson = canonicalJson(
    manifestBody.toString("utf8"),
    "producer manifest",
  ) as JsonObject;
  const manifestSchema = exactObject(manifestJson.schema, "producer schema", ["file", "sha256"]);
  if (
    !schema.equals(expectedSchema) ||
    schemaExportDigest !== sha256(schema) ||
    manifestSchema.sha256 !== sha256(schema)
  ) {
    throw new Error("handoff schema digest drifted");
  }

  const sbom = Buffer.from(entries.get("engine-sbom.spdx.json")?.body ?? []);
  const manifestSbom = exactObject(manifestJson.sbom, "producer SBOM", [
    "file",
    "format",
    "sha256",
  ]);
  if (manifestSbom.sha256 !== sha256(sbom)) throw new Error("handoff SBOM digest drifted");
  verifySpdx(sbom, version, manifest.created, manifest.producerCommit, runtimeLicensing.components);

  const binaries = RELEASE_TARGETS.map((target) => {
    const entry = entries.get(target.handoffFile);
    const record = manifest.targetRecords.find(({ file }) => file === target.handoffFile);
    if (!entry || !record) throw new Error(`handoff target is missing: ${target.handoffFile}`);
    const body = Buffer.from(entry.body);
    if (
      record.architecture !== target.architecture ||
      record.operatingSystem !== target.operatingSystem ||
      record.bytes !== body.byteLength ||
      record.sha256 !== sha256(body) ||
      !body.includes(Buffer.from(version))
    ) {
      throw new Error(`handoff target drifted: ${target.handoffFile}`);
    }
    nativeVerifier(body, target, version);
    return { body, sha256: record.sha256, target };
  });

  return {
    binaries,
    buildDialectCommit: manifest.buildDialectCommit,
    bundleName,
    bundleSha256: sha256(bundle),
    producerManifestSha256: sha256(manifestBody),
    producerSourceCommit: manifest.producerCommit,
    sbom,
    schema,
    version,
  };
}
