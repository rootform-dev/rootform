import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  IMAGE_PLATFORMS,
  type ImageArchitecture,
  imageBuildArguments,
  imageBuildEnvironment,
  imageManifest,
  imagePublishArguments,
  imageRuntimeBuildArguments,
  parseImageArguments,
  releaseExecutable,
  type StagedBinary,
  stageImageContext,
  verifyImageArchive,
} from "./build-image.ts";
import { createTarGz } from "./release/archive.ts";
import { RELEASE_TARGETS, releaseAssetName } from "./release/contract.ts";
import { checksumFile, sha256 } from "./release/digest.ts";
import { BINARY_LICENSE_FILE } from "./release/license.ts";
import { releaseArchiveEntries } from "./release/metadata.ts";
import { readImageArchive } from "./release/oci.ts";

const version = "0.1.0";
const revision = "c".repeat(40);
const sbomName = `rootform_${version}_sbom.spdx.json`;
const shareDirectory = "/usr/local/share/rootform";
const binaryPath = "/usr/local/bin/rootform";

const license = Buffer.from("binary license body\n");
const notices = Buffer.from("third party notices body\n");
const sbom = Buffer.from('{"spdxVersion":"SPDX-2.3"}\n');

function executableBody(architecture: ImageArchitecture): Buffer {
  return Buffer.from(`rootform ${architecture} executable payload`);
}

function linuxTarget(architecture: ImageArchitecture) {
  const target = RELEASE_TARGETS.find(
    (candidate) => candidate.operatingSystem === "linux" && candidate.architecture === architecture,
  );
  if (!target) throw new Error("missing linux target");
  return target;
}

type ReleaseOptions = {
  innerChecksumDrift?: boolean;
  outerChecksumDrift?: boolean;
};

function writeRelease(options: ReleaseOptions = {}): string {
  const directory = mkdtempSync(join(tmpdir(), "rootform-image-release-"));
  const files: Array<{ body: Buffer; name: string }> = [
    { body: license, name: BINARY_LICENSE_FILE },
    { body: notices, name: "THIRD_PARTY_NOTICES.txt" },
    { body: sbom, name: sbomName },
  ];
  for (const architecture of IMAGE_PLATFORMS) {
    const target = linuxTarget(architecture);
    const entries = releaseArchiveEntries({
      binary: executableBody(architecture),
      license,
      notices,
      sbom,
      target,
      version,
    });
    if (options.innerChecksumDrift && architecture === "amd64") {
      const checksums = entries.find(({ name }) => name === "SHA256SUMS");
      if (checksums) checksums.body = Buffer.from(`${"0".repeat(64)}  rootform\n`);
    }
    files.push({ body: createTarGz(entries), name: releaseAssetName(version, target) });
  }
  for (const file of files) writeFileSync(join(directory, file.name), file.body);
  const checksums = checksumFile(
    files.map(({ body, name }) => ({
      body: options.outerChecksumDrift && name.includes("linux_amd64") ? Buffer.alloc(4) : body,
      name,
    })),
  );
  writeFileSync(join(directory, "SHA256SUMS"), checksums);
  return directory;
}

function tarBlock(path: string, body: Uint8Array, type: string, mode: number): Buffer {
  const header = Buffer.alloc(512);
  header.write(path.slice(0, 100), 0, "utf8");
  header.write(`${mode.toString(8).padStart(7, "0")}\0`, 100, "utf8");
  header.write("0000000\0", 108, "utf8");
  header.write("0000000\0", 116, "utf8");
  header.write(`${body.byteLength.toString(8).padStart(11, "0")}\0`, 124, "utf8");
  header.write("00000000000\0", 136, "utf8");
  header.fill(0x20, 148, 156);
  header.write(type, 156, "utf8");
  header.write("ustar\0", 257, "utf8");
  header.write("00", 263, "utf8");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, "utf8");
  const padding = body.byteLength % 512 === 0 ? 0 : 512 - (body.byteLength % 512);
  return Buffer.concat([header, Buffer.from(body), Buffer.alloc(padding)]);
}

function containerTar(entries: Array<{ body: Uint8Array; mode?: number; path: string }>): Buffer {
  return Buffer.concat([
    ...entries.map(({ body, mode, path }) => tarBlock(path, body, "0", mode ?? 0o644)),
    Buffer.alloc(1024),
  ]);
}

