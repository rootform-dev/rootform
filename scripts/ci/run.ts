#!/usr/bin/env bun
import { resolve } from "node:path";
import { verifyPlaygroundForms } from "../playground-forms.ts";
import { verificationRuntime } from "./runtime.ts";

const root = resolve(import.meta.dir, "../..");
const selected = process.argv.slice(2);
const environment: Record<string, string | undefined> = { ...process.env, GOWORK: "off" };
const commands = new Set<string>();
function run(args: string[]): void {
  const identity = JSON.stringify(args);
  if (commands.has(identity)) return;
  commands.add(identity);
  const result = Bun.spawnSync(args, {
    cwd: root,
    env: environment,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) throw new Error(`Validation failed: ${args.join(" ")}`);
}
if (
  selected.some((lane) =>
    ["dialects", "policies", "examples", "scenarios", "registry"].includes(lane),
  )
)
  environment.ROOTFORM_BIN = await verificationRuntime(
    process.env.RUNNER_TEMP
      ? `${process.env.RUNNER_TEMP}/reference-runtime`
      : "artifacts/ci-runtime",
  );
for (const lane of selected)
  switch (lane) {
    case "docs":
      run(["bun", "scripts/check-docs.ts"]);
      break;
    case "cli":
      run(["bun", "run", "check:cli-module"]);
      break;
    case "dialects":
      run(["bun", "run", "check:dialects"]);
      run(["bun", "run", "verify:dialects"]);
      break;
    case "policies":
      run([environment.ROOTFORM_BIN ?? "", "fmt", "--check", "policy-packs"]);
      for (const name of ["cluster-network-context", "managed-database-network-context"]) {
        run([
          environment.ROOTFORM_BIN ?? "",
          "validate",
          "policy",
          `baseline.policy.${name}`,
          "--policy-pack",
          "policy-packs/baseline",
        ]);
      }
      run(["bun", "scripts/verify-docs-examples.ts", "--documentation-only"]);
      break;
    case "examples":
      run(["bun", "scripts/verify-docs-examples.ts", "--documentation-only"]);
      break;
    case "scenarios":
      console.log((await verifyPlaygroundForms(environment.ROOTFORM_BIN ?? "", root)).join("\n"));
      break;
    case "registry":
      run(["bun", "scripts/ci/docs-registry.ts"]);
      break;
    case "generated":
      run(["bun", "run", "check:cli"]);
      run(["bun", "run", "check:actions"]);
      run(["bun", "run", "check:coverage"]);
      // Every generated diff remains visible as a failing check, never committed here.
      break;
    case "distribution":
      run(["bun", "scripts/validate-oci-core-profile.ts"]);
      run(["bun", "scripts/validate-trivy-policy.ts"]);
      run([
        "bun",
        "test",
        "scripts/release",
        "scripts/assemble-release.test.ts",
        "scripts/build-image.test.ts",
        "scripts/publish-image.test.ts",
        "scripts/download-release.test.ts",
        "scripts/extract-release-binary.test.ts",
        "scripts/qualify-image.test.ts",
        "scripts/qualify-registry.test.ts",
        "scripts/verify-platform-runtime.test.ts",
      ]);
      break;
    case "tooling":
      run(["bun", "run", "typecheck"]);
      run(["bun", "test", "scripts"]);
      break;
    default:
      throw new Error("Unknown validation lane");
  }
