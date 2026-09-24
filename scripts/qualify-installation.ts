#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { generateInstallation } from "./generate-installation.ts";
import { normalizeVersion } from "./release/contract.ts";

const hash = (body: Uint8Array | string) => createHash("sha256").update(body).digest("hex");

type Outcome = { code: number; output: string };

async function run(command: string[], environment: Record<string, string>): Promise<Outcome> {
  const process_ = Bun.spawn(command, {
    env: { ...process.env, ...environment },
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(process_.stdout).text(),
    new Response(process_.stderr).text(),
    process_.exited,
  ]);
  return { code, output: `${stdout}\n${stderr}`.trim() };
}

async function checked(command: string[], environment: Record<string, string>): Promise<string> {
  const result = await run(command, environment);
  if (result.code !== 0)
    throw new Error(`${command[0]} failed (${result.code}): ${result.output.slice(-1800)}`);
  return result.output;
}

async function qualifyCask(generated: string, version: string): Promise<void> {
  const environment = { HOMEBREW_NO_AUTO_UPDATE: "1" };
  const prefix = (await checked(["brew", "--prefix"], environment)).trim();
  const repository = (await checked(["brew", "--repository"], environment)).trim();
  const binary = join(prefix, "bin", "rootform");
  if (existsSync(binary)) throw new Error("preexisting rootform on Homebrew PATH");
  const tap = "rootform/qualification";
  const tapDirectory = join(repository, "Library", "Taps", "rootform", "homebrew-qualification");
  if (existsSync(tapDirectory)) throw new Error("qualification tap already exists");
  await checked(["brew", "tap-new", tap], environment);
  try {
    const casks = join(tapDirectory, "Casks");
    mkdirSync(casks, { recursive: true });
    writeFileSync(join(casks, "rootform.rb"), readFileSync(join(generated, "rootform.rb")));
    for (let iteration = 0; iteration < 2; iteration++) {
      await checked(["brew", "install", "--cask", `${tap}/rootform`], environment);
      if (!existsSync(binary)) throw new Error("Homebrew did not expose rootform on PATH");
      const assessment = await run(["spctl", "--assess", "--type", "execute", binary], {});
      if (assessment.code !== 0) throw new Error("Gatekeeper rejected quarantined Homebrew binary");
      const result = await checked([binary, "version"], {});
      if (!result.includes(`rootform ${version}`))
        throw new Error("Homebrew installed wrong version");
      await checked(["brew", "uninstall", "--cask", `${tap}/rootform`], environment);
      if (existsSync(binary)) throw new Error("Homebrew uninstall left rootform binary");
    }
  } finally {
    if (existsSync(binary))
      await run(["brew", "uninstall", "--cask", `${tap}/rootform`], environment);
    await run(["brew", "untap", tap], environment);
  }
}

async function qualifyWinGet(generated: string, version: string): Promise<void> {
  const manifest = join(generated, "winget", "manifests", "r", "Rootform", "Rootform", version);
  const packageId = "Rootform.Rootform";
  const links = join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links");
  await checked(["winget", "settings", "--enable", "LocalManifestFiles"], {});
  await checked(["winget", "validate", "--manifest", manifest], {});
  const installed = await run(["winget", "list", "--id", packageId, "--exact"], {});
  if (installed.code === 0 && installed.output.includes(packageId)) {
    throw new Error("preexisting WinGet Rootform installation");
  }
  const install = [
    "winget",
    "install",
    "--manifest",
    manifest,
    "--scope",
    "user",
    "--accept-package-agreements",
    "--accept-source-agreements",
    "--disable-interactivity",
  ];
  try {
    for (let iteration = 0; iteration < 2; iteration++) {
      await checked(install, {});
      const command =
        "$env:PATH=$env:LOCALAPPDATA+'\\Microsoft\\WinGet\\Links;'+$env:PATH; $binary=(Get-Command rootform -ErrorAction Stop).Source; if (-not $binary.StartsWith($env:LOCALAPPDATA+'\\Microsoft\\WinGet\\Links', [StringComparison]::OrdinalIgnoreCase)) { throw 'PATH resolved another executable' }; rootform version";
      const result = await checked(["powershell.exe", "-NoProfile", "-Command", command], {});
      if (!result.includes(`rootform ${version}`))
        throw new Error("WinGet installed wrong version");
      await checked(
        ["winget", "uninstall", "--id", packageId, "--exact", "--disable-interactivity"],
        {},
      );
      if (existsSync(join(links, "rootform.exe")))
        throw new Error("WinGet uninstall left rootform alias");
    }
  } finally {
    await run(["winget", "uninstall", "--id", packageId, "--exact", "--disable-interactivity"], {});
  }
}

