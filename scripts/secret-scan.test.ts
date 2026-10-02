import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

test("generated RF inventory hashes are exempt without hiding credential fields", () => {
  const scratch = mkdtempSync(join(tmpdir(), "rootform-secret-inventory-"));
  const source = join(scratch, "source");
  const path = join(source, "docs/assets/renderer/manifest.json");
  const digest = createHash("sha256").update("synthetic scan fixture").digest("hex");
  const report = join(scratch, "report.json");
  const scan = () =>
    Bun.spawnSync(
      [
        "gitleaks",
        "dir",
        "--no-banner",
        "--redact",
        "--config",
        resolve(import.meta.dir, "../.gitleaks.toml"),
        "--report-path",
        report,
        source,
      ],
      { cwd: source, stdout: "pipe", stderr: "pipe" },
    );
  try {
    mkdirSync(dirname(path), { recursive: true });
    const inventory = { "legacy.rf": digest, "current.rf.hcl": digest };
    writeFileSync(path, `${JSON.stringify(inventory, null, 2)}\n`);
    expect(scan().exitCode).toBe(0);
    writeFileSync(path, `${JSON.stringify({ ...inventory, api_key: digest }, null, 2)}\n`);
    expect(scan().exitCode).toBe(1);
    const findings = JSON.parse(readFileSync(report, "utf8")) as Array<{ RuleID: string }>;
    expect(findings.some(({ RuleID }) => RuleID === "generic-api-key")).toBe(true);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
