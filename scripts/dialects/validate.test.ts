import { expect, test } from "bun:test";
import {
  collectUndeclaredRuleReferences,
  hasPrivateImplementationReference,
  mirrorPairCandidates,
  registryEquivalenceProblems,
  validateDialectContract,
  validateLock,
  validateRepository,
} from "./validate.ts";

test("emissions require explicit null and empty outcomes", () => {
  const source = `rule "consumer" {
  relation {
    to = concept.target
    via = source.target_id
  }
}`;
  expect(() => validateDialectContract(source, "sample.rf.hcl")).toThrow("on_null");
  expect(() =>
    validateDialectContract(
      source.replace("via = source.target_id", 'via = source.target_id\n    on_null = "absent"'),
      "sample.rf.hcl",
    ),
  ).toThrow("on_empty");
  expect(() =>
    validateDialectContract(
      source.replace(
        "via = source.target_id",
        'via = source.target_id\n    on_null = "absent"\n    on_empty = "indeterminate"',
      ),
      "sample.rf.hcl",
    ),
  ).not.toThrow();
});

test("external and disclosure policy require nearby justification", () => {
  const base = `rule "consumer" {
  contribution {
    to = concept.target
    via = source.target_id
    on_null = "absent"
    on_empty = "absent"
    external = "allow"
  }
}`;
  expect(() => validateDialectContract(base, "sample.rf.hcl")).toThrow("justification");
  const justified = base.replace(
    '    external = "allow"',
    '    # This value may identify a separately managed target.\n    external = "allow"',
  );
  expect(() => validateDialectContract(justified, "sample.rf.hcl")).not.toThrow();
  const disclosed = justified.replace(
    '    external = "allow"',
    '    external = "allow"\n    disclose = "record"',
  );
  expect(() => validateDialectContract(disclosed, "sample.rf.hcl")).toThrow("disclosure needs");
  expect(() =>
    validateDialectContract(
      disclosed.replace(
        '    disclose = "record"',
        '    # This structural ID is useful to compare documents.\n    disclose = "record"',
      ),
      "sample.rf.hcl",
    ),
  ).not.toThrow();
});

test("current repository matches its explicit inventory", () => {
  expect(validateRepository).not.toThrow();
});

test("shorthand provider bindings need registry equivalence evidence", () => {
  const same = "a".repeat(64);
  const other = "b".repeat(64);
  const check = (terraform: string, opentofu: string) => ({
    version: "1.0.0",
    platform: "linux_amd64",
    terraform_sha256: terraform,
    opentofu_sha256: opentofu,
  });
  const vendor = { dialect: "vendor", source: "vendor/thing", version: "= 1.0.0" };
  const hashicorp = { dialect: "cloud", source: "hashicorp/cloud", version: "= 1.0.0" };
  const pinned = {
    dialect: "vendor",
    source: "registry.terraform.io/vendor/other",
    version: "= 1.0.0",
  };
  expect(
    registryEquivalenceProblems(
      [vendor, hashicorp, pinned],
      [
        { ...vendor, archives: "identical", checks: [check(same, same)] },
        { ...hashicorp, archives: "rebuilt", checks: [check(same, other)] },
      ],
    ),
  ).toEqual([]);
  expect(registryEquivalenceProblems([vendor], [])).toEqual([
    "vendor: vendor/thing has no registry equivalence evidence",
  ]);
  expect(
    registryEquivalenceProblems(
      [vendor],
      [{ ...vendor, archives: "rebuilt", checks: [check(same, other)] }],
    ),
  ).toEqual(["vendor: vendor/thing archives differ between registries; bind one host explicitly"]);
  expect(
    registryEquivalenceProblems(
      [vendor],
      [{ ...vendor, archives: "rebuilt", checks: [check(same, same)] }],
    ),
  ).toEqual(["vendor: vendor/thing evidence does not match its archive digests"]);
  expect(
    registryEquivalenceProblems(
      [vendor],
      [{ ...vendor, archives: "identical", checks: [check(same, "")] }],
    ),
  ).toEqual(["vendor: vendor/thing evidence lacks an archive digest from each registry"]);
  expect(
    registryEquivalenceProblems(
      [],
      [{ ...vendor, archives: "identical", checks: [check(same, same)] }],
    ),
  ).toEqual(["vendor: stale registry evidence for vendor/thing"]);
});

