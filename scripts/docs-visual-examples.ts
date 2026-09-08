import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { markedCommand } from "./docs-core-examples.ts";

const names = ["azure-platform", "azure-platform-next", "multicloud"] as const;
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs visual: ${message}`);
}

type Manifest = {
  format_version: string;
  binary: { version: string; sha256: string };
  fixtures: Record<string, { files: Record<string, string>; architecture_sha256: string }>;
  comparison: { base: string; head: string; sha256: string };
  figures: Record<string, { fixture: string; state: string; sha256: string }>;
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
  const expectedInputs = [
    "azure-platform.json",
    "azure-platform-next.json",
    "azure-delta.json",
    "multicloud.json",
    "azure-platform-presentation.json",
    "multicloud-presentation.json",
  ];
  assert(
    JSON.stringify(Object.keys(interactive.files).sort()) === JSON.stringify(expectedInputs.sort()),
    "interactive input inventory changed",
  );
  for (const [file, hash] of Object.entries(interactive.files)) {
    assert(
      /^(?:azure-platform(?:-next|-presentation)?|azure-delta|multicloud(?:-presentation)?)\.json$/u.test(
        file,
      ),
      "unexpected interactive input",
    );
    assert(
      digest(readFileSync(join(assets, "renderer", file))) === hash,
      `interactive input changed: ${file}`,
    );
  }
  assert(manifest.format_version === "1", "unknown evidence format");
  assert(
    manifest.binary.sha256 === verification.binary.sha256 &&
      manifest.binary.version === `rootform ${verification.binary.version}`,
    "figures and executable examples use different baseline editions",
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
    const input = join(working, name);
    mkdirSync(input);
    const expected = manifest.fixtures[name];
    assert(
      expected && Object.keys(expected.files).sort().join(",") === "main.tf,rootform.lock",
      "unexpected fixture files",
    );
    for (const file of ["main.tf", "rootform.lock"]) {
      const source = join(assets, "examples", name, file);
      assert(
        digest(readFileSync(source)) === expected.files[file],
        `${name}/${file} changed: review and recapture figures`,
      );
      cpSync(source, join(input, file));
    }
    run(["init", ".", "--locked", "--no-input"], input);
    const path = join(working, `${name}.json`);
    run(["build", ".", "--locked", "--offline", "--no-input", "--output", path], input);
    assert(
      digest(readFileSync(path)) === expected.architecture_sha256,
      name +
        " no longer produces the captured architecture: review semantic drift before recapturing",
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
  const page = readFileSync(join(root, "docs/renderer/examples.md"), "utf8");
  const command = markedCommand(page, "visual-diff");
  const result = Bun.spawnSync(["sh", "-eu", "-c", command], {
    cwd: working,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  assert(result.exitCode === 0, `published Diff procedure failed: ${result.stderr}`);
  assert(
    manifest.comparison.base === "azure-platform" &&
      manifest.comparison.head === "azure-platform-next",
    "unexpected comparison pair",
  );
  const delta = join(working, "delta.json");
  run(["diff", "before.json", "after.json", "--format", "json", "--output", delta], working);
  assert(
    digest(readFileSync(delta)) === manifest.comparison.sha256,
    "published Diff procedure changed the captured comparison",
  );
  assert(
    readFileSync(delta).equals(readFileSync(join(assets, "renderer/azure-delta.json"))),
    "interactive Delta differs from the actual binary",
  );

  // Use the documented run command; only suppress UI launch, watching and fixed port for the test.
  const args = markedCommand(page, "visual-run").trim().split(/\s+/u);
  assert(
    args.shift() === "rootform" && args[0] === "run",
    "expected the documented explorer command",
  );
  const child = Bun.spawn([binary, ...args, "--no-browser", "--no-watch", "--port", "0"], {
    cwd: join(working, "multicloud"),
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
    assert(ready, "multicloud explorer did not start");
  } finally {
    child.kill("SIGINT");
    const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
    await child.exited;
    clearTimeout(force);
    await reader;
    await stderr;
  }
  const figures = Object.entries(manifest.figures);
  assert(figures.length === 16, "representative capture inventory changed");
  for (const [name, figure] of figures) {
    assert(/^[a-z-]+\.png$/u.test(name), "invalid figure path");
    assert(
      digest(readFileSync(join(assets, "renderer", name))) === figure.sha256,
      `${name} differs from the reviewed capture`,
    );
  }
  return [
    "three locked visual sources reproduce captured architecture bytes",
    "published multicloud explorer and Azure comparison procedures execute",
    "Delta bytes and 16 PNGs match the source-bound capture manifest",
  ];
}
