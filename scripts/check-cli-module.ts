#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const moduleRoot = join(root, "cli");

// Every Go command runs against the committed module alone: a workspace or a
// mutable module download would let a gate pass on code nobody committed.
const environment: Record<string, string | undefined> = {
  ...process.env,
  GOFLAGS: "-mod=readonly",
  GOWORK: "off",
};

export function pinnedToolchain(goMod: string): string {
  const toolchain = goMod.match(/^toolchain\s+(go\d+\.\d+(?:\.\d+)?)\s*$/mu)?.[1];
  if (!toolchain) throw new Error("cli/go.mod must pin an exact toolchain directive");
  return toolchain;
}

function goFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...goFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".go")) files.push(path);
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function run(label: string, command: string[]): string {
  console.log(`\n==> ${label}`);
  const result = Bun.spawnSync({
    cmd: command,
    cwd: moduleRoot,
    env: environment,
    stderr: "pipe",
    stdout: "pipe",
  });
  const stdout = result.stdout.toString();
  if (result.exitCode !== 0) {
    process.stdout.write(stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command.join(" ")} exited ${result.exitCode}`);
  }
  return stdout;
}

if (import.meta.main) {
  const toolchain = pinnedToolchain(readFileSync(join(moduleRoot, "go.mod"), "utf8"));
  environment.GOTOOLCHAIN = toolchain;
  const version = run("Go toolchain", ["go", "env", "GOVERSION"]).trim();
  if (version !== toolchain) throw new Error(`expected Go toolchain ${toolchain}, got ${version}`);
  const gofmt = join(
    run("Go root", ["go", "env", "GOROOT"]).trim(),
    "bin",
    process.platform === "win32" ? "gofmt.exe" : "gofmt",
  );
  if (!existsSync(gofmt)) throw new Error(`gofmt is missing for the ${toolchain} toolchain`);
  const unformatted = run("gofmt", [gofmt, "-l", ...goFiles(moduleRoot)]).trim();
  if (unformatted) {
    const paths = unformatted.split("\n").map((path) => relative(root, path));
    throw new Error(`gofmt required for:\n${paths.join("\n")}`);
  }
  run("Go module verification", ["go", "mod", "verify"]);
  run("Go vet", ["go", "vet", "./..."]);
  process.stdout.write(run("Go tests", ["go", "test", "./..."]));
  run("Form schema", ["go", "run", "./internal/architecture/document/schema/cmd", "-check"]);
  run("Policy result schema", ["go", "run", "./internal/policy/schema/cmd", "-check"]);
  run("CLI reference", ["go", "run", "./internal/clireference/cmd", "-check"]);
  console.log("\nCLI module checks passed.");
}
