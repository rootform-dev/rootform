import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assembleRelease,
  parseAssembleArguments,
  verifyFinalDirectory,
} from "./assemble-release.ts";
import { createTarGz, createZip, readTarGz, readZip } from "./release/archive.ts";
import { handoffBundleName, RELEASE_TARGETS, releaseAssetName } from "./release/contract.ts";
import { checksumFile, sha256 } from "./release/digest.ts";
import { verifyHandoffDirectory } from "./release/handoff.ts";
import { releaseArchiveEntries } from "./release/metadata.ts";
import { type RuntimeComponent, readRuntimeLicensing } from "./release/runtime-licenses.ts";

const root = join(import.meta.dir, "..");
const version = "0.1.0-dev.2";
const producerCommit = (
  JSON.parse(readFileSync(join(root, "public-export.json"), "utf8")) as { source_commit: string }
).source_commit;
const dialectCommit = "b".repeat(40);
const distributionCommit = "d".repeat(40);
const created = "2026-08-31T00:00:00.000Z";
const runtimeComponents = readRuntimeLicensing(root).components.filter(
  ({ kind }) => kind !== "go-module",
);

type FixtureOptions = {
  extraEntry?: boolean;
  manifestExtraField?: boolean;
  producerCommitDrift?: boolean;
  schemaDrift?: boolean;
  sbomComponentLicenseDrift?: boolean;
  sbomLicenseDrift?: boolean;
  versionDrift?: boolean;
};

type Fixture = {
  directory: string;
  githubAssets: string;
  parent: string;
};

