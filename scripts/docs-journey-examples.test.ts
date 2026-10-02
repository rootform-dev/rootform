import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveDocumentationCommand } from "./docs-journey-examples.ts";

test("documentation server receives SIGINT and closes both output streams", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rootform-docs-signal-"));
  try {
    writeFileSync(
      join(directory, "server.ts"),
      'console.log("started"); console.error("stderr started"); process.on("SIGINT", () => { console.log("stopped"); process.exit(0); }); setInterval(() => {}, 1000);\n',
    );
    const result = await serveDocumentationCommand(
      "bun server.ts",
      directory,
      { PATH: process.env.PATH ?? "" },
      {
        interruptAfterMs: 500,
        timeoutMs: 2000,
      },
    );
    expect(result.exit).toBe(0);
    expect(result.stdout).toBe("started\nstopped\n");
    expect(result.stderr).toBe("stderr started\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("documentation server that ignores SIGINT is bounded and cannot pass", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rootform-docs-timeout-"));
  try {
    writeFileSync(
      join(directory, "server.ts"),
      'console.log("started"); process.on("SIGINT", () => console.log("interrupted")); process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);\n',
    );
    const start = performance.now();
    const result = await serveDocumentationCommand(
      "bun server.ts",
      directory,
      { PATH: process.env.PATH ?? "" },
      {
        interruptAfterMs: 500,
        timeoutMs: 1000,
      },
    );
    expect(result.exit).not.toBe(0);
    expect(result.stdout).toBe("started\ninterrupted\n");
    expect(performance.now() - start).toBeLessThan(3000);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