type VariantOptions = {
  architecture: ImageArchitecture;
  binary?: Uint8Array;
  binaryMode?: number;
  command?: string[];
  entrypoint?: string[];
  extraFile?: { body: Uint8Array; path: string };
  labels?: Record<string, string>;
  shareMode?: number;
  home?: string;
  user?: string;
  userHome?: string;
  workingDirectory?: string;
};

function defaultLabels(): Record<string, string> {
  return {
    "org.opencontainers.image.licenses": "Elastic-2.0",
    "org.opencontainers.image.revision": revision,
    "org.opencontainers.image.source": "https://github.com/rootform-dev/rootform",
    "org.opencontainers.image.title": "Rootform",
    "org.opencontainers.image.version": version,
  };
}

function buildArchive(variants: VariantOptions[]): Buffer {
  const blobs = new Map<string, Buffer>();
  const store = (body: Buffer): { digest: string; size: number } => {
    const digest = `sha256:${sha256(body)}`;
    blobs.set(digest, body);
    return { digest, size: body.byteLength };
  };
  const manifests = variants.map((variant) => {
    const base = store(containerTar([{ body: Buffer.from("alpine base\n"), path: "bin/sh" }]));
    const overlay = store(
      containerTar([
        {
          body: variant.binary ?? executableBody(variant.architecture),
          mode: variant.binaryMode ?? 0o755,
          path: binaryPath.slice(1),
        },
        {
          body: license,
          mode: variant.shareMode,
          path: `${shareDirectory.slice(1)}/${BINARY_LICENSE_FILE}`,
        },
        {
          body: notices,
          mode: variant.shareMode,
          path: `${shareDirectory.slice(1)}/THIRD_PARTY_NOTICES.txt`,
        },
        {
          body: sbom,
          mode: variant.shareMode,
          path: `${shareDirectory.slice(1)}/${sbomName}`,
        },
        ...(variant.extraFile
          ? [{ body: variant.extraFile.body, path: variant.extraFile.path.slice(1) }]
          : []),
      ]),
    );
    const configuration = store(
      Buffer.from(
        `${JSON.stringify({
          architecture: variant.architecture,
          config: {
            Cmd: variant.command ?? ["rootform", "--help"],
            Entrypoint: variant.entrypoint ?? null,
            Env: [
              `HOME=${variant.userHome ?? "/home/rootform"}`,
              `ROOTFORM_HOME=${variant.home ?? "/home/rootform/.rootform"}`,
            ],
            Labels: variant.labels ?? defaultLabels(),
            User: variant.user ?? "65532:65532",
            WorkingDir: variant.workingDirectory ?? "/workspace",
          },
          os: "linux",
        })}\n`,
      ),
    );
    const manifest = store(
      Buffer.from(
        `${JSON.stringify({
          config: { ...configuration, mediaType: "application/vnd.oci.image.config.v1+json" },
          layers: [base, overlay].map((layer) => ({
            ...layer,
            mediaType: "application/vnd.oci.image.layer.v1.tar",
          })),
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          schemaVersion: 2,
        })}\n`,
      ),
    );
    return {
      ...manifest,
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      platform: { architecture: variant.architecture, os: "linux" },
    };
  });
  const index = store(
    Buffer.from(
      `${JSON.stringify({
        manifests,
        mediaType: "application/vnd.oci.image.index.v1+json",
        schemaVersion: 2,
      })}\n`,
    ),
  );
  return containerTar([
    { body: Buffer.from('{"imageLayoutVersion":"1.0.0"}\n'), path: "oci-layout" },
    {
      body: Buffer.from(
        `${JSON.stringify({
          manifests: [{ ...index, mediaType: "application/vnd.oci.image.index.v1+json" }],
          schemaVersion: 2,
        })}\n`,
      ),
      path: "index.json",
    },
    ...[...blobs.entries()].map(([digest, body]) => ({
      body,
      path: `blobs/sha256/${digest.slice("sha256:".length)}`,
    })),
  ]);
}

function stagedBinaries(): StagedBinary[] {
  return IMAGE_PLATFORMS.map((architecture) => ({
    architecture,
    sha256: sha256(executableBody(architecture)),
    size: executableBody(architecture).byteLength,
  }));
}