test("no redundant resource-mirror pair remains in any dialect", () => {
  expect(mirrorPairCandidates()).toEqual([]);
});

test("collector reports a dangling qualified rule with its JSON path", () => {
  const declared = new Set(["google.rule.cloud-sql-instance"]);
  const out: Array<{ file: string; path: string; ref: string }> = [];
  collectUndeclaredRuleReferences(
    { rows: [{ rules: ["google.rule.cloud-sql-instance", "google.rule.ghost"] }] },
    "evidence/google/coverage-matrix.json",
    "$",
    declared,
    out,
  );
  expect(out).toEqual([
    {
      file: "evidence/google/coverage-matrix.json",
      path: "$.rows[0].rules[1]",
      ref: "google.rule.ghost",
    },
  ]);
});

test("documentary prior_rule_id audit values are exempt from the gate", () => {
  const declared = new Set<string>();
  const out: Array<{ file: string; path: string; ref: string }> = [];
  collectUndeclaredRuleReferences(
    { entries: [{ disposition: "removed", prior_rule_id: "google.rule.removed-rule" }] },
    "evidence/google/rule-audit.json",
    "$",
    declared,
    out,
  );
  expect(out).toEqual([]);
});

test("retained prior_rule_id values remain live semantic references", () => {
  const out: Array<{ file: string; path: string; ref: string }> = [];
  collectUndeclaredRuleReferences(
    { entries: [{ disposition: "retained", prior_rule_id: "google.rule.missing-rule" }] },
    "evidence/google/rule-audit.json",
    "$",
    new Set<string>(),
    out,
  );
  expect(out).toEqual([
    {
      file: "evidence/google/rule-audit.json",
      path: "$.entries[0].prior_rule_id",
      ref: "google.rule.missing-rule",
    },
  ]);
});

test("single-segment and plain prose never match the qualified rule gate", () => {
  const declared = new Set<string>();
  const out: Array<{ file: string; path: string; ref: string }> = [];
  collectUndeclaredRuleReferences(
    { direct: ["rule.local", "not a reference", "google.rule.cloud-sql-instance"] },
    "evidence/google/scenarios.json",
    "$",
    declared,
    out,
  );
  expect(out).toEqual([
    {
      file: "evidence/google/scenarios.json",
      path: "$.direct[2]",
      ref: "google.rule.cloud-sql-instance",
    },
  ]);
});

test("public evidence rejects private implementation references", () => {
  for (const privateReference of [
    `spe${"cs/062-aws/evidence.json"}`,
    `docs/ad${"r/086-provider.md"}`,
    ["test", "data/architecture/aws-v6/minimal"].join(""),
    `packages/rend${"erer/src/private.ts"}`,
    `web/s${"rc/private.ts"}`,
    `AD${"R-086"}`,
    `SPE${"C-062"}`,
    `accepted_${"adr"}`,
  ]) {
    expect(hasPrivateImplementationReference(privateReference)).toBeTrue();
  }
  expect(
    hasPrivateImplementationReference(
      "Rootform CLI owns parsing; evidence/aws/provider-surfaces-spike.md is public.",
    ),
  ).toBeFalse();
});

test("project lock accepts format 1 and an empty selection", () => {
  expect(() =>
    validateLock({
      format_version: "1",
      dialects: [],
      policy_packs: [],
      excluded_owners: [],
      replacements: [],
    }),
  ).not.toThrow();
});

test("project lock rejects other formats and non-object content", () => {
  expect(() =>
    validateLock({
      format_version: "2",
      dialects: [],
      policy_packs: [],
      excluded_owners: [],
      replacements: [],
    }),
  ).toThrow("format version 1");
  expect(() => validateLock(null)).toThrow("rootform.lock must be an object");
});

test("project lock never pins supplied dialects or observed non-coverage", () => {
  expect(() =>
    validateLock({ format_version: "1", entries: [{ name: "google", version: "0.1.0" }] }),
  ).toThrow("only project selection fields");
  expect(() => validateLock({ format_version: "1", unsupported_providers: [] })).toThrow(
    "only project selection fields",
  );
  expect(() => validateLock({ format_version: "1", extensions: [] })).toThrow(
    "only project selection fields",
  );
});
