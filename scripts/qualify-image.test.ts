import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseGenericPublication,
  parseQualificationArguments,
  publishedDialectVersion,
  registryCompletedRequestCount,
  registryManifestWriteTags,
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

test("registry qualification reads dialect version from publication evidence", () => {
  const publication = {
    artifacts: [
      { manifest_digest: `sha256:${"1".repeat(64)}`, name: "aws", version: "0.1.0" },
      { manifest_digest: `sha256:${"2".repeat(64)}`, name: "core", version: "0.1.0" },
    ],
    format_version: "1",
    index: { manifest_digest: `sha256:${"3".repeat(64)}` },
  };
  expect(publishedDialectVersion(publication, "aws")).toBe("0.1.0");
  expect(() => publishedDialectVersion(publication, "google")).toThrow("no unique google version");
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

test("registry qualification counts completed HTTP requests, not log noise", () => {
  const logs = [
    'level=info msg="listening on [::]:443"',
    'level=debug msg="authorizing request" http.request.method=GET',
    'level=info msg="response completed" http.request.method=GET http.response.status=200',
    '127.0.0.1 - - "GET /v2/ HTTP/1.1" 200',
    'level=info msg="response completed" http.request.method=HEAD http.response.status=200',
    "unrelated shutdown message",
  ].join("\n");
  expect(registryCompletedRequestCount(logs)).toBe(2);
});

test("generic publication evidence stays format 1, canonical, and digest-pinned", () => {
  const repository = "registry.example/acme/dialects";
  const provenance = {
    documentation: "https://example.com/docs",
    licenses: "MPL-2.0",
    revision,
    source: "https://example.com/source",
  };
  const dialect = (name: string, marker: string) => ({
    manifest_digest: `sha256:${marker.repeat(64)}`,
    manifest_size: 512,
    name,
    provenance,
    repository,
    size: 1024,
    status: "published" as const,
    tag: `dialect-${name}-0.1.0`,
    version: "0.1.0",
  });
  const indexDigest = `sha256:${"f".repeat(64)}`;
  const evidence = {
    dialects: [dialect("aws", "a"), dialect("core", "c")],
    dry_run: false,
    format_version: "1" as const,
    index: {
      manifest_digest: indexDigest,
      manifest_size: 768,
      provenance,
      repository,
      size: 2048,
      status: "published" as const,
      tag: `index-sha256-${"f".repeat(64)}`,
    },
    repository,
  };

  expect(parseGenericPublication(JSON.stringify(evidence), repository, true)).toEqual(evidence);
  expect(parseGenericPublication(JSON.stringify(evidence), repository, true)).toEqual(
    parseGenericPublication(JSON.stringify(evidence), repository, true),
  );
  expect(() =>
    parseGenericPublication(JSON.stringify({ ...evidence, format_version: "2" }), repository, true),
  ).toThrow("generic publication result is invalid");
  expect(() =>
    parseGenericPublication(
      JSON.stringify({ ...evidence, dialects: [...evidence.dialects].reverse() }),
      repository,
      true,
    ),
  ).toThrow("not canonical");
  expect(() =>
    parseGenericPublication(
      JSON.stringify({
        ...evidence,
        index: { ...evidence.index, tag: "official-index-v1" },
      }),
      repository,
      true,
    ),
  ).toThrow("generic publication index is invalid");
  expect(() =>
    parseGenericPublication(JSON.stringify(evidence), "other.example/x/y", true),
  ).toThrow("generic publication result is invalid");
});

test("registry qualification observes successful manifest tag writes in order", () => {
  const logs = [
    'time="2026-09-03T10:00:00Z" level=info msg="response completed" http.request.method=PUT http.request.uri=/v2/acme/dialects/manifests/dialect-core-0.1.0 http.response.status=201',
    'time="2026-09-03T10:00:01Z" level=info msg="response completed" http.request.method=PUT http.request.uri="/v2/other/dialects/manifests/ignored" http.response.status=201',
    'time="2026-09-03T10:00:02Z" level=info msg="response completed" http.request.method=HEAD http.request.uri="/v2/acme/dialects/manifests/ignored" http.response.status=200',
    `time="2026-09-03T10:00:03Z" level=info msg="response completed" http.request.method=PUT http.request.uri="/v2/acme/dialects/manifests/index-sha256-${"f".repeat(64)}" http.response.status=201`,
  ].join("\n");
  expect(registryManifestWriteTags(logs, "acme/dialects")).toEqual([
    "dialect-core-0.1.0",
    `index-sha256-${"f".repeat(64)}`,
  ]);
});
