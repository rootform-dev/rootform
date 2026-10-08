#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { extractReleaseBinary } from "../extract-release-binary.ts";

export function referenceRuntimeTag(pin: {
  repository: string;
  version: string;
  release_tag?: string;
}): string {
  if (
    pin.repository !== "rootform-dev/rootform" ||
    !/^0\.1\.0(?:-pr\.[0-9]+\.[0-9]+)?$/u.test(pin.version) ||
    (pin.release_tag !== undefined && pin.release_tag !== `verification-runtime-${pin.version}`)
  )
    throw new Error("Invalid reference runtime identity");
  return pin.release_tag ?? `v${pin.version}`;
}

/** Only published, exact, checksum-verified bytes; no backend checkout or build.
 * This is compatibility evidence against the reference runtime, not a release. */
export async function verificationRuntime(output: string): Promise<string> {
  const pin = JSON.parse(
    readFileSync(join(import.meta.dir, "../../dependencies/verification-runtime.json"), "utf8"),
  ) as {
    repository: string;
    version: string;
    release_tag?: string;
    archives: Record<string, string>;
  };
  const releaseTag = referenceRuntimeTag(pin);
  const target = `${process.platform === "darwin" ? "darwin" : process.platform}_${process.arch === "x64" ? "amd64" : process.arch}`;
  const digest = pin.archives[target];
  if (!digest || !/^[0-9a-f]{64}$/u.test(digest))
    throw new Error(`No qualified runtime for ${target}`);
  const directory = resolve(output);
  mkdirSync(directory, { recursive: true });
  const asset = `rootform_${pin.version}_${target}.tar.gz`;
  const archive = join(directory, asset);
  if (!existsSync(archive)) {
    const response = await fetch(
      `https://github.com/${pin.repository}/releases/download/${releaseTag}/${asset}`,
      { signal: AbortSignal.timeout(60000) },
    );
    if (!response.ok) throw new Error(`Reference runtime download: HTTP ${response.status}`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.length > 64 * 1024 * 1024) throw new Error("Oversized runtime archive");
    writeFileSync(archive, body, { flag: "wx" });
  }
  if (createHash("sha256").update(readFileSync(archive)).digest("hex") !== digest)
    throw new Error("Reference runtime checksum mismatch");
  const binary = join(directory, "rootform");
  if (!existsSync(binary))
    extractReleaseBinary({
      release: directory,
      output: binary,
      version: pin.version,
      target: target.replace("_", "-"),
    });
  return binary;
}

if (import.meta.main)
  console.log(await verificationRuntime(process.argv[2] ?? "artifacts/ci-runtime"));
