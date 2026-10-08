import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { flattenRfBlocks, parseRfSource, referencePaths, staticString } from "./rf-source.ts";

const repositoryRoot = resolve(import.meta.dir, "../..");

function officialSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...officialSourceFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".rf.hcl")) files.push(path);
  }
  return files;
}

test("parses labeled and unlabeled blocks with authored order and source ranges", () => {
  const source = `dialect "sample" {
  rule "ordered" "secondary" {
    match {
      type = "example"
    }
    composition "members" {
      sources = [
        source.zeta,
        source.alpha,
        "source.literal",
        # source.comment
        local.shared,
        source.zeta,
      ]
    }
  }
  rule {
    settings = {
      nested = { values = [1, 2] }
    }
  }
}
`;
  const roots = parseRfSource(source, "sample.rf.hcl");
  expect(roots).toHaveLength(1);
  expect(roots[0]).toMatchObject({
    kind: "dialect",
    name: "sample",
    labels: ["sample"],
    line: 1,
    endLine: 22,
  });

  const rules = roots[0]?.children.filter((block) => block.kind === "rule") ?? [];
  expect(rules.map((block) => [block.name, block.labels])).toEqual([
    ["ordered", ["ordered", "secondary"]],
    ["", []],
  ]);
  expect(rules[0]?.children.map((block) => block.kind)).toEqual(["match", "composition"]);
  const members = rules[0]?.children[1]?.fields.get("sources");
  expect(members).toMatchObject({ line: 7, endLine: 14 });
  expect(referencePaths(members?.value ?? "")).toEqual([
    "source.zeta",
    "source.alpha",
    "local.shared",
  ]);
  expect(flattenRfBlocks(roots).map((block) => block.kind)).toEqual([
    "dialect",
    "rule",
    "match",
    "composition",
    "rule",
  ]);
  expect(rules[1]?.fields.get("settings")?.value).toContain("nested = { values = [1, 2] }");
});

test("scans inline declarations, expression braces, escaped strings, and all HCL comments", () => {
  const source = String.raw`# header comment
// slash comment
/* block comment
   across lines */
dialect "demo" { rule "inline" { description = "braces { } and markers # // /* */ with escaped quote: \"ok\"" path = local /* inline block comment */ .name match { type = "demo_resource" } } }
`;
  const roots = parseRfSource(source, "inline.rf.hcl");
  const rule = roots[0]?.children[0];
  expect(rule?.fields.get("description")?.value).toBe(
    String.raw`"braces { } and markers # // /* */ with escaped quote: \"ok\""`,
  );
  expect(rule?.children[0]?.fields.get("type")?.value).toBe('"demo_resource"');
  expect(referencePaths(rule?.fields.get("path")?.value ?? "")).toEqual(["local.name"]);
});

test("marks only immediately preceding long justification comments", () => {
  const source = `rule "external" {
  # This comment explains the external source boundary.
  external = "allow"
  /* This comment explains the disclosure boundary. */
  disclose = "record"
}
rule "blank-line" {
  # This comment is separated from the field by a blank line.

  external = "deny"
}
`;
  const blocks = parseRfSource(source, "justification.rf.hcl");
  expect(blocks[0]?.fields.get("external")).toMatchObject({
    value: '"allow"',
    justification: true,
  });
  expect(blocks[0]?.fields.get("disclose")).toMatchObject({
    value: '"record"',
    justification: true,
  });
  expect(blocks[1]?.fields.get("external")).toMatchObject({
    value: '"deny"',
    justification: false,
  });
  const thresholds = parseRfSource(`rule "short" {
  // 1234567890123456789
  external = "allow"
}
rule "exact" {
  // 12345678901234567890
  external = "allow"
}
`);
  expect(thresholds[0]?.fields.get("external")?.justification).toBe(false);
  expect(thresholds[1]?.fields.get("external")?.justification).toBe(true);
});