function releaseFixture(
  release: string,
  version: string,
  platform: string,
  scenario: string,
): Map<string, Buffer> {
  const manifestName = `rootform_${version}_manifest.json`;
  const asset = `rootform_${version}_${platform}.${platform === "windows_amd64" ? "zip" : "tar.gz"}`;
  const files = new Map<string, Buffer>();
  for (const name of ["SHA256SUMS", manifestName, asset])
    files.set(name, readFileSync(join(release, name)));
  if (scenario === "missing-asset") files.delete(asset);
  if (scenario === "missing-metadata") files.delete(manifestName);
  if (scenario === "wrong-checksum") {
    const sums = files.get("SHA256SUMS")?.toString("utf8") ?? "";
    files.set(
      "SHA256SUMS",
      Buffer.from(sums.replace(new RegExp(`^[0-9a-f]{64}(?=  ${asset}$)`, "mu"), "0".repeat(64))),
    );
  }
  if (scenario === "corrupt-archive" || scenario === "invalid-metadata") {
    const manifest = JSON.parse(files.get(manifestName)?.toString("utf8") ?? "") as {
      product: { version: string };
      artifacts: Array<{ asset: string; sha256: string }>;
    };
    if (scenario === "corrupt-archive") {
      const corrupted = Buffer.from(files.get(asset) ?? []);
      corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;
      files.set(asset, corrupted);
      const record = manifest.artifacts.find((entry) => entry.asset === asset);
      if (!record) throw new Error("candidate asset missing from manifest");
      record.sha256 = hash(corrupted);
    } else {
      manifest.product.version = "9.9.9";
    }
    const encoded = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    files.set(manifestName, encoded);
    let sums = files.get("SHA256SUMS")?.toString("utf8") ?? "";
    for (const name of [manifestName, asset]) {
      const body = files.get(name);
      if (body)
        sums = sums.replace(
          new RegExp(`^[0-9a-f]{64}(?=  ${name.replaceAll(".", "\\.")}$)`, "mu"),
          hash(body),
        );
    }
    files.set("SHA256SUMS", Buffer.from(sums));
  }
  return files;
}

