export type ReleaseTarget = {
  architecture: "amd64" | "arm64";
  archiveFormat: "tar.gz" | "zip";
  executable: "rootform" | "rootform.exe";
  handoffFile: string;
  operatingSystem: "darwin" | "linux" | "windows";
};

export const RELEASE_TARGETS: readonly ReleaseTarget[] = [
  {
    architecture: "amd64",
    archiveFormat: "tar.gz",
    executable: "rootform",
    handoffFile: "rootform_linux_amd64",
    operatingSystem: "linux",
  },
  {
    architecture: "arm64",
    archiveFormat: "tar.gz",
    executable: "rootform",
    handoffFile: "rootform_linux_arm64",
    operatingSystem: "linux",
  },
  {
    architecture: "amd64",
    archiveFormat: "tar.gz",
    executable: "rootform",
    handoffFile: "rootform_darwin_amd64",
    operatingSystem: "darwin",
  },
  {
    architecture: "arm64",
    archiveFormat: "tar.gz",
    executable: "rootform",
    handoffFile: "rootform_darwin_arm64",
    operatingSystem: "darwin",
  },
  {
    architecture: "amd64",
    archiveFormat: "zip",
    executable: "rootform.exe",
    handoffFile: "rootform_windows_amd64.exe",
    operatingSystem: "windows",
  },
];

const SEMVER =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u;

export function normalizeVersion(input: string): string {
  const version = input.trim();
  if (!SEMVER.test(version)) throw new Error(`invalid release version: ${input}`);
  return version;
}

export function handoffBundleName(version: string): string {
  return `rootform_engine_handoff_${normalizeVersion(version)}.tar.gz`;
}

export function releaseAssetName(version: string, target: ReleaseTarget): string {
  return `rootform_${normalizeVersion(version)}_${target.operatingSystem}_${target.architecture}.${target.archiveFormat}`;
}

export function releaseAssetNames(version: string): string[] {
  const normalized = normalizeVersion(version);
  return [
    ...RELEASE_TARGETS.map((target) => releaseAssetName(normalized, target)),
    "ROOTFORM-BINARY-LICENSE.txt",
    "SHA256SUMS",
    "THIRD_PARTY_NOTICES.txt",
    `rootform_${normalized}_manifest.json`,
    `rootform_${normalized}_sbom.spdx.json`,
  ].sort((left, right) => left.localeCompare(right, "en"));
}