const sharedAssets = [
  { name: BINARY_LICENSE_FILE, sha256: sha256(license) },
  { name: "THIRD_PARTY_NOTICES.txt", sha256: sha256(notices) },
  { name: sbomName, sha256: sha256(sbom) },
];

function verify(archive: Buffer) {
  return verifyImageArchive({
    archive,
    binaries: stagedBinaries(),
    revision,
    shared: sharedAssets,
    version,
  });
}

describe("image build arguments", () => {
  test("accepts one exact release, revision, and version", () => {
    const options = parseImageArguments(
      ["--version", version, "--release", "out", "--revision", revision, "--output", "image"],
      "/tmp/example",
    );
    expect(options).toEqual({
      output: "/tmp/example/image",
      release: "/tmp/example/out",
      revision,
      version,
    });
  });

  test("rejects unknown, duplicate, incomplete, and inexact arguments", () => {
    const base = ["--version", version, "--release", "out", "--revision", revision];
    expect(() => parseImageArguments([...base, "--push"], "/tmp")).toThrow(
      "unknown image build argument: --push",
    );
    expect(() => parseImageArguments([...base, "--output", "a", "--output", "b"], "/tmp")).toThrow(
      "duplicate image build argument: --output",
    );
    expect(() => parseImageArguments(base, "/tmp")).toThrow("--output is required");
    expect(() =>
      parseImageArguments(
        ["--version", version, "--release", "out", "--revision", "main", "--output", "i"],
        "/tmp",
      ),
    ).toThrow("--revision must be one exact commit");
  });

  test("builds both official platforms without provenance or generated attestations", () => {
    const command = imageBuildArguments({
      context: "/tmp/context",
      output: "/tmp/image.oci.tar",
      revision,
      version,
    });
    expect(command.slice(0, 3)).toEqual(["docker", "buildx", "build"]);
    expect(command).toContain("linux/amd64,linux/arm64");
    expect(command).toContain(`ROOTFORM_VERSION=${version}`);
    expect(command).toContain(`ROOTFORM_REVISION=${revision}`);
    expect(command).toContain("ROOTFORM_CREATED=1970-01-01T00:00:00Z");
    expect(command.join(" ")).toContain(
      "type=oci,dest=/tmp/image.oci.tar,name=ghcr.io/rootform-dev/rootform:0.1.0",
    );
    expect(command.at(-1)).toBe("/tmp/context");
  });

  test("pins layer timestamps so repeated builds stay reproducible", () => {
    const command = imageBuildArguments({
      context: "/tmp/context",
      output: "/tmp/image.oci.tar",
      revision,
      version,
    });
    // BuildKit only rewrites timestamps inside layers when the exporter asks
    // for it, so both halves of the contract are asserted together.
    expect(command.join(" ")).toContain("rewrite-timestamp=true");
    expect(imageBuildEnvironment()).toEqual({ SOURCE_DATE_EPOCH: "0" });
    expect(command).not.toContain("--push");
  });

  test("loads exact single-platform runtime images without attestations", () => {
    const command = imageRuntimeBuildArguments({
      architecture: "arm64",
      context: "/tmp/context",
      revision,
      tag: "rootform-qualification:arm64",
      version,
    });
    expect(command).toContain("linux/arm64");
    expect(command).toContain("--load");
    expect(command).toContain("rootform-qualification:arm64");
    expect(command).toContain("false");
    expect(command).not.toContain("--push");
  });

  test("publishes only exact version with maximal provenance and SBOM", () => {
    const command = imagePublishArguments({
      context: "/tmp/context",
      metadata: "/tmp/metadata.json",
      revision,
      version,
    });
    expect(command).toContain("linux/amd64,linux/arm64");
    expect(command).toContain("mode=max");
    expect(command.join(" ")).toContain(
      "generator=docker.io/docker/buildkit-syft-scanner:stable-1@sha256:ae4f3b554449e7e25548e7d8ccc029d17357348e30c6e3df01b92bc93654d6a9",
    );
    expect(command.join(" ")).toContain(
      "type=registry,name=ghcr.io/rootform-dev/rootform:0.1.0,push=true,rewrite-timestamp=true",
    );
    expect(command.join(" ")).not.toContain("latest");
  });
});

