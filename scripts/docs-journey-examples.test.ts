import { expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { markedCommand } from "./docs-core-examples.ts";
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

test("review worktree setup cleans a partial failure and preserves unrelated files", () => {
  const root = resolve(import.meta.dir, "..");
  const page = readFileSync(join(root, "docs/workflows/index.md"), "utf8");
  const directory = mkdtempSync(join(tmpdir(), "rootform-review-cleanup-"));
  const repository = join(directory, "repository");
  const shim = join(directory, "shim");
  const failedAdd = join(directory, "failed-add");
  mkdirSync(repository);
  mkdirSync(shim);
  try {
    const git = (...args: string[]) => {
      const result = Bun.spawnSync(["git", ...args], {
        cwd: repository,
        stdout: "pipe",
        stderr: "pipe",
      });
      if (result.exitCode !== 0)
        throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
      return result.stdout.toString().trim();
    };
    const shell = (script: string, env: Record<string, string | undefined> = process.env) =>
      Bun.spawnSync(["/bin/sh", "-eu", "-c", script], {
        cwd: repository,
        env,
        stdout: "pipe",
        stderr: "pipe",
        timeout: 15000,
      });

    git("init", "--quiet");
    git("config", "user.name", "Rootform docs test");
    git("config", "user.email", "docs@example.invalid");
    writeFileSync(join(repository, "source.txt"), "base\n");
    git("add", "source.txt");
    git("commit", "--quiet", "-m", "base");
    const base = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", base);
    writeFileSync(join(repository, "source.txt"), "head\n");
    git("commit", "--all", "--quiet", "-m", "head");

    const realGit = Bun.spawnSync(["/bin/sh", "-c", "command -v git"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (realGit.exitCode !== 0) throw new Error("git executable was not found");
    writeFileSync(
      join(shim, "git"),
      [
        "#!/bin/sh",
        'if [ "$1" = "worktree" ] && [ "$2" = "add" ]; then',
        '  if [ -e "$FAILED_ADD" ]; then',
        "    printf '%s\\n' 'injected second worktree failure' >&2",
        "    exit 73",
        "  fi",
        '  : > "$FAILED_ADD"',
        "fi",
        'exec "$REAL_GIT" "$@"',
        "",
      ].join("\n"),
    );
    chmodSync(join(shim, "git"), 0o755);
    const failEnvironment = {
      ...process.env,
      PATH: `${shim}:${process.env.PATH ?? ""}`,
      REAL_GIT: realGit.stdout.toString().trim(),
      FAILED_ADD: failedAdd,
    };
    const setup = [
      markedCommand(page, "journey-review-revisions"),
      markedCommand(page, "journey-review-worktrees"),
    ].join("\n");
    const failed = shell(setup, failEnvironment);
    expect(failed.exitCode).toBe(73);
    expect(failed.stderr.toString()).toContain("injected second worktree failure");
    const failedRoot = /^Review directory: (.+)$/mu.exec(failed.stdout.toString())?.[1];
    expect(failedRoot).toBeDefined();
    if (!failedRoot) throw new Error("review directory was not reported before worktree creation");
    expect(existsSync(failedRoot)).toBe(false);
    expect(git("status", "--porcelain")).toBe("");
    expect(
      git("worktree", "list", "--porcelain")
        .split("\n")
        .filter((line) => line.startsWith("worktree ")),
    ).toHaveLength(1);

    const scopedCleanup = shell(
      [
        setup,
        'printf "keep\\n" > "$results/unowned.txt"',
        'if cleanup_review; then printf "%s\\n" "unexpected cleanup success" >&2; exit 1; fi',
        'test -f "$results/unowned.txt"',
        'rm -f "$results/unowned.txt"',
        "cleanup_review",
        'test ! -e "$review_root"',
      ].join("\n"),
    );
    expect(scopedCleanup.exitCode).toBe(0);
    const normalRoot = /^Review directory: (.+)$/mu.exec(scopedCleanup.stdout.toString())?.[1];
    expect(normalRoot).toBeDefined();
    if (!normalRoot) throw new Error("review directory was not reported");
    expect(existsSync(normalRoot)).toBe(false);
    expect(git("status", "--porcelain")).toBe("");
    expect(
      git("worktree", "list", "--porcelain")
        .split("\n")
        .filter((line) => line.startsWith("worktree ")),
    ).toHaveLength(1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
