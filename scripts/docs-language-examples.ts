import { expect } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markedCommand } from "./docs-core-examples.ts";

const fence = "```";
export function fenced(page: string, language: string, title: string): string {
  const tags = language === "hcl" && title.endsWith(".rf.hcl") ? ["hcl", "rf"] : [language];
  const matches = tags.flatMap((tag) => {
    const opening = `${fence}${tag} title="${title}"\n`;
    const parts = page.split(opening);
    return parts.length === 2 ? [parts[1]?.split(`\n${fence}`)[0]] : [];
  });
  if (matches.length !== 1 || !matches[0]) throw new Error(`expected 1 ${title} block`);
  return `${matches[0]}\n`;
}

export async function verifyLanguageExamples(binary: string, root: string): Promise<string> {
  const workspace = mkdtempSync(join(tmpdir(), "rootform-language-examples-"));
  const transcripts: { command: string; exit: number | null; stdout: string; stderr: string }[] =
    [];
  const home = join(workspace, "home");
  mkdirSync(home);
  const page = (name: string) => readFileSync(join(root, "docs", name), "utf8");
  const write = (folder: string, name: string, contents: string) => {
    const path = join(workspace, folder);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, name), contents);
    return path;
  };
  const run = (args: string[], expected = 0, cwd = workspace) => {
    const result = Bun.spawnSync([binary, ...args], {
      cwd,
      env: { ...process.env, ROOTFORM_HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = result.stdout.toString() + result.stderr.toString();
    transcripts.push({
      command: [binary, ...args].join(" "),
      exit: result.exitCode,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    });
    if (result.exitCode !== expected) {
      throw new Error(
        `${args.join(" ")} exited ${result.exitCode}, expected ${expected}: ${output}`,
      );
    }
    return output;
  };
  const dialect = (name: string, source: string) => {
    const path = write(name, "dialect.rf.hcl", source);
    expect(run(["validate", "dialects", path])).toContain("valid");
  };
  const manifest = `dialect "example" {\n  version = "0.1.0"\n  provider "hashicorp/example" {\n    version = ">= 1.0.0"\n  }\n}\n\n`;
  const p = (name: string) => `language/reference/${name}.md`;

  dialect(
    "language-overview-rule",
    manifest.replace("hashicorp/example", "hashicorp/aws") +
      fenced(page("language/index.md"), "hcl", "aws/network/vpc.rf.hcl"),
  );
  dialect("vocabulary-rule", manifest + fenced(page(p("rf-vocabulary")), "hcl", "subnet.rf.hcl"));
  dialect("native-syntax", fenced(page(p("syntax-files")), "hcl", "dialect.rf.hcl"));
  dialect("dialect-layout", fenced(page(p("dialects")), "hcl", "example-dialect/dialect.rf.hcl"));
  dialect(
    "dialect-definitions",
    manifest + fenced(page(p("dialects")), "hcl", "definitions.rf.hcl"),
  );
  dialect("composition", fenced(page(p("composition")), "hcl", "composition/dialect.rf.hcl"));
  dialect(
    "constant-strings",
    fenced(page(p("expressions")), "hcl", "constant-strings/dialect.rf.hcl"),
  );
  const envelope = fenced(page(p("dialects")), "rf", "provider envelopes");
  dialect("provider-envelopes", envelope);

  const jsonDialect = write(
    "json-dialect",
    "dialect.rf.json",
    fenced(page(p("syntax-files")), "json", "dialect.rf.json"),
  );
  expect(run(["validate", "dialects", jsonDialect])).toContain("valid");

  const invalidDialects = [
    ["invalid-version", "syntax-files", "invalid-version.rf.hcl", "INVALID_VALUE"],
    ["invalid-provider", "dialects", "invalid-provider.rf.hcl", "PROVIDER_INVALID"],
    ["empty-composition", "composition", "invalid/empty-composition.rf.hcl", "COMPOSITION_INVALID"],
  ] as const;
  for (const [name, file, title, code] of invalidDialects) {
    const path = write(name, "dialect.rf.hcl", fenced(page(p(file)), "hcl", title));
    expect(run(["validate", "dialects", path, "--format", "json"], 1)).toContain(code);
  }

  const input = join(root, "examples/playground/commerce-platform/head");
  const document = join(workspace, "analysis.json");
  run([
    "run",
    join(input, "plan.json"),
    "--plan-file",
    join(input, "plan.tfplan"),
    "--no-serve",
    "-o",
    document,
  ]);
  const packs = [
    [
      "overview-pack",
      "language/index.md",
      "policies/subnet-network-context.rf.hcl",
      "language-overview",
    ],
    ["vocabulary-pack", p("rf-vocabulary"), "network policy", "vocabulary-example"],
    ["reference-pack", p("policy-packs"), "policy-reference/pack.rf.hcl", "network-baseline"],
    ["builtins-pack", p("built-ins"), "built-ins/pack.rf.hcl", "architecture-contracts"],
    ["expressions-pack", p("expressions"), "expression-results/pack.rf.hcl", "expression-results"],
  ] as const;
  for (const [name, file, title, owner] of packs) {
    const source = fenced(page(file), title.endsWith(".rf.hcl") ? "hcl" : "rf", title);
    const full = source.includes("policy_pack ")
      ? source
      : `policy_pack "${owner}" { version = "0.1.0" }\n\n${source}`;
    const folder = write(name, "pack.rf.hcl", full);
    run([
      "compile",
      "policy-pack",
      folder,
      "--semantics",
      document,
      "--output",
      join(workspace, `${name}.json`),
    ]);
  }
  const builtinsSource = fenced(page(p("built-ins")), "hcl", "built-ins/main.tf");
  expect(readFileSync(join(root, "scripts/fixtures/docs/built-ins/main.tf"), "utf8")).toBe(
    builtinsSource,
  );
  const builtinsInput = join(root, "scripts/fixtures/docs/built-ins");
  for (const [name] of packs) {
    const result = run([
      "run",
      join(builtinsInput, "plan.json"),
      "--plan-file",
      join(builtinsInput, "plan.tfplan"),
      "--policy-pack",
      join(workspace, name),
      "--no-serve",
    ]);
    expect(result).toContain("Policies      passed");
  }
  const builtinsRun = run([
    "run",
    join(builtinsInput, "plan.json"),
    "--plan-file",
    join(builtinsInput, "plan.tfplan"),
    "--policy-pack",
    join(workspace, "builtins-pack"),
    "--no-serve",
    "--color",
    "always",
  ]).replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu"), "");
  expect(builtinsRun).toContain("3 policies over 3 targets: 3 passed, 0 violated, 0 indeterminate");
  const jsonPack = write(
    "json-policy-pack",
    "pack.rf.json",
    fenced(page(p("syntax-files")), "json", "pack.rf.json"),
  );
  run([
    "compile",
    "policy-pack",
    jsonPack,
    "--semantics",
    document,
    "--output",
    join(workspace, "json-pack.json"),
  ]);
  const invalidPack = write(
    "invalid-policy-pack",
    "pack.rf.hcl",
    fenced(page(p("policy-packs")), "hcl", "invalid/dialect-only-pack.rf.hcl"),
  );
  expect(
    run(
      [
        "compile",
        "policy-pack",
        invalidPack,
        "--semantics",
        document,
        "-o",
        join(workspace, "invalid.json"),
      ],
      1,
    ),
  ).toContain("POLICY_INVALID");

  symlinkSync(join(root, "examples"), join(workspace, "examples"));
  const displayedPack = fenced(page(p("policy-packs")), "hcl", "policy-reference/pack.rf.hcl");
  write("policy-reference", "pack.rf.hcl", displayedPack);
  const command = markedCommand(page(p("policy-packs")), "language-policy-packs-link");
  mkdirSync(join(workspace, "bin"));
  symlinkSync(binary, join(workspace, "bin", "rootform"));
  const shell = Bun.spawnSync(["sh", "-c", command], {
    cwd: workspace,
    env: {
      ...process.env,
      ROOTFORM_HOME: join(workspace, "shell-home"),
      PATH: `${join(workspace, "bin")}:${process.env.PATH ?? ""}`,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (shell.exitCode !== 0)
    throw new Error(`language-policy-packs-link failed: ${shell.stdout}${shell.stderr}`);
  const excerpt = page(p("policy-packs"))
    .split("<!-- docs-output:language-policy-packs-link -->")[1]
    ?.match(/```text title="Policy Pack compilation, excerpt"\n([\s\S]*?)\n```/u)?.[1];
  if (!excerpt) throw new Error("missing policy-pack output excerpt");
  const plainOutput = shell.stdout
    .toString()
    .replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu"), "");
  let offset = 0;
  for (const line of excerpt.split("\n").filter(Boolean)) {
    const found = plainOutput.indexOf(line, offset);
    if (found < 0) throw new Error(`policy-pack excerpt line missing or out of order: ${line}`);
    offset = found + line.length;
  }
  if (process.env.ROOTFORM_DOCS_EVIDENCE_DIR) {
    mkdirSync(process.env.ROOTFORM_DOCS_EVIDENCE_DIR, { recursive: true });
    writeFileSync(
      join(process.env.ROOTFORM_DOCS_EVIDENCE_DIR, "policy-packs-link.stdout"),
      shell.stdout,
    );
    writeFileSync(
      join(process.env.ROOTFORM_DOCS_EVIDENCE_DIR, "policy-packs-link.stderr"),
      shell.stderr,
    );
    transcripts.push({
      command,
      exit: shell.exitCode,
      stdout: shell.stdout.toString(),
      stderr: shell.stderr.toString(),
    });
    writeFileSync(
      join(process.env.ROOTFORM_DOCS_EVIDENCE_DIR, "examples.json"),
      JSON.stringify(transcripts, null, 2),
    );
  }
  return "language examples: valid Dialects, .rf.json, Policy Packs, invalid diagnostics, and linking command verified";
}