describe("release payload", () => {
  test("extracts the published executable for every image platform", () => {
    const release = writeRelease();
    try {
      for (const architecture of IMAGE_PLATFORMS) {
        expect(releaseExecutable({ architecture, release, version })).toEqual(
          executableBody(architecture),
        );
      }
    } finally {
      rmSync(release, { force: true, recursive: true });
    }
  });

  test("refuses an archive the release checksums do not publish", () => {
    const release = writeRelease({ outerChecksumDrift: true });
    try {
      expect(() => releaseExecutable({ architecture: "amd64", release, version })).toThrow(
        "release archive digest is not published",
      );
    } finally {
      rmSync(release, { force: true, recursive: true });
    }
  });

  test("refuses an archive whose inner checksums drifted", () => {
    const release = writeRelease({ innerChecksumDrift: true });
    try {
      expect(() => releaseExecutable({ architecture: "amd64", release, version })).toThrow(
        /release archive (?:checksums drifted|is not deterministic)|tar gzip bytes are not canonical/u,
      );
    } finally {
      rmSync(release, { force: true, recursive: true });
    }
  });

  test("stages only verified release payload into the build context", () => {
    const release = writeRelease();
    const parent = mkdtempSync(join(tmpdir(), "rootform-image-context-"));
    const context = join(parent, "context");
    try {
      const staged = stageImageContext({
        context,
        dockerfile: Buffer.from("FROM alpine\n"),
        release,
        version,
      });
      expect(staged.binaries.map(({ architecture }) => architecture)).toEqual([...IMAGE_PLATFORMS]);
      for (const architecture of IMAGE_PLATFORMS) {
        expect(
          readFileSync(join(context, "binaries", architecture, "rootform")).equals(
            executableBody(architecture),
          ),
        ).toBe(true);
      }
      expect(staged.shared.map(({ name }) => name).sort()).toEqual(
        [BINARY_LICENSE_FILE, "THIRD_PARTY_NOTICES.txt", sbomName].sort(),
      );
      expect(readFileSync(join(context, "share", BINARY_LICENSE_FILE))).toEqual(license);
      expect(() =>
        stageImageContext({
          context,
          dockerfile: Buffer.from("FROM alpine\n"),
          release,
          version,
        }),
      ).toThrow("image context must be empty");
    } finally {
      rmSync(parent, { force: true, recursive: true });
      rmSync(release, { force: true, recursive: true });
    }
  });
});

