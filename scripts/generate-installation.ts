#!/usr/bin/env bun

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  normalizeVersion,
  RELEASE_TARGETS,
  releaseAssetName,
  releaseAssetNames,
} from "./release/contract.ts";
import { parseChecksumFile, sha256 } from "./release/digest.ts";

type Artifact = {
  archive_format: string;
  architecture: string;
  asset: string;
  bytes: number;
  executable: string;
  operating_system: string;
  proof: string;
  sha256: string;
};

export function installationMetadata(release: string, version: string): Map<string, string> {
  const manifestName = `rootform_${version}_manifest.json`;
  const sums = parseChecksumFile(readFileSync(join(release, "SHA256SUMS"), "utf8"));
  const expectedNames = releaseAssetNames(version);
  const names = readdirSync(release).sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error("release asset inventory is incomplete");
  }
  for (const name of expectedNames) {
    if (name === "SHA256SUMS") continue;
    if (sums.get(name) !== sha256(readFileSync(join(release, name)))) {
      throw new Error(`release checksum drifted: ${name}`);
    }
  }
  if (sums.size !== expectedNames.length - 1) throw new Error("release checksum inventory drifted");
  const manifestBody = readFileSync(join(release, manifestName));
  if (sums.get(manifestName) !== sha256(manifestBody)) {
    throw new Error("release manifest checksum mismatch");
  }
  const manifest = JSON.parse(manifestBody.toString("utf8")) as {
    format_version?: string;
    product?: { version?: string; tag?: string; name?: string };
    artifacts?: Artifact[];
  };
  if (
    manifest.format_version !== "1" ||
    manifest.product?.version !== version ||
    manifest.product?.tag !== `v${version}` ||
    manifest.product?.name !== "rootform" ||
    !Array.isArray(manifest.artifacts) ||
    manifest.artifacts.length !== RELEASE_TARGETS.length
  ) {
    throw new Error("release version metadata is invalid");
  }
  const digests = new Map<string, string>();
  for (const target of RELEASE_TARGETS) {
    const asset = releaseAssetName(version, target);
    const records = manifest.artifacts.filter((entry) => entry.asset === asset);
    const record = records[0];
    if (
      records.length !== 1 ||
      record?.operating_system !== target.operatingSystem ||
      record.architecture !== target.architecture ||
      record.archive_format !== target.archiveFormat ||
      record.executable !== target.executable ||
      record.proof !== "raw-byte-identity" ||
      record.bytes !== readFileSync(join(release, asset)).byteLength ||
      !/^[0-9a-f]{64}$/u.test(record.sha256) ||
      sums.get(asset) !== record.sha256 ||
      !existsSync(join(release, asset)) ||
      sha256(readFileSync(join(release, asset))) !== record.sha256
    ) {
      throw new Error(`release archive metadata drifted: ${asset}`);
    }
    digests.set(`${target.operatingSystem}-${target.architecture}`, record.sha256);
  }
  return digests;
}

function releaseBase(value: string): string {
  const parsed = new URL(value);
  const local =
    parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !local) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("release base URL must use HTTPS or localhost HTTP");
  }
  return value.replace(/\/$/u, "");
}

export function generateInstallation(options: {
  baseUrl: string;
  output: string;
  release: string;
  version: string;
}): void {
  const version = normalizeVersion(options.version);
  const base = releaseBase(options.baseUrl);
  const digests = installationMetadata(options.release, version);
  if (existsSync(options.output)) throw new Error("installation output already exists");
  mkdirSync(options.output, { recursive: true });
  for (const [source, output] of [
    ["install.sh", "install"],
    ["install.ps1", "install.ps1"],
  ] as const) {
    const body = readFileSync(join(import.meta.dir, "..", "installers", source), "utf8");
    writeFileSync(join(options.output, output), body.replaceAll("@ROOTFORM_VERSION@", version), {
      flag: "wx",
    });
  }
  const formula = `class Rootform < Formula
  desc "Architecture compiler and policy CLI"
  homepage "https://rootform.dev"
  version "${version}"
  license "Elastic-2.0"

  depends_on macos: :monterey

  on_arm do
    url "${base}/rootform_#{version}_darwin_arm64.tar.gz"
    sha256 "${digests.get("darwin-arm64")}"
  end

  on_intel do
    url "${base}/rootform_#{version}_darwin_amd64.tar.gz"
    sha256 "${digests.get("darwin-amd64")}"
  end

  def install
    bin.install "rootform"
    pkgshare.install "ROOTFORM-BINARY-LICENSE.txt"
    pkgshare.install "THIRD_PARTY_NOTICES.txt"
    pkgshare.install "rootform_#{version}_sbom.spdx.json"
    pkgshare.install "SHA256SUMS"
  end

  test do
    assert_match "rootform #{version}", shell_output("#{bin}/rootform version")
  end
end
`;
  const formulaDirectory = join(options.output, "Formula");
  mkdirSync(formulaDirectory);
  writeFileSync(join(formulaDirectory, "rootform.rb"), formula, { flag: "wx" });
  const manifestDirectory = join(
    options.output,
    "winget",
    "manifests",
    "r",
    "Rootform",
    "Rootform",
    version,
  );
  mkdirSync(manifestDirectory, { recursive: true });
  const name = "Rootform.Rootform";
  const schemaVersion = "1.10.0";
  const header = (kind: string) =>
    `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${kind}.${schemaVersion}.schema.json\n`;
  writeFileSync(
    join(manifestDirectory, `${name}.yaml`),
    `${header("version")}PackageIdentifier: ${name}\nPackageVersion: ${version}\nDefaultLocale: en-US\nManifestType: version\nManifestVersion: ${schemaVersion}\n`,
    { flag: "wx" },
  );
  writeFileSync(
    join(manifestDirectory, `${name}.locale.en-US.yaml`),
    `${header("defaultLocale")}PackageIdentifier: ${name}\nPackageVersion: ${version}\nPackageLocale: en-US\nPublisher: Rootform\nPackageName: Rootform\nLicense: Elastic-2.0\nLicenseUrl: ${base}/ROOTFORM-BINARY-LICENSE.txt\nShortDescription: Architecture compiler and policy CLI\nPackageUrl: https://rootform.dev\nManifestType: defaultLocale\nManifestVersion: ${schemaVersion}\n`,
    { flag: "wx" },
  );
  writeFileSync(
    join(manifestDirectory, `${name}.installer.yaml`),
    `${header("installer")}PackageIdentifier: ${name}\nPackageVersion: ${version}\nInstallerType: zip\nInstallers:\n  - Architecture: x64\n    InstallerUrl: ${base}/rootform_${version}_windows_amd64.zip\n    InstallerSha256: ${digests.get("windows-amd64")?.toUpperCase()}\n    NestedInstallerType: portable\n    NestedInstallerFiles:\n      - RelativeFilePath: rootform.exe\n        PortableCommandAlias: rootform\nManifestType: installer\nManifestVersion: ${schemaVersion}\n`,
    { flag: "wx" },
  );
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index];
      const value = args[index + 1];
      if (!key?.startsWith("--") || !value || values.has(key))
        throw new Error("invalid installation generation arguments");
      values.set(key, value);
    }
    const version = normalizeVersion(values.get("--version") ?? "");
    const release = values.get("--release");
    const output = values.get("--output");
    if (!release || !output) throw new Error("--release and --output are required");
    generateInstallation({
      baseUrl:
        values.get("--base-url") ??
        `https://github.com/rootform-dev/rootform/releases/download/v${version}`,
      output: resolve(output),
      release: resolve(release),
      version,
    });
    console.log(`Generated installation artifacts for Rootform ${version}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
