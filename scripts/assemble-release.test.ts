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
// Public form.ReleaseSetIdentity vector for the exact version and ordered units below.
const releaseSetIdentity = "5300550aa3f6dff60d7bfe0ed65bceabddd8182d4e50ed1c93200bb1cedaa645";
const releaseSet = {
  format_version: "1",
  release_set: {
    id: `release-set:${releaseSetIdentity}`,
    manifest_digest: `sha256:${releaseSetIdentity}`,
    units: [
      {
        content_digest: `sha256:${"d".repeat(64)}`,
        kind: "dialect",
        owner: "aws",
        semantic_digest: `sha256:${"e".repeat(64)}`,
        version: "0.1.0",
      },
      {
        content_digest: `sha256:${"f".repeat(64)}`,
        kind: "dialect",
        owner: "azure",
        semantic_digest: `sha256:${"6".repeat(64)}`,
        version: "0.1.0",
      },
      {
        content_digest: `sha256:${"b".repeat(64)}`,
        kind: "vocabulary",
        owner: "rf",
        semantic_digest: `sha256:${"c".repeat(64)}`,
        version: "0.1.0",
      },
    ],
    version: "0.1.0",
  },
};
const releaseSetJson = `${JSON.stringify(releaseSet, null, 2)}\n`;
const releaseSetManifestSha256 = sha256(releaseSetJson);
const distributionCommit = "d".repeat(40);
const rendererRevision = "b".repeat(40);
const rendererAssetSha256 = "c".repeat(64);
const rendererManifestSha256 = "e".repeat(64);
const rendererReleaseTag = `renderer-${rendererRevision}`;
const created = "2026-08-31T00:00:00.000Z";
const runtimeComponents = readRuntimeLicensing(root).components.filter(
  ({ kind }) => kind !== "go-module",
);