describe("image audit", () => {
  test("accepts an image carrying exactly the released payload", () => {
    const image = verify(buildArchive([{ architecture: "amd64" }, { architecture: "arm64" }]));
    expect(image.variants.map(({ platform }) => platform.architecture)).toEqual([
      ...IMAGE_PLATFORMS,
    ]);
    expect(image.variants.every(({ layerCount }) => layerCount === 2)).toBe(true);
  });

  test("rejects a missing platform", () => {
    expect(() => verify(buildArchive([{ architecture: "amd64" }]))).toThrow(
      "image platform set drifted: amd64",
    );
  });

  test("rejects an executable that is not the released binary", () => {
    expect(() =>
      verify(
        buildArchive([
          { architecture: "amd64", binary: Buffer.from("rebuilt in the image") },
          { architecture: "arm64" },
        ]),
      ),
    ).toThrow(`image payload drifted: ${binaryPath}`);
    expect(() =>
      verify(
        buildArchive([{ architecture: "amd64", binaryMode: 0o644 }, { architecture: "arm64" }]),
      ),
    ).toThrow(`image payload drifted: ${binaryPath}`);
    expect(() =>
      verify(
        buildArchive([{ architecture: "amd64", shareMode: 0o755 }, { architecture: "arm64" }]),
      ),
    ).toThrow(`image payload drifted: ${shareDirectory}/${BINARY_LICENSE_FILE}`);
  });

  test("rejects an entrypoint, command, workdir, user, and Rootform home drift", () => {
    expect(() =>
      verify(
        buildArchive([
          { architecture: "amd64", entrypoint: ["/usr/local/bin/rootform"] },
          { architecture: "arm64" },
        ]),
      ),
    ).toThrow("image must not define an entrypoint");
    expect(() =>
      verify(
        buildArchive([{ architecture: "amd64", command: ["/bin/sh"] }, { architecture: "arm64" }]),
      ),
    ).toThrow("image default command drifted");
    expect(() =>
      verify(
        buildArchive([
          { architecture: "amd64", workingDirectory: "/src" },
          { architecture: "arm64" },
        ]),
      ),
    ).toThrow("image working directory drifted");
    expect(() =>
      verify(buildArchive([{ architecture: "amd64", user: "1000" }, { architecture: "arm64" }])),
    ).toThrow("image default user drifted");
    expect(() =>
      verify(
        buildArchive([
          { architecture: "amd64", home: "/var/cache/rootform" },
          { architecture: "arm64" },
        ]),
      ),
    ).toThrow("image ROOTFORM_HOME drifted");
    expect(() =>
      verify(
        buildArchive([{ architecture: "amd64", userHome: "/root" }, { architecture: "arm64" }]),
      ),
    ).toThrow("image HOME drifted");
  });

  test("rejects a drifted binary license label", () => {
    expect(() =>
      verify(
        buildArchive([
          {
            architecture: "amd64",
            labels: { ...defaultLabels(), "org.opencontainers.image.licenses": "Apache-2.0" },
          },
          { architecture: "arm64" },
        ]),
      ),
    ).toThrow("image label drifted: org.opencontainers.image.licenses");
  });

  test("rejects bundled dialects, Terraform, and unexpected payload", () => {
    expect(() =>
      verify(
        buildArchive([
          {
            architecture: "amd64",
            extraFile: { body: Buffer.from("dialect\n"), path: "/opt/aws/dialect.rf" },
          },
          { architecture: "arm64" },
        ]),
      ),
    ).toThrow("image carries an unexpected file: /opt/aws/dialect.rf");
    expect(() =>
      verify(
        buildArchive([
          {
            architecture: "amd64",
            extraFile: { body: Buffer.from("token\n"), path: "/root/.netrc" },
          },
          { architecture: "arm64" },
        ]),
      ),
    ).toThrow("image carries an unexpected file: /root/.netrc");
  });
});

describe("image manifest", () => {
  test("records byte identity, licensing, and platform digests deterministically", () => {
    const archive = buildArchive([{ architecture: "amd64" }, { architecture: "arm64" }]);
    const image = readImageArchive(archive);
    const body = imageManifest({
      binaries: stagedBinaries(),
      image,
      revision,
      shared: sharedAssets,
      version,
    });
    expect(body).toBe(
      imageManifest({
        binaries: [...stagedBinaries()].reverse(),
        image,
        revision,
        shared: [...sharedAssets].reverse(),
        version,
      }),
    );
    const manifest = JSON.parse(body) as {
      binary: {
        license: { spdx: string };
        platforms: Array<{ architecture: string; proof: string; sha256: string }>;
      };
      format_version: string;
      image: { reference: string };
    };
    expect(manifest.format_version).toBe("1");
    expect(manifest.image.reference).toBe(`ghcr.io/rootform-dev/rootform:${version}`);
    expect(manifest.binary.license.spdx).toBe("Elastic-2.0");
    expect(manifest.binary.platforms.map(({ architecture }) => architecture)).toEqual([
      ...IMAGE_PLATFORMS,
    ]);
    expect(
      manifest.binary.platforms.every(({ proof }) => proof === "release-archive-byte-identity"),
    ).toBe(true);
    expect(manifest.binary.platforms[0]?.sha256).toBe(sha256(executableBody("amd64")));
    expect(body.endsWith("}\n")).toBe(true);
  });

  test("never records an absolute local path", () => {
    const archive = buildArchive([{ architecture: "amd64" }, { architecture: "arm64" }]);
    const directory = mkdtempSync(join(tmpdir(), "rootform-image-manifest-"));
    try {
      mkdirSync(join(directory, "release"));
      const body = imageManifest({
        binaries: stagedBinaries(),
        image: readImageArchive(archive),
        revision,
        shared: sharedAssets,
        version,
      });
      expect(body).not.toContain(directory);
      expect(body).not.toMatch(/\/(?:Users|home)\//u);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
