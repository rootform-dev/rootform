import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { validateRendererPresentation } from "./renderer-presentation.ts";

const fixtures = {
  "commerce-platform-base": "commerce-platform/base",
  "commerce-platform-head": "commerce-platform/head",
  "event-driven-platform-base": "event-driven-platform/base",
  "event-driven-platform-head": "event-driven-platform/head",
  "shared-data-platform-base": "shared-data-platform/base",
  "shared-data-platform-head": "shared-data-platform/head",
} as const;
const names = Object.keys(fixtures) as (keyof typeof fixtures)[];
const comparisons = {
  "commerce-platform": {
    base: "commerce-platform-base",
    head: "commerce-platform-head",
    file: "commerce-platform-diff.json",
  },
  "event-driven-platform": {
    base: "event-driven-platform-base",
    head: "event-driven-platform-head",
    file: "event-driven-platform-diff.json",
  },
  "shared-data-platform": {
    base: "shared-data-platform-base",
    head: "shared-data-platform-head",
    file: "shared-data-platform-diff.json",
  },
} as const;
const presentationFiles = Object.keys(comparisons).map((name) => `${name}-presentation.json`);
const expectedInputs = [
  ...names.map((name) => `${name}.json`),
  ...Object.values(comparisons).map(({ file }) => file),
  ...presentationFiles,
].sort();
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs visual: ${message}`);
}

function validPresentation(bytes: Buffer, label: string): void {
  try {
    validateRendererPresentation(JSON.parse(bytes.toString("utf8")), label);
  } catch (error) {
    assert(false, error instanceof Error ? error.message : `${label}: invalid presentation`);
  }
}
type Manifest = {
  format_version: string;
  binary: { version: string; sha256: string };
  fixtures: Record<string, { files: Record<string, string>; architecture_sha256: string }>;
  comparisons: Record<string, { base: string; head: string; diff: string; sha256: string }>;
};

export async function verifyVisualExamples(
  binary: string,
  root: string,
  workspace: string,
  home: string,
): Promise<string[]> {
  const assets = join(root, "docs/assets");
  const manifest = JSON.parse(
    readFileSync(join(assets, "renderer/manifest.json"), "utf8"),
  ) as Manifest;
  const verification = JSON.parse(readFileSync(join(root, "reference/verification.json"), "utf8"));
  const interactive = JSON.parse(readFileSync(join(assets, "renderer/interactive.json"), "utf8"));
  assert(interactive.format_version === "1", "unknown interactive evidence format");
  assert(
    JSON.stringify(Object.keys(interactive.files).sort()) === JSON.stringify(expectedInputs),
    "interactive input inventory changed",
  );
  for (const [file, hash] of Object.entries(interactive.files)) {
    assert(expectedInputs.includes(file), "unexpected interactive input");
    assert(
      digest(readFileSync(join(assets, "renderer", file))) === hash,
      `interactive input changed: ${file}`,
    );
  }
  assert(manifest.format_version === "1", "unknown evidence format");
  assert(
    manifest.binary.sha256 === verification.binary.sha256 &&
      manifest.binary.version === `rootform ${verification.binary.version}`,
    "renderer inputs and executable examples use different baseline editions",
  );
  assert(
    JSON.stringify(Object.keys(manifest.fixtures).sort()) === JSON.stringify([...names].sort()),
    "source inventory changed",
  );
  const working = join(workspace, "visuals");
  mkdirSync(working);
  const env = {
    ...process.env,
    ROOTFORM_HOME: home,
    ROOTFORM_INPUT: "0",
    DOCKER_CONFIG: join(home, "docker"),
    PATH: `${join(home, "bin")}:${process.env.PATH ?? ""}`,
  };
  function run(args: string[], cwd: string): string {
    const result = Bun.spawnSync([binary, ...args], { cwd, env, stdout: "pipe", stderr: "pipe" });
    assert(result.exitCode === 0, `${args.join(" ")}: ${result.stderr}`);
    return result.stdout.toString();
  }
  for (const name of names) {
    const input = join(working, fixtures[name]);
    mkdirSync(input, { recursive: true });
    const sourceRoot = join(root, "examples/playground", fixtures[name]);
    const sourceFiles = ["example.json", "main.tf", "rootform.lock"].sort();
    const expected = manifest.fixtures[name];
    assert(
      expected &&
        JSON.stringify(Object.keys(expected.files).sort()) === JSON.stringify(sourceFiles),
      "unexpected fixture files",
    );
    for (const file of sourceFiles) {
      const source = join(sourceRoot, file);
      assert(
        digest(readFileSync(source)) === expected.files[file],
        `${name}/${file} changed: regenerate renderer inputs`,
      );
      mkdirSync(dirname(join(input, file)), { recursive: true });
      cpSync(source, join(input, file));
    }
    run(["init", ".", "--locked", "--no-input"], input);
    const path = join(working, `${name}.json`);
    run(["build", ".", "--locked", "--output", path], input);
    assert(
      digest(readFileSync(path)) === expected.architecture_sha256,
      `${name} no longer produces the reviewed architecture input`,
    );
    assert(
      readFileSync(path).equals(readFileSync(join(assets, "renderer", `${name}.json`))),
      `${name}: interactive architecture differs from the actual binary`,
    );
    assert(
      digest(readFileSync(join(input, "rootform.lock"))) === expected.files["rootform.lock"],
      `${name} changed its lock`,
    );
  }
  for (const family of Object.keys(comparisons)) {
    validPresentation(
      readFileSync(join(assets, "renderer", `${family}-presentation.json`)),
      family,
    );
  }
  const comparisonRoot = join(working, "commerce-platform");
  run(["build", "base", "--locked", "--output", "before.json"], comparisonRoot);
  run(["build", "head", "--locked", "--output", "after.json"], comparisonRoot);
  run(["diff", "before.json", "after.json"], comparisonRoot);
  assert(
    JSON.stringify(Object.keys(manifest.comparisons).sort()) ===
      JSON.stringify(Object.keys(comparisons).sort()),
    "unexpected comparison inventory",
  );
  for (const [name, expected] of Object.entries(comparisons)) {
    const evidence = manifest.comparisons[name];
    assert(
      evidence?.base === expected.base &&
        evidence.head === expected.head &&
        evidence.diff === expected.file.replace(/\.json$/u, ""),
      `${name}: unexpected comparison pair`,
    );
    const delta = join(working, expected.file);
    run(
      [
        "diff",
        `${expected.base}.json`,
        `${expected.head}.json`,
        "--format",
        "json",
        "--output",
        delta,
      ],
      working,
    );
    assert(digest(readFileSync(delta)) === evidence.sha256, `${name}: captured Diff changed`);
    assert(
      readFileSync(delta).equals(readFileSync(join(assets, "renderer", expected.file))),
      `${name}: interactive Delta differs from the actual binary`,
    );
  }

  const child = Bun.spawn(
    [binary, "run", ".", "--locked", "--no-browser", "--no-watch", "--port", "0"],
    {
      cwd: join(working, fixtures["shared-data-platform-head"]),
      env,
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  let output = "";
  const reader = (async () => {
    for await (const part of child.stdout) output += new TextDecoder().decode(part);
  })();
  const stderr = new Response(child.stderr).text();
  try {
    const deadline = Date.now() + 30_000;
    let ready = false;
    while (Date.now() < deadline && child.exitCode === null) {
      const origin = output.match(/http:\/\/127\.0\.0\.1:\d+/u)?.[0];
      if (origin) {
        const response = await fetch(origin, { signal: AbortSignal.timeout(5_000) });
        assert(
          response.ok && (await response.text()).toLowerCase().includes("<!doctype html"),
          "explorer did not serve HTML",
        );
        ready = true;
        break;
      }
      await Bun.sleep(50);
    }
    assert(ready, "shared data explorer did not start");
  } finally {
    child.kill("SIGINT");
    const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
    await child.exited;
    clearTimeout(force);
    await reader;
    await stderr;
  }
  return [
    "six locked public scenario states reproduce reviewed architecture bytes",
    "fixture comparison and server smoke procedures execute",
    "three Diff outputs and three presentation catalogs stay valid renderer inputs",
  ];
}
