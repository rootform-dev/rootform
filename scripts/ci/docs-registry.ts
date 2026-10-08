#!/usr/bin/env bun
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyRegistryExamples } from "../docs-registry-examples.ts";

// CNCF Distribution, immutable multi-platform image. No remote publication or credentials.
const image = "registry:3@sha256:ddf754342cfc8acc51a56d5d0ab6af06826461864460636d8bd5c546dab2a7b8";
const root = resolve(import.meta.dir, "../..");
const scratch = mkdtempSync(join(tmpdir(), "rootform-docs-registry-"));
let container: string | undefined;
function run(command: string[]): string {
  const result = Bun.spawnSync(command, {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  });
  if (result.exitCode !== 0)
    throw new Error(`Local registry command failed: ${command[0]}\n${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}
try {
  const caFile = join(scratch, "registry.crt");
  const keyFile = join(scratch, "registry.key");
  const config = join(scratch, "openssl.cnf");
  writeFileSync(
    config,
    "[req]\ndistinguished_name=dn\nx509_extensions=extensions\nprompt=no\n[dn]\nCN=localhost\n[extensions]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n",
  );
  run([
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-config",
    config,
    "-keyout",
    keyFile,
    "-out",
    caFile,
  ]);
  container = run([
    "docker",
    "run",
    "--rm",
    "-d",
    "-p",
    "127.0.0.1:0:5000",
    "--mount",
    `type=bind,source=${scratch},target=/certs,readonly`,
    "-e",
    "REGISTRY_HTTP_TLS_CERTIFICATE=/certs/registry.crt",
    "-e",
    "REGISTRY_HTTP_TLS_KEY=/certs/registry.key",
    "-e",
    "OTEL_TRACES_EXPORTER=none",
    image,
  ]);
  if (!/^[a-f0-9]{64}$/u.test(container))
    throw new Error("Invalid disposable registry container identity");
  const address = run(["docker", "port", container, "5000/tcp"]);
  if (!/^127\.0\.0\.1:[0-9]+$/u.test(address))
    throw new Error("Registry must bind only to loopback");
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt++) {
    try {
      const response = await fetch(`https://${address}/v2/`, {
        tls: { ca: readFileSync(caFile) },
        signal: AbortSignal.timeout(1000),
      });
      ready = response.ok;
    } catch {
      /* Registry startup has not completed. */
    }
    if (!ready) await Bun.sleep(100);
  }
  if (!ready) throw new Error("Disposable TLS registry did not start");
  if (!process.env.ROOTFORM_BIN)
    throw new Error("ROOTFORM_BIN must identify the checksum-verified reference runtime");
  for (const result of verifyRegistryExamples({
    binary: resolve(process.env.ROOTFORM_BIN),
    registry: address,
    caFile,
  }))
    console.log(result);
  console.log("7/7 registry documentation markers verified against disposable local TLS registry.");
} finally {
  if (container)
    Bun.spawnSync(["docker", "rm", "--force", "--volumes", container], {
      stdout: "ignore",
      stderr: "ignore",
    });
  rmSync(scratch, { recursive: true, force: true });
}
