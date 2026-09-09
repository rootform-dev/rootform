import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { markedCommand } from "./docs-core-examples.ts";

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

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();
}

function presentationBytes(directory: string, architectures: string[]): Buffer {
  const contract = JSON.parse(readFileSync(join(directory, "example.json"), "utf8")) as {
    dialects: string[];
  };
  const usedRules = new Set<string>();
  const usedConcepts = new Set<string>();
  for (const architecture of architectures) {
    const document = JSON.parse(readFileSync(architecture, "utf8")) as {
      architecture: Record<string, Array<{ concept?: string; rule?: string }>>;
    };
    for (const entries of Object.values(document.architecture)) {
      for (const entry of entries) {
        if (entry.rule) usedRules.add(entry.rule);
        if (entry.concept) usedConcepts.add(entry.concept);
      }
    }
  }
  const merged: Record<string, unknown> = {
    format_version: "1",
    rules: {},
    concepts: {},
    rule_labels: {},
    concept_labels: {},
  };
  for (const dialect of contract.dialects) {
    const source = JSON.parse(
      readFileSync(join(directory, ".rootform/dialects", dialect, "presentation.json"), "utf8"),
    ) as Record<string, unknown>;
    assert(source.format_version === "1", `${dialect}: unknown presentation format`);
    for (const section of ["rules", "concepts", "rule_labels", "concept_labels"]) {
      const entries = source[section] ?? {};
      assert(
        typeof entries === "object" && entries !== null && !Array.isArray(entries),
        `${dialect}: invalid presentation ${section}`,
      );
      const target = merged[section] as Record<string, unknown>;
      for (const [key, value] of Object.entries(entries)) {
        const qualified = `${dialect}/${key}`;
        const used = section.startsWith("rule")
          ? usedRules.has(qualified)
          : usedConcepts.has(qualified);
        if (used) target[qualified] = value;
      }
    }
  }
  return Buffer.from(`${JSON.stringify(merged, null, 2)}\n`);
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
  const builtByFamily = new Map<string, string[]>();
  for (const name of names) {
    const input = join(working, fixtures[name]);
    mkdirSync(input, { recursive: true });
    const sourceRoot = join(root, "examples/playground", fixtures[name]);
    const sourceFiles = [
      "example.json",
      "main.tf",
      "rootform.lock",
      ...filesBelow(join(sourceRoot, ".rootform/dialects")).map(
        (file) => `.rootform/dialects/${file}`,
      ),
    ].sort();
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
    run(["build", ".", "--locked", "--offline", "--no-input", "--output", path], input);
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
    const family = name.replace(/-(?:base|head)$/u, "");
    builtByFamily.set(family, [...(builtByFamily.get(family) ?? []), path]);
  }
  for (const family of Object.keys(comparisons)) {
    assert(
      presentationBytes(
        join(root, "examples/playground", family, "head"),
        builtByFamily.get(family) ?? [],
      ).equals(readFileSync(join(assets, "renderer", `${family}-presentation.json`))),
      `${family}: presentation catalog differs from vendored Dialects`,
    );
  }
  const page = readFileSync(join(root, "docs/renderer/examples.md"), "utf8");
  const command = markedCommand(page, "visual-diff");
  const result = Bun.spawnSync(["sh", "-eu", "-c", command], {
    cwd: join(working, "commerce-platform"),
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  assert(result.exitCode === 0, `published Diff procedure failed: ${result.stderr}`);
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

  // Use the documented run command; only suppress UI launch, watching and fixed port for the test.
  const args = markedCommand(page, "visual-run").trim().split(/\s+/u);
  assert(
    args.shift() === "rootform" && args[0] === "run",
    "expected the documented explorer command",
  );
  const child = Bun.spawn([binary, ...args, "--no-browser", "--no-watch", "--port", "0"], {
    cwd: join(working, fixtures["shared-data-platform-head"]),
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
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
    "published explorer and comparison procedures execute",
    "three Diff outputs and three presentation catalogs match vendored sources",
  ];
}