test("extracts static quoted and heredoc strings, and rejects templates", () => {
  expect(staticString(String.raw`"hello \"world\" {brace} \\ path"`)).toBe(
    'hello "world" {brace} \\ path',
  );
  const literalMarker = "$" + "{literal}";
  const directiveMarker = "%" + "{literal}";
  expect(staticString('"$$' + "{literal} and %%" + '{literal}"')).toBe(
    `${literalMarker} and ${directiveMarker}`,
  );
  expect(staticString('"$' + "{var.dynamic}" + '"')).toBeUndefined();
  expect(staticString("<<-END\n  description { here }\n  END")).toBe("description { here }\n");
});

test("keeps heredoc bodies opaque to block and comment scanning", () => {
  const source = `rule "description" {
  description = <<-DOC
    A brace } and # marker stay in this string.
    DOC
  enabled = true
}
`;
  const block = parseRfSource(source, "heredoc.rf.hcl")[0];
  const description = block?.fields.get("description");
  expect(description).toMatchObject({ line: 2, endLine: 4 });
  expect(staticString(description?.value ?? "")).toBe(
    "A brace } and # marker stay in this string.\n",
  );
  expect(block?.fields.get("enabled")?.value).toBe("true");
});

test("reference paths preserve first-use order and skip strings and comments", () => {
  const expression = `[
    source.first,
    source.second.member,
    "source.quoted",
    local.shared,
    source.first, # source.hidden
    /* data.hidden */ data.visible.name,
  ]`;
  expect(referencePaths(expression)).toEqual([
    "source.first",
    "source.second.member",
    "local.shared",
    "data.visible.name",
  ]);
  const quotedTraversal = '"$' + "{source.in_template}" + '" # source.in_comment';
  expect(referencePaths(quotedTraversal)).toEqual([]);
});

test("malformed and unsupported source fails with a path and location", () => {
  expect(() => parseRfSource('rule "broken" {\n value = [1\n}', "broken.rf.hcl")).toThrow(
    "broken.rf.hcl:3:",
  );
  expect(() => parseRfSource('rule "broken" { value = "unterminated }', "broken.rf.hcl")).toThrow(
    "broken.rf.hcl:1: unterminated quoted string",
  );
  expect(() => parseRfSource("/* unterminated", "broken.rf.hcl")).toThrow(
    "broken.rf.hcl:1: unterminated block comment",
  );
  expect(() => parseRfSource("value = 1", "broken.rf.hcl")).toThrow("root-level attributes");
  expect(() => parseRfSource("rule { value = 1; other = 2 }", "broken.rf.hcl")).toThrow(
    "semicolon",
  );
  expect(() => parseRfSource("rule { value = 'single' }", "broken.rf.hcl")).toThrow(
    "single-quoted strings are unsupported",
  );
  expect(() => parseRfSource("rule { value = @ }", "broken.rf.hcl")).toThrow(
    "unsupported source character",
  );
  expect(() => parseRfSource("rule {", "broken.rf.hcl")).toThrow("unclosed block");
  expect(() => parseRfSource("}", "broken.rf.hcl")).toThrow("unexpected block close");
  expect(() => parseRfSource("rule { value = <<END\nmissing\n}", "broken.rf.hcl")).toThrow(
    "unterminated heredoc END",
  );
  expect(() => parseRfSource("rule { value = <<END }", "broken.rf.hcl")).toThrow(
    "malformed heredoc or unsupported << operator",
  );
});

test("smoke-parses every official Dialect and policy-pack RF/HCL source", () => {
  const files = [
    ...officialSourceFiles(resolve(repositoryRoot, "dialects")),
    ...officialSourceFiles(resolve(repositoryRoot, "policy-packs")),
  ];
  expect(files.length).toBeGreaterThan(0);
  for (const path of files) {
    parseRfSource(readFileSync(path, "utf8"), relative(repositoryRoot, path));
  }
});
