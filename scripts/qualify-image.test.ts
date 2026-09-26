import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseQualificationArguments,
  registryCompletedRequestCount,
  rootformDockerArguments,
  temporaryPermissionRepairArguments,
} from "./qualify-image.ts";

const revision = "a".repeat(40);

test("image qualification accepts only current explicit inputs", () => {
  expect(
    parseQualificationArguments(
      [
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
      "--evidence=evidence.json",
      "--image=image",
      "--oras=oras",
      `--revision=${revision}`,
      "--rootform-bin=rootform",
      "--trivy=trivy",
      "--version=0.1.0",
      "--dialects=obsolete",
    ]),
  ).toThrow("unknown image qualification argument");
  expect(() =>
    parseQualificationArguments([
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

test("runtime container keeps project and home mount permissions separate", () => {
  const arguments_ = rootformDockerArguments({
    architecture: "amd64",
    arguments: ["run", "plan.json", "--project", ".", "--locked", "--no-serve", "--format", "json"],
    ca: "/qualification/ca.crt",
    home: "/qualification/home",
    image: "rootform:test",
    network: "qualification",
    project: "/qualification/project",
    projectReadOnly: true,
  });
  expect(arguments_).toContain("/qualification/project:/workspace:ro");
  expect(arguments_).toContain("/qualification/home:/home/rootform/.rootform");
  expect(arguments_).toContain("/qualification/ca.crt:/run/rootform-ca.crt:ro");
  expect(arguments_).toContain("--read-only");
  expect(arguments_).toContain("ALL");
});

test("registry request counter ignores startup and access-log noise", () => {
  const logs = [
    'level=info msg="listening on [::]:443"',
    'level=debug msg="authorizing request" http.request.method=GET',
    'level=info msg="response completed" http.request.method=GET http.response.status=200',
    '127.0.0.1 - - "GET /v2/ HTTP/1.1" 200',
    'level=info msg="response completed" http.request.method=HEAD http.response.status=200',
  ].join("\n");
  expect(registryCompletedRequestCount(logs)).toBe(2);
});
