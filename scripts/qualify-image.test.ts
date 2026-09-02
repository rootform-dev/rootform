import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseQualificationArguments,
  rewriteArtifactPins,
  rootformDockerArguments,
  temporaryPermissionRepairArguments,
} from "./qualify-image.ts";

const revision = "a".repeat(40);

test("image qualification CLI accepts only exact explicit inputs", () => {
  expect(
    parseQualificationArguments(
      [
        "--dialects=dialects",
        "--evidence=evidence.json",
        "--image=image",
        "--oras=bin/oras",
        `--revision=${revision}`,
        "--rootform-bin=bin/rootform",
        "--trivy=bin/trivy",
        "--version=0.1.0",
      ],
      "/workspace",
    ),
  ).toEqual({
    dialects: "/workspace/dialects",
    evidence: "/workspace/evidence.json",
    image: "/workspace/image",
    oras: "/workspace/bin/oras",
    revision,
    rootformBinary: "/workspace/bin/rootform",
    trivy: "/workspace/bin/trivy",
    version: "0.1.0",
  });
  expect(() =>
    parseQualificationArguments([
      "--dialects=dialects",
      "--dialects=again",
      "--evidence=evidence.json",
    ]),
  ).toThrow("duplicate image qualification argument");
  expect(() =>
    parseQualificationArguments([
      "--dialects=dialects",
      "--evidence=evidence.json",
      "--image=image",
      "--oras=oras",
      "--revision=dev",
      "--rootform-bin=rootform",
      "--trivy=trivy",
      "--version=0.1.0",
    ]),
  ).toThrow("--revision must be one exact commit");
});

test("image qualification repairs only its exact temporary mount", () => {
  const temporary = join(tmpdir(), "rootform-image-qualification-proof");
  expect(temporaryPermissionRepairArguments("rootform-qualification:test", temporary)).toEqual([
    "docker",
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--user",
    "0:0",
    "--cap-drop",
    "ALL",
    "--cap-add",
    "DAC_OVERRIDE",
    "--cap-add",
    "FOWNER",
    "--security-opt",
    "no-new-privileges",
    "--volume",
    `${temporary}:/cleanup`,
    "--entrypoint",
    "/bin/chmod",
    "rootform-qualification:test",
    "-R",
    "a+rwX",
    "/cleanup",
  ]);
  expect(() => temporaryPermissionRepairArguments("rootform-qualification:test", "/")).toThrow(
    "image qualification temporary directory is invalid",
  );
});

test("registry qualification rewrites only requested artifact pins", () => {
  const original = {
    format_version: "1",
    index: { manifest_digest: `sha256:${"1".repeat(64)}`, repository: "official.test/dialects" },
    unsupported_providers: [],
    entries: [
      {
        name: "aws",
        version: "0.1.0",
        digest: `sha256:${"2".repeat(64)}`,
        artifact: {
          repository: "official.test/dialects",
          manifest_digest: `sha256:${"3".repeat(64)}`,
          layer_digest: `sha256:${"4".repeat(64)}`,
          download_size: 10,
          install_size: 20,
        },
      },
      {
        name: "core",
        version: "0.1.0",
        digest: `sha256:${"5".repeat(64)}`,
        artifact: {
          repository: "official.test/dialects",
          manifest_digest: `sha256:${"6".repeat(64)}`,
          layer_digest: `sha256:${"7".repeat(64)}`,
          download_size: 30,
          install_size: 40,
        },
      },
    ],
  };
  const rewritten = JSON.parse(
    rewriteArtifactPins(JSON.stringify(original), {
      aws: {
        manifestDigest: `sha256:${"8".repeat(64)}`,
        repository: "private.test/team/dialects",
      },
    }),
  ) as typeof original;
  expect(rewritten.index).toEqual(original.index);
  expect(rewritten.entries[0]?.artifact.repository).toBe("private.test/team/dialects");
  expect(rewritten.entries[0]?.artifact.manifest_digest).toBe(`sha256:${"8".repeat(64)}`);
  expect(rewritten.entries[0]?.artifact.layer_digest).toBe(
    original.entries[0]?.artifact.layer_digest,
  );
  expect(rewritten.entries[0]?.artifact.download_size).toBe(
    original.entries[0]?.artifact.download_size,
  );
  expect(rewritten.entries[0]?.artifact.install_size).toBe(
    original.entries[0]?.artifact.install_size,
  );
  expect(rewritten.entries[1]).toEqual(original.entries[1]);
  expect(() => rewriteArtifactPins(JSON.stringify(original), { google: {} })).toThrow(
    "rootform.lock has no requested dialect",
  );
});

test("registry qualification mounts Docker config and helper without CLI credentials", () => {
  const arguments_ = rootformDockerArguments({
    architecture: "amd64",
    arguments: ["init", ".", "--locked", "--no-input"],
    ca: "/qualification/ca.crt",
    dockerConfig: "/qualification/docker",
    helper: {
      binaries: "/qualification/helpers",
      state: "/qualification/helper-state",
    },
    home: "/qualification/home",
    image: "rootform:test",
    network: "qualification",
    project: "/qualification/project",
  });
  expect(arguments_).toContain("/qualification/docker:/run/rootform-docker-config:ro");
  expect(arguments_).toContain("DOCKER_CONFIG=/run/rootform-docker-config");
  expect(arguments_).toContain("/qualification/helpers:/run/rootform-credential-helpers:ro");
  expect(arguments_).toContain("/qualification/helper-state:/run/rootform-helper-state");
  expect(arguments_.join(" ")).not.toMatch(/(?:password|token|username)=/iu);
});
