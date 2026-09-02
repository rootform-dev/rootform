import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseQualificationArguments,
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