type FixtureOptions = {
  binaryRendererProvenanceLeak?: boolean;
  extraEntry?: boolean;
  manifestExtraField?: boolean;
  manifestFormatDrift?: boolean;
  producerCommitDrift?: boolean;
  releaseSetDrift?: boolean;
  releaseSetManifest?: unknown;
  rendererAssetDrift?: boolean;
  rendererIdentityDrift?: boolean;
  rendererManifestDrift?: boolean;
  schemaDrift?: boolean;
  sbomComponentLicenseDrift?: boolean;
  sbomLicenseDrift?: boolean;
  sbomRendererProvenanceLeak?: boolean;
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
      return `pkg:github/rootform-dev/rootform@${component.version}`;
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
    : readFileSync(join(root, "schemas", "form.schema.json"));
  const binaries = new Map(
    RELEASE_TARGETS.map((target, index) => [
      target.handoffFile,
      Buffer.from(
        options.versionDrift && target === RELEASE_TARGETS[0]
          ? `synthetic ${target.handoffFile}`
          : `synthetic ${target.handoffFile} rootform ${version}${
              options.binaryRendererProvenanceLeak && index === 0 ? ` ${rendererReleaseTag}` : ""
            }`,
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
          sourceInfo:
            `Rootform runtime inventory kind: ${component.kind}; Distributed license text SHA-256: ${component.license_text_sha256}` +
            (options.sbomRendererProvenanceLeak && index === 0
              ? `; renderer release: ${rendererReleaseTag}`
              : ""),
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
    format_version: options.manifestFormatDrift ? "1" : "2",
    release_set:
      options.releaseSetManifest !== undefined
        ? options.releaseSetManifest
        : options.releaseSetDrift
          ? {
              ...releaseSet,
              release_set: {
                ...releaseSet.release_set,
                units: [...releaseSet.release_set.units].reverse(),
              },
            }
          : releaseSet,
    inputs: {
      renderer: {
        asset: {
          bytes: 1_617_784,
          file: `rootform_renderer_bundle_${rendererRevision}.tar.gz`,
          sha256: options.rendererAssetDrift ? "invalid" : rendererAssetSha256,
        },
        manifest: {
          file: "renderer-bundle.json",
          sha256: options.rendererManifestDrift ? "invalid" : rendererManifestSha256,
        },
        release_tag: rendererReleaseTag,
        repository: options.rendererIdentityDrift ? "rootform-dev/other" : "rootform-dev/web",
        revision: rendererRevision,
      },
    },
    product: { name: "rootform", version },
    sbom: { file: "engine-sbom.spdx.json", format: "SPDX-2.3-json", sha256: sha256(sbom) },
    schema: { file: "form.schema.json", sha256: sha256(schema) },
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
    { body: schema, mode: 0o644 as const, name: "form.schema.json" },
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
const skipPins = () => {};

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
        skipPins,
      );
      expect(verified.binaries).toHaveLength(5);
      expect(verified.releaseSetManifestSha256).toBe(releaseSetManifestSha256);
      expect(verified.releaseSetManifestSha256).toBe(
        "32999ca0b30e7d686b2f7efebcc8ef7f6f1efbaf9d84cf4ddde90416a68fdcf1",
      );
      expect(verified.releaseSetVersion).toBe("0.1.0");
      expect(verified.producerSourceCommit).toBe(producerCommit);
      expect(verified.sbom.toString("utf8")).not.toContain(producerCommit);
      expect(verified.sbom.toString("utf8")).not.toContain(rendererRevision);
    } finally {
      rmSync(fixture.parent, { force: true, recursive: true });
    }
  });

  type MutableReleaseSetManifest = Record<string, unknown> & {
    release_set: Record<string, unknown> & { units: Array<Record<string, unknown>> };
  };
  const invalidReleaseSets: Array<[string, (metadata: MutableReleaseSetManifest) => void, string]> =
    [
      [
        "missing ID",
        (metadata) => {
          delete metadata.release_set.id;
        },
        "unexpected fields",
      ],
      [
        "missing manifest digest",
        (metadata) => {
          delete metadata.release_set.manifest_digest;
        },
        "unexpected fields",
      ],
      [
        "incorrect ID",
        (metadata) => {
          metadata.release_set.id = `release-set:${"0".repeat(64)}`;
        },
        "identity is not derived from its units",
      ],
      [
        "incorrect manifest digest",
        (metadata) => {
          metadata.release_set.manifest_digest = `sha256:${"0".repeat(64)}`;
        },
        "identity is not derived from its units",
      ],
      [
        "JSON checksum used as Form identity",
        (metadata) => {
          metadata.release_set.id = `release-set:${releaseSetManifestSha256}`;
          metadata.release_set.manifest_digest = `sha256:${releaseSetManifestSha256}`;
        },
        "identity is not derived from its units",
      ],
      [
        "changed semantic pin without updated identity",
        (metadata) => {
          (metadata.release_set.units[0] as Record<string, unknown>).semantic_digest =
            `sha256:${"0".repeat(64)}`;
        },
        "identity is not derived from its units",
      ],
      [
        "missing manifest digest prefix",
        (metadata) => {
          metadata.release_set.manifest_digest = releaseSetIdentity;
        },
        "identity is invalid",
      ],
      [
        "missing content digest prefix",
        (metadata) => {
          (metadata.release_set.units[0] as Record<string, unknown>).content_digest = "d".repeat(
            64,
          );
        },
        "invalid or duplicated",
      ],
      [
        "uppercase semantic digest",
        (metadata) => {
          (metadata.release_set.units[0] as Record<string, unknown>).semantic_digest =
            `sha256:${"A".repeat(64)}`;
        },
        "invalid or duplicated",
      ],
      [
        "legacy RF Language field",
        (metadata) => {
          metadata.rf_language = { contract_sha256: "a".repeat(64), version: "0.1.0" };
        },
        "unexpected fields",
      ],
      [
        "unknown nested release-set field",
        (metadata) => {
          metadata.release_set.unexpected = true;
        },
        "unexpected fields",
      ],
      [
        "unknown unit field",
        (metadata) => {
          (metadata.release_set.units[0] as Record<string, unknown>).unexpected = true;
        },
        "unexpected fields",
      ],
      [
        "invalid owner",
        (metadata) => {
          (metadata.release_set.units[0] as Record<string, unknown>).owner = "AWS";
        },
        "identity is invalid",
      ],
      [
        "invalid kind",
        (metadata) => {
          (metadata.release_set.units[0] as Record<string, unknown>).kind = "policy";
        },
        "identity is invalid",
      ],
      [
        "vocabulary with a non-rf owner",
        (metadata) => {
          (metadata.release_set.units[0] as Record<string, unknown>).kind = "vocabulary";
        },
        "nature is invalid",
      ],
      [
        "rf described as a Dialect",
        (metadata) => {
          (metadata.release_set.units[2] as Record<string, unknown>).kind = "dialect";
        },
        "nature is invalid",
      ],
      [
        "missing RF Vocabulary",
        (metadata) => {
          metadata.release_set.units.pop();
        },
        "must contain exactly one RF Vocabulary unit",
      ],
      [
        "duplicate owner",
        (metadata) => {
          metadata.release_set.units.push({ ...metadata.release_set.units[0] });
        },
        "invalid or duplicated",
      ],
      [
        "invalid release-set SemVer",
        (metadata) => {
          metadata.release_set.version = "0.1.0-01";
        },
        "manifest version is invalid",
      ],
      [
        "invalid unit SemVer",
        (metadata) => {
          (metadata.release_set.units[0] as Record<string, unknown>).version = "0.1.0-beta..1";
        },
        "invalid or duplicated",
      ],
    ];
  for (const [name, mutate, message] of invalidReleaseSets) {
    test(`rejects release set with ${name}`, () => {
      const metadata = JSON.parse(releaseSetJson) as MutableReleaseSetManifest;
      mutate(metadata);
      const fixture = makeFixture({ releaseSetManifest: metadata });
      try {
        expect(() =>
          verifyHandoffDirectory(
            root,
            fixture.directory,
            fixture.githubAssets,
            version,
            skipNative,
            skipPins,
          ),
        ).toThrow(message);
      } finally {
        rmSync(fixture.parent, { force: true, recursive: true });
      }
    });
  }

  test("uses public Go owner byte order rather than locale collation", () => {
    const metadata = structuredClone(releaseSet);
    (metadata.release_set.units[0] as Record<string, unknown>).owner = "a-a";
    (metadata.release_set.units[1] as Record<string, unknown>).owner = "a0";
    const identity = "74f3caab3467534e96053e7a234b57d2fdef19dbe1513dd8bb4ddfb57495b6f9";
    metadata.release_set.id = `release-set:${identity}`;
    metadata.release_set.manifest_digest = `sha256:${identity}`;
    const fixture = makeFixture({ releaseSetManifest: metadata });
    try {
      const verified = verifyHandoffDirectory(
        root,
        fixture.directory,
        fixture.githubAssets,
        version,
        skipNative,
        skipPins,
      );
      expect(verified.releaseSetManifestSha256).toBe(sha256(canonical(metadata)));
    } finally {
      rmSync(fixture.parent, { force: true, recursive: true });
    }
  });

  test("verifies the frozen public CLI module pin of every target by default", () => {
    const fixture = makeFixture();
    try {
      expect(() =>
        verifyHandoffDirectory(root, fixture.directory, fixture.githubAssets, version, skipNative),
      ).toThrow("handoff target does not record one public CLI module version");
      expect(() =>
        assembleRelease({
          distributionCommit,
          githubAssets: fixture.githubAssets,
          handoffDirectory: fixture.directory,
          nativeVerifier: skipNative,
          output: join(fixture.parent, "release"),
          root,
          version,
        }),
      ).toThrow("handoff target does not record one public CLI module version");
    } finally {
      rmSync(fixture.parent, { force: true, recursive: true });
    }
  });

  test("rejects exported commit or repository outside the verified producer", () => {
    for (const [field, value] of [
      ["source_commit", "f".repeat(40)],
      ["source_repository", "rootform-dev/other"],
    ] as const) {
      const fixture = makeFixture();
      try {
        const distribution = join(fixture.parent, "distribution");
        mkdirSync(join(distribution, "schemas"), { recursive: true });
        writeFileSync(
          join(distribution, "schemas/form.schema.json"),
          readFileSync(join(root, "schemas/form.schema.json")),
        );
        const exported = JSON.parse(readFileSync(join(root, "public-export.json"), "utf8"));
        exported[field] = value;
        writeFileSync(join(distribution, "public-export.json"), canonical(exported));
        expect(() =>
          verifyHandoffDirectory(
            distribution,
            fixture.directory,
            fixture.githubAssets,
            version,
            skipNative,
            skipPins,
          ),
        ).toThrow("public export provenance drifted");
      } finally {
        rmSync(fixture.parent, { force: true, recursive: true });
      }
    }
  });

  test("rejects unexpected asset, entry, field, schema, version, and GitHub digest", () => {
    const cases: Array<[FixtureOptions, string]> = [
      [{ binaryRendererProvenanceLeak: true }, "target exposes private producer provenance"],
      [{ extraEntry: true }, "bundle inventory drifted"],
      [{ manifestExtraField: true }, "unexpected fields"],
      [{ manifestFormatDrift: true }, "producer manifest format drifted"],
      [{ producerCommitDrift: true }, "public export provenance drifted"],
      [{ releaseSetDrift: true }, "release-set manifest units are not canonical"],
      [{ rendererAssetDrift: true }, "producer renderer asset drifted"],
      [{ rendererIdentityDrift: true }, "producer renderer identity drifted"],
      [{ rendererManifestDrift: true }, "producer renderer manifest drifted"],
      [{ schemaDrift: true }, "handoff schema digest drifted"],
      [
        { sbomComponentLicenseDrift: true },
        "SBOM component differs from runtime license inventory",
      ],
      [{ sbomLicenseDrift: true }, "SBOM product package drifted"],
      [{ sbomRendererProvenanceLeak: true }, "SBOM exposes private producer provenance"],
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
            skipPins,
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
          skipPins,
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
        verifyHandoffDirectory(
          root,
          digest.directory,
          digest.githubAssets,
          version,
          skipNative,
          skipPins,
        ),
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
        pinVerifier: skipPins,
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
        skipPins,
      );
      for (const { body, target } of verified.binaries) {
        const archive = readFileSync(join(output, releaseAssetName(version, target)));
        const entries = target.archiveFormat === "zip" ? readZip(archive) : readTarGz(archive);
        expect([...(entries.get(target.executable)?.body ?? [])]).toEqual([...body]);
      }
      const manifest = readFileSync(join(output, `rootform_${version}_manifest.json`), "utf8");
      expect(manifest).not.toContain(producerCommit);
      expect(manifest).not.toContain("rootform-dev/engine");
      expect(manifest).not.toContain(rendererRevision);
      expect(manifest).not.toContain("rootform-dev/web");
      expect(manifest).not.toContain(rendererReleaseTag);
      expect(manifest).not.toContain(rendererAssetSha256);
      expect(manifest).not.toContain(rendererManifestSha256);
      expect(manifest).toContain(verified.producerManifestSha256);
      expect(manifest).toContain(releaseSetManifestSha256);
      expect(JSON.parse(manifest)).toMatchObject({
        format_version: "1",
        release_set: {
          id: `release-set:${releaseSetManifestSha256}`,
          manifest_sha256: releaseSetManifestSha256,
          version: "0.1.0",
        },
      });
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
      expect(parsed.license.third_party_notices.component_count).toBe(
        JSON.parse(readFileSync(join(root, "dependencies/runtime-components.json"), "utf8"))
          .components.length,
      );
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
        pinVerifier: skipPins,
        root,
        version,
      });
      const handoff = verifyHandoffDirectory(
        root,
        fixture.directory,
        fixture.githubAssets,
        version,
        skipNative,
        skipPins,
      );
      const first = handoff.binaries[0] as (typeof handoff.binaries)[number];
      const inputs = {
        license: readFileSync(join(root, "dependencies", "ROOTFORM-BINARY-LICENSE.txt")),
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
          pinVerifier: skipPins,
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
