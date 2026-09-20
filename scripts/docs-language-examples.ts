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
  const assertTableValues = (path: string, values: string[]) => {
    const page = readPage(path);
    for (const value of values) {
      assert(page.includes(`| \`${value}\` |`), `${path} does not document ${value}`);
    }
  };
  const assertExactDiagnosticCodes = (values: string[]) => {
    const page = readPage("language/reference/diagnostics.md");
    const actual = [
      ...new Set(
        [...page.matchAll(/^\| `([A-Z][A-Z0-9_]*)` \|/gmu)].map((match) => match[1] ?? ""),
      ),
    ].sort();
    const expected = [...new Set(values)].sort();
    assert(
      JSON.stringify(actual) === JSON.stringify(expected),
      "language/reference/diagnostics.md code inventory differs from public contract",
    );
  };
  const run = (args: string[], cwd: string, expected = 0): Captured => {
    const result = Bun.spawnSync([binary, ...args], {
      cwd,
      env: { ...process.env, ROOTFORM_HOME: home, DOCKER_CONFIG: join(home, "docker") },
      stdout: "pipe",
      stderr: "pipe",
    });
    assert(
      result.exitCode === expected,
      `${args.join(" ")} exited ${result.exitCode}, expected ${expected}: ${result.stderr}\n${result.stdout}`,
    );
    return {
      exitCode: result.exitCode,
      stdout: result.stdout.toString("utf8"),
      stderr: result.stderr.toString("utf8"),
    };
  };

  assertTableValues("language/reference/rules.md", [
    "settings",
    "provider",
    "resource",
    "data",
    "ephemeral",
    "action",
    "module",
    "variable",
    "local",
    "output",
    "moved",
    "removed",
    "import",
    "check",
    "language",
  ]);
  assertTableValues("language/reference/rf-vocabulary.md", [
    "rf.concept.kubernetes-cluster",
    "rf.concept.managed-database",
    "rf.concept.object-storage-container",
    "rf.concept.service-identity",
    "rf.concept.subnet",
    "rf.concept.virtual-network",
    "rf.context.network",
    "rf.context.runtime",
  ]);
  const diagnosticCodes = [
    "ROOT_UNREADABLE",
    "FILE_UNREADABLE",
    "FILE_NOT_REGULAR",
    "SYMLINK_OUTSIDE_ROOT",
    "NESTING_TOO_DEEP",
    "HCL_PARSE",
    "UNKNOWN_ATTRIBUTE",
    "UNKNOWN_BLOCK",
    "INVALID_LABEL",
    "MISSING_ATTRIBUTE",
    "DUPLICATE_BLOCK",
    "INVALID_VALUE",
    "INVALID_EXPRESSION",
    "INVALID_REFERENCE",
    "DUPLICATE_ID",
    "ARTIFACT_INVALID",
    "COMPILER_FAILED",
    "DIALECT_MISSING",
    "DIALECT_DUPLICATE",
    "DIALECT_RESERVED",
    "PROVIDER_INVALID",
    "PROVIDER_REQUIRED",
    "CONCEPT_INVALID",
    "CONTEXT_INVALID",
    "RELATION_INVALID",
    "RULE_INVALID",
    "RULE_NO_ARCHITECTURE",
    "MATCH_KIND_UNKNOWN",
    "PREDICATE_UNRESOLVED",
    "FACT_INVALID",
    "COMPOSITION_INVALID",
    "CONCEPT_UNKNOWN",
    "CONTEXT_UNKNOWN",
    "RELATION_UNKNOWN",
    "RULE_UNKNOWN",
    "PACK_MISSING",
    "PACK_DUPLICATE",
    "POLICY_NOT_ALLOWED",
    "POLICY_REFERENCE_UNQUALIFIED",
    "POLICY_INVALID",
    "DUPLICATE_ADDRESS",
    "AMBIGUOUS_RULE_MATCH",
    "PROVIDER_IDENTITY_UNRESOLVED",
    "PROVIDER_VERSION_INCOMPATIBLE",
    "SEMANTIC_EXPANSION_LIMIT",
    "COMPOSITION_MEMBER_UNRESOLVED",
    "COMPOSITION_MEMBER_MISMATCH",
    "COMPOSITION_MEMBER_CONFLICT",
    "COMPOSITION_MEMBER_UNCERTAIN",
    "TRAVERSAL_UNRESOLVED",
    "TRAVERSAL_DANGLING",
    "TRAVERSAL_AMBIGUOUS",
    "ATTRIBUTE_MATCH_UNRESOLVED",
    "ATTRIBUTE_MATCH_AMBIGUOUS",
    "FACT_TARGET_UNREPRESENTED",
    "FACT_TARGET_MISMATCH",
    "DEPENDENCY_DANGLING",
    "DEPENDENCY_MODULE_UNTRAVERSED",
    "DEPENDENCY_CYCLE",
    "DEPENDENCY_UNRESOLVED",
    "POLICY_OWNER_UNKNOWN",
    "POLICY_CONCEPT_UNKNOWN",
    "POLICY_CONTEXT_UNKNOWN",
    "POLICY_RELATION_UNKNOWN",
    "POLICY_RULE_UNKNOWN",
    "POLICY_TARGET_CONTRADICTORY",
    "POLICY_SEMANTICS_MISMATCH",
    "POLICY_ARCHITECTURE_INVALID",
    "POLICY_TARGET_DOMAIN_INCOMPLETE",
    "POLICY_ASSERTION_UNKNOWN",
    "POLICY_LIMIT_EXCEEDED",
    "POLICY_PACK_DUPLICATE",
    "POLICY_NOT_EVALUATED",
    "READ_FAILED",
    "SYNTAX_INVALID",
    "UNSUPPORTED_BLOCK",
    "PROVIDER_UNRESOLVED",
    "MODULE_REMOTE",
    "MODULE_MISSING",
    "MODULE_UNRESOLVED",
    "MODULE_CYCLE",
    "MODULE_ESCAPE",
    "OVERRIDE_MISSING_BASE",
    "OVERRIDE_UNSUPPORTED",
    "FILE_SHADOWED",
    "FILE_NOT_READ",
    "NESTING_DEPTH_EXCEEDED",
    "IR_INVALID_DOCUMENT",
    "IR_INVALID_VERSION",
    "IR_NIL_COLLECTION",
    "IR_INVALID_STRING",
    "IR_INVALID_RANGE",
    "IR_DUPLICATE_ID",
    "IR_DANGLING_REFERENCE",
    "IR_INVALID_ACCOUNTING",
    "IR_INVALID_IMPLEMENTATION",
    "IR_INVALID_OWNER",
    "IR_INVALID_CONTEXT",
    "IR_INVALID_RULE",
    "IR_INVALID_CONCEPT",
    "IR_INVALID_RESOLUTION",
    "IR_INVALID_DEPENDENCY",
    "IR_INVALID_FACT",
    "IR_INVALID_DIAGNOSTIC",
    "IR_PRIVACY_VIOLATION",
    "IR_NON_CANONICAL_ORDER",
    "IR_LIMIT_EXCEEDED",
  ];
  assertTableValues("language/reference/diagnostics.md", diagnosticCodes);
  assertExactDiagnosticCodes(diagnosticCodes);

  const working = join(workspace, "language-verification");
  const native = join(working, "native");
  const aws = join(native, "aws");
  const google = join(native, "google");
  for (const directory of [working, native, aws, google]) mkdirSync(directory);

  const tour = readPage("language/tour.md");
  writeFileSync(join(aws, "dialect.rf.hcl"), fenced(tour, "hcl", "aws/dialect.rf.hcl"));
  writeFileSync(join(aws, "network.rf.hcl"), fenced(tour, "hcl", "aws/network/vpc.rf.hcl"));
  writeFileSync(
    join(google, "dialect.rf.hcl"),
    [
      'dialect "google" {',
      '  version = "0.1.0"',
      "",
      '  provider "hashicorp/google" {',
      '    version = ">= 4.0.0"',
      "  }",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(join(google, "vocabulary.rf.hcl"), fenced(tour, "hcl", "google/vocabulary.rf.hcl"));
  writeFileSync(
    join(google, "load-balancer.rf.hcl"),
    fenced(tour, "hcl", "google/load-balancing/application-load-balancer.rf.hcl"),
  );
  run(["fmt", "--check", native], working);
  const compiled = run(["validate", "dialects", native], working);
  for (const identity of ["aws@0.1.0", "google@0.1.0"]) {
    assert(compiled.stdout.includes(identity), `${identity} did not validate`);
  }

  const jsonRoot = join(working, "json");
  const fixture = join(jsonRoot, "fixture");
  for (const directory of [jsonRoot, fixture]) mkdirSync(directory);
  writeFileSync(
    join(fixture, "dialect.rf.json"),
    fenced(readPage("language/reference/syntax-files.md"), "json", "dialect.rf.json"),
  );
  run(["fmt", "--check", jsonRoot], working);
  const jsonCompiled = run(["validate", "dialects", jsonRoot], working);
  assert(jsonCompiled.stdout.includes("example@0.1.0"), ".rf.json fixture did not validate");

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

  const referenceDialects = [
    {
      page: "language/reference/rules.md",
      title: "reference/dialect.rf.hcl",
      directory: "rules",
      identity: "example@0.1.0",
    },
    {
      page: "language/reference/emissions.md",
      title: "emissions/dialect.rf.hcl",
      directory: "emissions",
      identity: "example@0.1.0",
    },
    {
      page: "language/reference/composition.md",
      title: "composition/dialect.rf.hcl",
      directory: "composition",
      identity: "example@0.1.0",
    },
    {
      page: "language/reference/expressions.md",
      title: "constant-strings/dialect.rf.hcl",
      directory: "constant-strings",
      identity: "constant-example@0.1.0",
    },
  ];
  const referenceDialectRoot = join(working, "reference-dialects");
  mkdirSync(referenceDialectRoot);
  for (const example of referenceDialects) {
    const directory = join(referenceDialectRoot, example.directory);
    mkdirSync(directory);
    writeFileSync(
      join(directory, "dialect.rf.hcl"),
      fenced(readPage(example.page), "hcl", example.title),
    );
    run(["fmt", "--check", directory], working);
    const result = run(["validate", "dialects", directory], working);
    assert(result.stdout.includes(example.identity), `${example.title} did not validate`);
  }

  const architecture = join(workspace, "architecture.json");
  const builtinsArchitectureRoot = join(working, "built-ins-architecture");
  mkdirSync(builtinsArchitectureRoot);
  writeFileSync(
    join(builtinsArchitectureRoot, "main.tf"),
    fenced(readPage("language/reference/built-ins.md"), "hcl", "built-ins/main.tf"),
  );
  const builtinsArchitecture = join(working, "built-ins-architecture.json");
  run(["build", builtinsArchitectureRoot, "--output", builtinsArchitecture], working);
  const referencePacks = [
    {
      page: "language/reference/policy-packs.md",
      title: "policy-reference/pack.rf.hcl",
      directory: "policy-reference",
      name: "network-baseline",
      policies: 1,
    },
    {
      page: "language/reference/built-ins.md",
      title: "built-ins/pack.rf.hcl",
      directory: "built-ins",
      name: "architecture-contracts",
      policies: 3,
    },
    {
      page: "language/reference/expressions.md",
      title: "expression-results/pack.rf.hcl",
      directory: "expression-results",
      name: "expression-results",
      policies: 1,
    },
  ];
  const compiledPacks = new Map<string, string>();
  for (const example of referencePacks) {
    const directory = join(working, example.directory);
    mkdirSync(directory);
    writeFileSync(
      join(directory, "pack.rf.hcl"),
      fenced(readPage(example.page), "hcl", example.title),
    );
    run(["fmt", "--check", directory], working);
    const output = join(working, `${example.directory}.json`);
    run(
      ["compile", "policy-pack", directory, "--semantics", architecture, "--output", output],
      working,
    );
    const artifact = JSON.parse(readFileSync(output, "utf8"));
    assert(
      artifact.policy_pack?.name === example.name && artifact.policies?.length === example.policies,
      `${example.title} did not compile with its documented identity and policy count`,
    );
    compiledPacks.set(example.directory, output);
  }
  const checkedReference = JSON.parse(
    run(
      [
        "check",
        architecture,
        "--policy-pack",
        compiledPacks.get("policy-reference") ?? "",
        "--format",
        "json",
      ],
      working,
    ).stdout,
  );
  assert(
    checkedReference.status === "compliant" &&
      checkedReference.summary?.passed === 1 &&
      checkedReference.summary?.evaluations === 1,
    "reference Policy did not pass against documented AWS subnet architecture",
  );
  const checkedBuiltin = JSON.parse(
    run(
      [
        "check",
        builtinsArchitecture,
        "--policy-pack",
        compiledPacks.get("built-ins") ?? "",
        "--format",
        "json",
      ],
      working,
    ).stdout,
  );
  assert(
    checkedBuiltin.status === "compliant" &&
      checkedBuiltin.summary?.passed === 3 &&
      checkedBuiltin.summary?.evaluations === 3,
    "documented contexts, relations, contributions, exists, and length did not all pass",
  );
  const checkedExpression = JSON.parse(
    run(
      [
        "check",
        architecture,
        "--policy-pack",
        compiledPacks.get("expression-results") ?? "",
        "--format",
        "json",
      ],
      working,
    ).stdout,
  );
  assert(
    checkedExpression.status === "compliant" && checkedExpression.summary?.passed === 1,
    "documented recursive Boolean expressions did not evaluate as true",
  );

  for (const example of [
    {
      page: "language/reference/rules.md",
      title: "invalid/match-only.rf.hcl",
      code: "RULE_NO_ARCHITECTURE",
    },
    {
      page: "language/reference/composition.md",
      title: "invalid/empty-composition.rf.hcl",
      code: "COMPOSITION_INVALID",
    },
  ]) {
    const directory = join(working, `invalid-${example.code.toLowerCase()}`);
    mkdirSync(directory);
    writeFileSync(
      join(directory, "dialect.rf.hcl"),
      fenced(readPage(example.page), "hcl", example.title),
    );
    const validation = run(["validate", "dialects", directory, "--format", "json"], working, 1);
    const report = JSON.parse(validation.stdout);
    assert(
      report.problems?.some((problem: { code?: string }) => problem.code === example.code),
      `${example.title} did not return ${example.code}`,
    );
  }

  const invalidPolicy = join(working, "invalid-policy");
  mkdirSync(invalidPolicy);
  writeFileSync(
    join(invalidPolicy, "pack.rf.hcl"),
    fenced(
      readPage("language/reference/policy-packs.md"),
      "hcl",
      "invalid/dialect-only-pack.rf.hcl",
    ),
  );
  const invalidPolicyResult = run(
    [
      "compile",
      "policy-pack",
      invalidPolicy,
      "--semantics",
      architecture,
      "--output",
      join(working, "invalid-policy.json"),
    ],
    working,
    1,
  );
  assert(
    invalidPolicyResult.stderr.includes("POLICY_INVALID"),
    "documented dialect-only Policy target did not return POLICY_INVALID",
  );

  const baselinePage = readPage("language/write-policy-pack.md");
  for (const relative of [
    "pack.rf.hcl",
    "policies/cluster-network-context.rf.hcl",
    "policies/managed-database-network-context.rf.hcl",
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
    join(invalid, "dialect.rf.hcl"),
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
    "closed match kinds, RF Vocabulary, and diagnostic codes are fully documented",
    "native tour Dialects and composition compile from displayed .rf.hcl",
    "displayed .rf.json Dialect formats and compiles without imports",
    "displayed .rf.json Policy Pack compiles with sibling top-level declarations",
    "Rules, emissions, composition, and constant-string reference Dialects format and compile",
    "Policy, expression, and built-in reference Packs link against documented Architecture IR",
    "documented built-ins evaluate contexts, relations, contributions, exists, and length as compliant",
    "documented recursive Boolean expressions evaluate as compliant",
    "documented invalid Rule, composition, and Policy forms return exact codes",
    "displayed split-file baseline Policy Pack matches source and packages offline",
    "invalid language source returns structured CONCEPT_UNKNOWN",
  ];
}