function canonical(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
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

function componentId(component: RuntimeComponent): string {
  return `SPDXRef-Component-${sha256(`${component.kind}:${component.name}@${component.version}`).slice(0, 20)}`;
}

function makeFixture(options: FixtureOptions = {}): Fixture {
  const parent = mkdtempSync(join(tmpdir(), "rootform-handoff-fixture-"));
  const directory = join(parent, "handoff");
  mkdirSync(directory);
  const schema = options.schemaDrift
    ? Buffer.from('{"drift":true}\n')
    : readFileSync(join(root, "schemas", "architecture-ir.schema.json"));
  const binaries = new Map(
    RELEASE_TARGETS.map((target) => [
      target.handoffFile,
      Buffer.from(
        options.versionDrift && target === RELEASE_TARGETS[0]
          ? `synthetic ${target.handoffFile}`
          : `synthetic ${target.handoffFile} rootform ${version}`,
      ),
    ]),
  );
  const sbom = canonical({
    SPDXID: "SPDXRef-DOCUMENT",
    creationInfo: {
      created,
      creators: ["Tool: rootform-sbom-builder-1"],
    },
    dataLicense: "CC0-1.0",
    documentNamespace: `https://rootform.dev/sbom/rootform/${version}`,
    hasExtractedLicensingInfos: runtimeComponents
      .filter(
        (component): component is RuntimeComponent & { extracted_text: string } =>
          typeof component.extracted_text === "string",
      )
      .map((component) => ({
        extractedText: component.extracted_text,
        licenseId: component.license_concluded,
        name: component.name,
      })),
    name: `rootform-${version}`,
    packages: [
      {
        SPDXID: "SPDXRef-Package-Rootform",
        copyrightText: "Copyright 2026 Thierno Bah. All rights reserved.",
        downloadLocation: "NOASSERTION",
        filesAnalyzed: false,
        licenseConcluded: options.sbomLicenseDrift ? "Apache-2.0" : "Elastic-2.0",
        licenseDeclared: options.sbomLicenseDrift ? "Apache-2.0" : "Elastic-2.0",
        name: "rootform",
        supplier: "Person: Thierno Bah",
        versionInfo: version,
      },
      ...runtimeComponents.map((component, index) => {
        const purl = componentPurl(component);
        return {
          SPDXID: componentId(component),
          copyrightText: component.copyright_text,
          downloadLocation: component.upstream,
          ...(purl
            ? {
                externalRefs: [
                  {
                    referenceCategory: "PACKAGE-MANAGER",
                    referenceLocator: purl,
                    referenceType: "purl",
                  },
                ],
              }
            : {}),
          filesAnalyzed: false,
          licenseConcluded:
            options.sbomComponentLicenseDrift && index === 0 ? "MIT" : component.license_concluded,
          licenseDeclared: component.license_declared,
          name: component.name,
          sourceInfo: `Rootform runtime inventory kind: ${component.kind}; Distributed license text SHA-256: ${component.license_text_sha256}`,
          versionInfo: component.version,
        };
      }),
    ],
    relationships: [
      {
        relatedSpdxElement: "SPDXRef-Package-Rootform",
        relationshipType: "DESCRIBES",
        spdxElementId: "SPDXRef-DOCUMENT",
      },
      ...runtimeComponents.map((component) => ({
        relatedSpdxElement: componentId(component),
        relationshipType: "DEPENDS_ON",
        spdxElementId: "SPDXRef-Package-Rootform",
      })),
    ],
    spdxVersion: "SPDX-2.3",
  });
  const targets = RELEASE_TARGETS.map((target) => {
    const body = binaries.get(target.handoffFile) as Buffer;
    return {
      architecture: target.architecture,
      bytes: body.byteLength,
      file: target.handoffFile,
      operating_system: target.operatingSystem,
      sha256: sha256(body),
      version_proof: "cross-compiled-version-marker",
    };
  }).sort((left, right) => left.file.localeCompare(right.file, "en"));
  const manifest: Record<string, unknown> = {
    build: {
      created,
      settings: {
        build_tags: ["release"],
        buildvcs: false,
        cgo_enabled: false,
        trimpath: true,
        version_injection: "main.generatorVersion",
      },
      toolchains: { bun: "1.3.14", go: "go1.26.7" },
    },
    format_version: "1",
    inputs: {
      dialects: { commit: dialectCommit, repository: "rootform-dev/dialects" },
    },
    product: { name: "rootform", version },
    sbom: { file: "engine-sbom.spdx.json", format: "SPDX-2.3-json", sha256: sha256(sbom) },
    schema: { file: "architecture-ir.schema.json", sha256: sha256(schema) },
    source: {
      commit: options.producerCommitDrift ? "f".repeat(40) : producerCommit,
      repository: "rootform-dev/engine",
    },
    targets,
  };
  if (options.manifestExtraField) manifest.unexpected = true;
  const manifestBody = canonical(manifest);
  const entries = [
    ...RELEASE_TARGETS.map((target) => ({
      body: binaries.get(target.handoffFile) as Buffer,
      mode: 0o755 as const,
      name: target.handoffFile,
    })),
    { body: schema, mode: 0o644 as const, name: "architecture-ir.schema.json" },
    { body: manifestBody, mode: 0o644 as const, name: "engine-handoff.json" },
    { body: sbom, mode: 0o644 as const, name: "engine-sbom.spdx.json" },
    ...(options.extraEntry
      ? [{ body: Buffer.from("extra"), mode: 0o644 as const, name: "unexpected.txt" }]
      : []),
  ];
  const bundle = createTarGz([
    ...entries,
    {
      body: Buffer.from(checksumFile(entries.map(({ body, name }) => ({ body, name })))),
      mode: 0o644,
      name: "SHA256SUMS",
    },
  ]);
  const bundleName = handoffBundleName(version);
  const outer = Buffer.from(checksumFile([{ body: bundle, name: bundleName }]));
  writeFileSync(join(directory, bundleName), bundle);
  writeFileSync(join(directory, "ENGINE_HANDOFF_SHA256SUMS"), outer);
  const githubAssets = join(parent, "github-assets.json");
  const assets = [
    {
      digest: `sha256:${sha256(outer)}`,
      name: "ENGINE_HANDOFF_SHA256SUMS",
      size: outer.byteLength,
    },
    { digest: `sha256:${sha256(bundle)}`, name: bundleName, size: bundle.byteLength },
  ];
  writeFileSync(
    githubAssets,
    `${JSON.stringify({ assets, draft: true, release_id: 1 }, null, 2)}\n`,
  );
  return { directory, githubAssets, parent };
}

const skipNative = () => {};

describe("strict handoff verification", () => {
  test("accepts exact authenticated two-asset handoff", () => {
    const fixture = makeFixture();
    try {
      const verified = verifyHandoffDirectory(
        root,
        fixture.directory,
        fixture.githubAssets,
        version,
        skipNative,
      );
      expect(verified.binaries).toHaveLength(5);
      expect(verified.buildDialectCommit).toBe(dialectCommit);
      expect(verified.producerSourceCommit).toBe(producerCommit);
      expect(verified.sbom.toString("utf8")).not.toContain(producerCommit);
    } finally {
      rmSync(fixture.parent, { force: true, recursive: true });
    }
  });

  test("rejects unexpected asset, entry, field, schema, version, and GitHub digest", () => {
    const cases: Array<[FixtureOptions, string]> = [
      [{ extraEntry: true }, "bundle inventory drifted"],
      [{ manifestExtraField: true }, "unexpected fields"],
      [{ producerCommitDrift: true }, "public export provenance drifted"],
      [{ schemaDrift: true }, "handoff schema digest drifted"],
      [
        { sbomComponentLicenseDrift: true },
        "SBOM component differs from runtime license inventory",
      ],
      [{ sbomLicenseDrift: true }, "SBOM product package drifted"],
      [{ versionDrift: true }, "target drifted"],
    ];
    for (const [options, message] of cases) {
      const fixture = makeFixture(options);
      try {
        expect(() =>
          verifyHandoffDirectory(
            root,
            fixture.directory,
            fixture.githubAssets,
            version,
            skipNative,
          ),
        ).toThrow(message);
      } finally {
        rmSync(fixture.parent, { force: true, recursive: true });
      }
    }

    const extraAsset = makeFixture();
    try {
      writeFileSync(join(extraAsset.directory, "extra"), "x");
      expect(() =>
        verifyHandoffDirectory(
          root,
          extraAsset.directory,
          extraAsset.githubAssets,
          version,
          skipNative,
        ),
      ).toThrow("asset inventory drifted");
    } finally {
      rmSync(extraAsset.parent, { force: true, recursive: true });
    }

    const digest = makeFixture();
    try {
      const metadata = JSON.parse(readFileSync(digest.githubAssets, "utf8")) as {
        assets: Array<{ digest: string }>;
      };
      (metadata.assets[0] as { digest: string }).digest = `sha256:${"0".repeat(64)}`;
      writeFileSync(digest.githubAssets, `${JSON.stringify(metadata, null, 2)}\n`);
      expect(() =>
        verifyHandoffDirectory(root, digest.directory, digest.githubAssets, version, skipNative),
      ).toThrow("GitHub asset digest drifted");
    } finally {
      rmSync(digest.parent, { force: true, recursive: true });
    }
  });
});

describe("final release assembly", () => {
  test("assembles exact final assets and preserves all raw executable bytes", () => {
    const fixture = makeFixture();
    const output = join(fixture.parent, "release");
    try {
      assembleRelease({
        distributionCommit,
        githubAssets: fixture.githubAssets,
        handoffDirectory: fixture.directory,
        nativeVerifier: skipNative,
        output,
        root,
        version,
      });
      expect(readdirSync(output)).toHaveLength(10);
      const verified = verifyHandoffDirectory(
        root,
        fixture.directory,
        fixture.githubAssets,
        version,
        skipNative,
      );
      for (const { body, target } of verified.binaries) {
        const archive = readFileSync(join(output, releaseAssetName(version, target)));
        const entries = target.archiveFormat === "zip" ? readZip(archive) : readTarGz(archive);
        expect([...(entries.get(target.executable)?.body ?? [])]).toEqual([...body]);
      }
      const manifest = readFileSync(join(output, `rootform_${version}_manifest.json`), "utf8");
      expect(manifest).not.toContain(producerCommit);
      expect(manifest).not.toContain("rootform-dev/engine");
      expect(manifest).toContain(verified.producerManifestSha256);
      const parsed = JSON.parse(manifest) as {
        license: {
          binary: { public_release_allowed: boolean; spdx: string; status: string };
          third_party_notices: { component_count: number; inventory_sha256: string };
        };
      };
      expect(parsed.license.binary).toMatchObject({
        public_release_allowed: true,
        spdx: "Elastic-2.0",
        status: "licensed",
      });
      expect(parsed.license.third_party_notices.component_count).toBe(83);
      expect(parsed.license.third_party_notices.inventory_sha256).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      rmSync(fixture.parent, { force: true, recursive: true });
    }
  });

  test("rejects final executable mutation even with canonical repackaging", () => {
    const fixture = makeFixture();
    const output = join(fixture.parent, "release");
    try {
      assembleRelease({
        distributionCommit,
        githubAssets: fixture.githubAssets,
        handoffDirectory: fixture.directory,
        nativeVerifier: skipNative,
        output,
        root,
        version,
      });
      const handoff = verifyHandoffDirectory(
        root,
        fixture.directory,
        fixture.githubAssets,
        version,
        skipNative,
      );
      const first = handoff.binaries[0] as (typeof handoff.binaries)[number];
      const inputs = {
        license: readFileSync(join(root, "LICENSES", "ROOTFORM-BINARY-LICENSE.txt")),
        notices: readFileSync(join(root, "THIRD_PARTY_NOTICES.txt")),
      };
      const mutated = Buffer.concat([first.body, Buffer.from("mutation")]);
      const entries = releaseArchiveEntries({
        binary: mutated,
        license: inputs.license,
        notices: inputs.notices,
        sbom: handoff.sbom,
        target: first.target,
        version,
      });
      const archive =
        first.target.archiveFormat === "zip" ? createZip(entries) : createTarGz(entries);
      writeFileSync(join(output, releaseAssetName(version, first.target)), archive);
      expect(() =>
        verifyFinalDirectory({
          distributionCommit,
          githubAssets: fixture.githubAssets,
          handoffDirectory: fixture.directory,
          nativeVerifier: skipNative,
          output,
          root,
          version,
        }),
      ).toThrow("final executable bytes drifted");
    } finally {
      rmSync(fixture.parent, { force: true, recursive: true });
    }
  });
});

test("assembly CLI requires exact explicit inputs", () => {
  expect(
    parseAssembleArguments(
      [
        `--version=${version}`,
        "--handoff=handoff",
        "--github-assets=assets.json",
        "--output=release",
      ],
      "/workspace",
    ),
  ).toEqual({
    check: false,
    githubAssets: "/workspace/assets.json",
    handoff: "/workspace/handoff",
    output: "/workspace/release",
    version,
  });
  expect(() => parseAssembleArguments([`--version=${version}`])).toThrow("--handoff is required");
});