async function main(): Promise<void> {
  const values = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key))
      throw new Error("invalid qualification arguments");
    values.set(key, value);
  }
  const version = normalizeVersion(values.get("--version") ?? "");
  const release = resolve(values.get("--release") ?? "");
  const platform = values.get("--platform") ?? "";
  const expected =
    process.platform === "win32"
      ? "windows_amd64"
      : `${process.platform}_${process.arch === "arm64" ? "arm64" : "amd64"}`;
  if (platform !== expected)
    throw new Error(`qualification target ${platform} does not match host ${expected}`);
  const root = mkdtempSync(join(tmpdir(), "rootform-install-qualification-"));
  let script = "";
  const scenarios = new Set([
    "success",
    "missing-asset",
    "missing-metadata",
    "wrong-checksum",
    "corrupt-archive",
    "invalid-metadata",
  ]);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const [scenario, name] = new URL(request.url).pathname.slice(1).split("/");
      if (!scenario || !name || !scenarios.has(scenario))
        return new Response("not found", { status: 404 });
      if (name === "install" || name === "install.ps1") return new Response(readFileSync(script));
      if (scenario === "success" && name === "ROOTFORM-BINARY-LICENSE.txt") {
        return new Response(readFileSync(join(release, name)));
      }
      const body = releaseFixture(release, version, platform, scenario).get(name);
      return body ? new Response(body) : new Response("not found", { status: 404 });
    },
  });
  const outcomes: Record<string, { passed: boolean; exit_code: number }> = {};
  const evidence = values.get("--evidence");
  try {
    const generated = join(root, "generated");
    generateInstallation({
      baseUrl: `http://127.0.0.1:${server.port}/success`,
      output: generated,
      release,
      version,
    });
    script = join(generated, process.platform === "win32" ? "install.ps1" : "install");
    const installation = join(root, "bin");
    mkdirSync(installation);
    const binary = join(installation, process.platform === "win32" ? "rootform.exe" : "rootform");
    const execute = async (scenario: string, extra: Record<string, string> = {}) => {
      const environment = {
        ROOTFORM_RELEASE_BASE_URL: `http://127.0.0.1:${server.port}/${scenario}`,
        ROOTFORM_INSTALL_DIR: installation,
        ROOTFORM_INSTALL_SCRIPT: script,
        ROOTFORM_INSTALL_URL: `http://127.0.0.1:${server.port}/success/install.ps1`,
        ROOTFORM_VERSION: version,
        ...extra,
      };
      if (process.platform === "win32") {
        const command =
          scenario === "success" && Object.keys(extra).length === 0
            ? "Invoke-RestMethod $env:ROOTFORM_INSTALL_URL | Invoke-Expression; if ((Get-Command rootform).Source -ne (Join-Path $env:ROOTFORM_INSTALL_DIR 'rootform.exe')) { throw 'PATH resolved another executable' }; rootform version"
            : "& $env:ROOTFORM_INSTALL_SCRIPT";
        return run(
          ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
          environment,
        );
      }
      if (scenario === "success" && Object.keys(extra).length === 0) {
        return run(
          ["/bin/sh", "-c", `curl -fsSL http://127.0.0.1:${server.port}/success/install | sh`],
          environment,
        );
      }
      return run(["/bin/sh", script], environment);
    };
    for (const scenario of [
      "missing-asset",
      "missing-metadata",
      "wrong-checksum",
      "corrupt-archive",
      "invalid-metadata",
    ]) {
      const result = await execute(scenario);
      outcomes[scenario] = {
        passed: result.code !== 0 && !existsSync(binary),
        exit_code: result.code,
      };
      if (!outcomes[scenario]?.passed)
        throw new Error(`${scenario} did not fail closed: ${result.output}`);
    }
    if (process.platform !== "win32") {
      for (const [scenario, extra] of [
        ["unsupported-os", { ROOTFORM_TEST_OS: "FreeBSD" }],
        ["unsupported-arch", { ROOTFORM_TEST_ARCH: "riscv64" }],
      ] as const) {
        const result = await execute("success", extra);
        outcomes[scenario] = {
          passed: result.code !== 0 && !existsSync(binary),
          exit_code: result.code,
        };
        if (!outcomes[scenario]?.passed) throw new Error(`${scenario} did not fail closed`);
      }
    }
    const impossible = join(root, "blocked-target");
    writeFileSync(impossible, "not a directory");
    const blocked = await execute("success", { ROOTFORM_INSTALL_DIR: impossible });
    outcomes["blocked-target"] = {
      passed: blocked.code !== 0 && !existsSync(binary),
      exit_code: blocked.code,
    };
    if (!outcomes["blocked-target"]?.passed)
      throw new Error("blocked installation target did not fail closed");
    const success = await execute("success");
    if (success.code !== 0 || !existsSync(binary))
      throw new Error(`installation failed: ${success.output}`);
    const versionResult =
      process.platform === "win32"
        ? { code: success.code, output: success.output }
        : await run(
            [
              "/bin/sh",
              "-c",
              'test "$(command -v rootform)" = "$ROOTFORM_INSTALL_DIR/rootform" && rootform version',
            ],
            {
              ROOTFORM_INSTALL_DIR: installation,
              PATH: `${installation}:/usr/bin:/bin`,
            },
          );
    outcomes.success = {
      passed: versionResult.code === 0 && versionResult.output.includes(`rootform ${version}`),
      exit_code: success.code,
    };
    if (!outcomes.success.passed)
      throw new Error(`installed executable failed: ${versionResult.output}`);
    console.log(`Qualified installer ${platform} ${version}: ${Object.keys(outcomes).join(", ")}`);
    if (process.env.ROOTFORM_SKIP_PACKAGE_MANAGER !== "1" && process.platform !== "linux") {
      const packageEvidence = evidence
        ? resolve(evidence).replace(/\.json$/u, "-package.json")
        : undefined;
      try {
        if (process.platform === "darwin") await qualifyCask(generated, version);
        else await qualifyWinGet(generated, version);
        if (packageEvidence)
          writeFileSync(
            packageEvidence,
            `${JSON.stringify({ platform, version, result: "passed" })}\n`,
          );
        console.log(
          `Qualified ${process.platform === "darwin" ? "Homebrew Cask" : "WinGet"} ${platform} ${version}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (packageEvidence)
          writeFileSync(
            packageEvidence,
            `${JSON.stringify({ platform, version, result: "failed", error: message })}\n`,
          );
        throw error;
      }
    }
  } finally {
    if (evidence) {
      mkdirSync(dirname(resolve(evidence)), { recursive: true });
      writeFileSync(
        resolve(evidence),
        `${JSON.stringify({ format_version: "1", platform, version, archive_sha256: hash(readFileSync(join(release, `rootform_${version}_${platform}.${platform === "windows_amd64" ? "zip" : "tar.gz"}`))), outcomes }, null, 2)}\n`,
      );
    }
    server.stop(true);
    rmSync(root, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
