import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const fence = "```";

type Captured = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Docs language: ${message}`);
}

function normalize(value: string): string {
  return `${value.replace(/\r\n/gu, "\n").trimEnd()}\n`;
}

function fenced(
  page: string,
  language: string,
  title: string,
  occurrence = 0,
  expectedCount = 1,
): string {
  const opening = `${fence}${language} title="${title}"\n`;
  const parts = page.split(opening);
  assert(parts.length === expectedCount + 1, `expected ${expectedCount} ${title} block(s)`);
  const body = parts[occurrence + 1]?.split(`\n${fence}`)[0];
  assert(body, `empty ${title} block`);
  return normalize(body);
}

export function verifyLanguageExamples(
  binary: string,
  root: string,
  workspace: string,
  home: string,
): string[] {
  const readPage = (path: string) => readFileSync(join(root, "docs", path), "utf8");
  const run = (args: string[], cwd: string, expected = 0): Captured => {
    const result = Bun.spawnSync([binary, ...args], {
      cwd,
      env: { ...process.env, ROOTFORM_HOME: home, DOCKER_CONFIG: join(home, "docker") },
      stdout: "pipe",
      stderr: "pipe",
    });
    assert(
      result.exitCode === expected,
      `${args.join(" ")} exited ${result.exitCode}, expected ${expected}: ${result.stderr}`,
    );
    return {
      exitCode: result.exitCode,
      stdout: result.stdout.toString("utf8"),
      stderr: result.stderr.toString("utf8"),
    };
  };

  const working = join(workspace, "language-verification");
  const native = join(working, "native");
  const core = join(native, "core");
  const aws = join(native, "aws");
  const google = join(native, "google");
  for (const directory of [working, native, core, aws, google]) mkdirSync(directory);

  const tour = readPage("language/tour.md");
  writeFileSync(
    join(core, "dialect.rf"),
    [
      'dialect "core" {',
      '  version = "0.1.0"',
      "}",
      "",
      fenced(tour, "hcl", "core/network/virtual-network.rf").trimEnd(),
      "",
      fenced(tour, "hcl", "core/architecture/contexts.rf").trimEnd(),
      "",
      'concept "load-balancer" {',
      "  kind        = entity",
      '  description = "A load-balancing service composed from routing infrastructure."',
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(join(aws, "dialect.rf"), fenced(tour, "hcl", "aws/dialect.rf"));
  writeFileSync(join(aws, "network.rf"), fenced(tour, "hcl", "aws/network/vpc.rf", 1, 2));
  writeFileSync(
    join(google, "dialect.rf"),
    [
      'dialect "google" {',
      '  version = "0.1.0"',
      "",
      "  requires {",
      '    core = "0.1.0"',
      "  }",
      "",
      '  provider "hashicorp/google" {',
      '    version = ">= 4.0.0"',
      "  }",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(google, "load-balancer.rf"),
    fenced(tour, "hcl", "google/load-balancing/application-load-balancer.rf"),
  );
  run(["fmt", "--check", native], working);
  const compiled = run(["validate", "dialects", native], working);
  for (const identity of ["aws@0.1.0", "core@0.1.0", "google@0.1.0"]) {
    assert(compiled.stdout.includes(`${identity} compiles`), `${identity} did not compile`);
  }

  const jsonRoot = join(working, "json");
  const jsonCore = join(jsonRoot, "core");
  const fixture = join(jsonRoot, "fixture");
  for (const directory of [jsonRoot, jsonCore, fixture]) mkdirSync(directory);
  writeFileSync(join(jsonCore, "dialect.rf"), 'dialect "core" {\n  version = "0.1.0"\n}\n');
  writeFileSync(
    join(fixture, "dialect.rf.json"),
    fenced(readPage("language/reference/syntax-files.md"), "json", "dialect.rf.json"),
  );
  run(["fmt", "--check", jsonRoot], working);
  const jsonCompiled = run(["validate", "dialects", jsonRoot], working);
  assert(
    jsonCompiled.stdout.includes("example@0.1.0 compiles"),
    ".rf.json fixture did not compile",
  );

  const jsonPack = join(working, "json-policy-pack");
  mkdirSync(jsonPack);
  writeFileSync(
    join(jsonPack, "pack.rf.json"),
    fenced(readPage("language/reference/syntax-files.md"), "json", "pack.rf.json"),
  );
  run(["fmt", "--check", jsonPack], working);
  const listedJSONPack = JSON.parse(
    run(["list", "policy-packs", "--policy-pack", jsonPack, "--format", "json"], working).stdout,
  );
  assert(
    listedJSONPack[0]?.name === "baseline" && listedJSONPack[0]?.policies === 1,
    ".rf.json Policy Pack did not compile with sibling manifest and policy blocks",
  );

  const baselinePage = readPage("language/write-policy-pack.md");
  for (const relative of [
    "pack.rf",
    "policies/cluster-network-context.rf",
    "policies/private-database-reachability.rf",
  ]) {
    const title = `policy-packs/baseline/${relative}`;
    const displayedBaseline = fenced(baselinePage, "hcl", title);
    const baselinePath = join(root, "policy-packs", "baseline", relative);
    assert(
      displayedBaseline === normalize(readFileSync(baselinePath, "utf8")),
      `displayed ${title} differs from packaged source`,
    );
  }
  run(
    [
      "package",
      "policy-packs",
      join(root, "policy-packs", "baseline"),
      "--to",
      join(working, "baseline-oci"),
      "--source-url",
      "https://github.com/rootform-dev/rootform",
      "--revision",
      "0123456789abcdef0123456789abcdef01234567",
      "--documentation-url",
      "https://docs.rootform.dev/language/write-policy-pack/",
      "--licenses",
      "Apache-2.0",
    ],
    working,
  );

  const invalid = join(working, "invalid");
  mkdirSync(invalid);
  writeFileSync(
    join(invalid, "dialect.rf"),
    [
      'dialect "broken" {',
      '  version = "0.1.0"',
      "",
      '  provider "hashicorp/example" {',
      '    version = ">= 1.0.0"',
      "  }",
      "}",
      "",
      'rule "broken" {',
      "  match {",
      '    kind = "resource"',
      '    type = "example_resource"',
      "  }",
      "",
      "  as = concept.missing",
      "}",
      "",
    ].join("\n"),
  );
  const diagnostic = run(["validate", "dialects", invalid, "--format", "json"], working, 1);
  const result = JSON.parse(diagnostic.stdout);
  assert(
    result.valid === false && result.problems?.[0]?.code === "CONCEPT_UNKNOWN",
    "invalid concept did not return structured CONCEPT_UNKNOWN",
  );

  return [
    "native tour Dialects and composition compile from displayed .rf",
    "displayed .rf.json dialect formats and compiles beside its exact requirement",
    "displayed .rf.json Policy Pack compiles with sibling top-level declarations",
    "displayed split-file baseline Policy Pack matches source and packages offline",
    "invalid language source returns structured CONCEPT_UNKNOWN",
  ];
}
