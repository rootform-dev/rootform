import { expect, test } from "bun:test";
import {
  encodeSelectionLock,
  type PackagePin,
  parseRegistryQualificationArguments,
} from "./qualify-registry.ts";

const revision = "a".repeat(40);

test("registry qualification accepts only portable explicit inputs", () => {
  expect(
    parseRegistryQualificationArguments(
      [
        "--ca-file=ca.pem",
        "--credential-proof=helper.txt",
        "--documentation-url=https://example.com/rootform/docs",
        "--evidence=evidence.json",
        "--licenses=Apache-2.0",
        "--repository=registry.example/team/dialects",
        `--revision=${revision}`,
        "--rootform-bin=bin/rootform",
        "--source-url=https://example.com/rootform",
      ],
      "/workspace",
    ),
  ).toMatchObject({
    caFile: "/workspace/ca.pem",
    credentialProof: "/workspace/helper.txt",
    documentationURL: "https://example.com/rootform/docs",
    evidence: "/workspace/evidence.json",
    licenses: "Apache-2.0",
    repository: "registry.example/team/dialects",
    revision,
    rootformBinary: "/workspace/bin/rootform",
    sourceURL: "https://example.com/rootform",
  });
});

test("registry qualification rejects routing ambiguity and credential flags", () => {
  const required = [
    "--documentation-url=https://example.com/docs",
    "--evidence=evidence.json",
    "--licenses=Apache-2.0",
    `--revision=${revision}`,
    "--rootform-bin=rootform",
    "--source-url=https://example.com/source",
  ];
  for (const repository of [
    "https://registry.example/team/dialects",
    "user:secret@registry.example/team/dialects",
    "registry.example/team/dialects:latest",
    "registry.example",
  ]) {
    expect(() =>
      parseRegistryQualificationArguments(
        [...required, `--repository=${repository}`],
        "/workspace",
      ),
    ).toThrow("canonical tagless OCI repository");
  }
  expect(() =>
    parseRegistryQualificationArguments(
      [...required, "--repository=registry.example/team/dialects", "--password=secret"],
      "/workspace",
    ),
  ).toThrow("unknown registry qualification argument");
});

test("registry qualification requires canonical explicit provenance", () => {
  const base = [
    "--documentation-url=https://example.com/docs",
    "--evidence=evidence.json",
    "--licenses=Apache-2.0",
    "--repository=registry.example/team/dialects",
    "--rootform-bin=rootform",
    "--source-url=https://example.com/source",
  ];
  expect(() =>
    parseRegistryQualificationArguments([...base, "--revision=dev"], "/workspace"),
  ).toThrow("exact Git commit");
  expect(() =>
    parseRegistryQualificationArguments(
      [
        ...base.filter((value) => !value.startsWith("--source-url=")),
        "--source-url=https://user@example.com/source",
        `--revision=${revision}`,
      ],
      "/workspace",
    ),
  ).toThrow("canonical HTTPS URL");
});

test("qualification lock selects only exact third-party content", () => {
  const pin = (marker: string): PackagePin => ({
    contentDigest: `sha256:${marker.repeat(64)}`,
    downloadSize: 100,
    installSize: 200,
    layerDigest: `sha256:${marker.repeat(64)}`,
    manifestDigest: `sha256:${marker.repeat(64)}`,
    manifestSize: 300,
    tag: "unused",
  });
  const lock = JSON.parse(
    encodeSelectionLock("registry.example/team/catalog", pin("a"), pin("b")),
  ) as Record<string, unknown>;
  expect(lock.format_version).toBe("1");
  expect(lock.dialects).toHaveLength(1);
  expect(lock.policy_packs).toHaveLength(1);
  expect(lock.excluded_owners).toEqual([]);
  expect(lock.replacements).toEqual([]);
  expect(lock).not.toHaveProperty("extensions");
  expect(lock).not.toHaveProperty("index");
});
