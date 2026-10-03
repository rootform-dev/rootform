import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inventoryFromSources, officialDialectInventory } from "./dialects/inventory.ts";
import { declaredRuleIds } from "./dialects/validate.ts";
import {
  coverageNavigation,
  dialectCoveragePage,
  generateCoveragePages,
  generateProviderCoverage,
} from "./generate-provider-coverage.ts";

const root = join(import.meta.dir, "..");
const manifest = `dialect "example" {
  version = "0.1.0"
  provider "hashicorp/example" { version = ">= 1.0.0, < 2.0.0" }
  provider "hashicorp/example-beta" { version = "= 1.5.0" }
}`;
const sources = [
  { file: "example/dialect.rf.hcl", text: manifest },
  {
    file: "example/vocabulary.rf.hcl",
    text: `concept "local" { description = "An exact local meaning." }
concept "unused" { description = "A declared, unused term." }
context "placement" { description = "Placement in the declared frame." }
relation "reads-from" { description = "A declared read relationship." }`,
  },
  {
    file: "example/rules.rf.hcl",
    text: `rule "primary" {
  match {
    type = "example_root"
    where = source.role == "primary"
  }
  as = rf.concept.virtual-network
  identity { attributes = ["id", "name"] }
  endpoint { attributes = ["id"] }
  context "placement" {
    to = concept.local
    via = source.parent_id
    on_null = "absent"
    on_empty = "indeterminate"
    match { by = [target.id, target.name]
      strategy = "exact"
    }
  }
  relation {
    as = relation.reads-from
    to = example.concept.local
    via = source.storage_id
    on_null = "absent"
    on_empty = "absent"
  }
  relation "uses-key" {
    to = rule.secondary
    via = source.key_id
    on_null = "absent"
    on_empty = "absent"
  }
  contribution {
    to = rf.concept.virtual-network
    via = source.network_id
    on_null = "absent"
    on_empty = "absent"
  }
  composition {
    member "proxy" {
      via = source.proxy_id
      match { type = "example_proxy" }
    }
    member "audit" {
      via = source.audit_id
      match { type = "example_audit" }
    }
    member "backend" {
      via = member.proxy.backend_id
      match { type = "example_backend"
        where = source.enabled == true
      }
    }
  }
}
rule "secondary" {
  match { type = "example_root"
    where = source.role == "secondary"
  }
  as = concept.local
}
rule "lookup" {
  match { type = "example_root"
    kind = "data"
  }
  contribution {
    to = concept.local
    via = source.root_id
    on_null = "absent"
    on_empty = "absent"
  }
}`,
  },
];

test("one inventory retains declarations, use, inline symbols and Contributions without as", () => {
  const inventory = inventoryFromSources("example", "0.1.0", sources);
  const placement = inventory.definitions.find(
    (definition) => definition.id === "example.context.placement",
  )!;
  expect(placement.description).toBe("Placement in the declared frame.");
  expect(placement.declarations.map((declaration) => declaration.inline)).toEqual([true, false]);
  expect(placement.usedBy).toEqual(["example.rule.primary"]);
  expect(
    inventory.definitions.find((definition) => definition.id === "example.concept.unused")?.usedBy,
  ).toEqual([]);
  expect(
    inventory.definitions.find((definition) => definition.id === "example.relation.uses-key")
      ?.description,
  ).toBeUndefined();
  const primary = inventory.rules.find((rule) => rule.name === "primary")!;
  expect(primary.emissions.at(-1)).toMatchObject({
    kind: "contribution",
    symbol: undefined,
    target: "rf.concept.virtual-network",
    via: "source.network_id",
  });
  expect(primary.identity.attributes).toBe('["id", "name"]');
  expect(primary.endpoint.attributes).toBe('["id"]');
  expect(primary.emissions[0]?.match.by).toBe("[target.id, target.name]");
  expect(
    inventory.definitions.find((definition) => definition.id === "example.concept.local")?.usedBy,
  ).toEqual(["example.rule.lookup", "example.rule.primary", "example.rule.secondary"]);
  expect(inventory.rfReferences).toEqual(["rf.concept.virtual-network"]);
});

test("compositions preserve order and only actual member dependencies", () => {
  const primary = inventoryFromSources("example", "0.1.0", sources).rules.find(
    (rule) => rule.name === "primary",
  )!;
  expect(primary.members.map((member) => [member.name, member.dependencies])).toEqual([
    ["proxy", []],
    ["audit", []],
    ["backend", ["proxy"]],
  ]);
  const page = dialectCoveragePage(inventoryFromSources("example", "0.1.0", sources));
  expect(page).toContain(
    '3. **`backend`** matches `"example_backend"` (`"resource"`), through `member.proxy.backend_id`. Depends on `proxy`.',
  );
  expect(page).not.toContain("Depends on `audit`");
  expect(page).toContain("Condition: `source.enabled == true`.");
  expect(page).toContain("**Contributions**");
});

test("type rows distinguish resource/data and preserve conditional Rule candidates", () => {
  const page = dialectCoveragePage(inventoryFromSources("example", "0.1.0", sources));
  expect(page.split("\n").filter((line) => line.startsWith("| `example_root`"))).toHaveLength(2);
  expect(page).toContain("`resource`");
  expect(page).toContain("`data`");
  expect(page).toContain("[`primary`](#rule-primary)");
  expect(page).toContain("(#rule-primary) (conditional)");
  expect(page).toContain("(#rule-secondary) (conditional)");
  expect(page).toContain('source.role == "primary"');
  expect(page).toContain("rf-vocabulary.md#rf-concept-virtual-network");
  expect(page).not.toContain("An explicitly declared virtual network.");
});

test("generation is deterministic across discovery order and bindings remain paired", () => {
  const inventory = inventoryFromSources("example", "0.1.0", sources);
  expect(inventoryFromSources("example", "0.1.0", [...sources].reverse())).toEqual(inventory);
  const index = generateProviderCoverage([inventory]);
  expect(index).toContain("| `hashicorp/example` | `>= 1.0.0, < 2.0.0` |");
  expect(index).toContain("| `hashicorp/example-beta` | `= 1.5.0` |");
  expect(index).not.toContain("<details>");
  expect(index).toContain('<a id="example"></a>');
  expect(index).toContain('<a id="providers-and-versions"></a>');
  expect(index).toContain('<a id="interpreted-types-and-declared-facts"></a>');
  expect(index).toContain("128 MiB");
  expect(index).toContain("interpretation coverage, not which resources are included");
  expect([...generateCoveragePages([inventory])]).toEqual([...generateCoveragePages([inventory])]);
});

test("coverage navigation is generated in Reference and leaves startup links separate", () => {
  const inventory = inventoryFromSources("example", "0.1.0", sources);
  const navigation = coverageNavigation(
    [
      {
        label: "Get started",
        items: [
          { label: "Overview", page: "index" },
          { label: "Provider coverage", page: "reference/provider-coverage" },
        ],
      },
      { label: "Reference", items: [{ label: "Outputs", page: "reference/outputs" }] },
    ],
    [inventory],
  );
  expect(navigation[0]?.items).toEqual([{ label: "Overview", page: "index" }]);
  expect(navigation[1]?.items?.[0]).toEqual({
    label: "Provider coverage",
    collapsed: true,
    items: [
      { label: "Overview", page: "reference/provider-coverage" },
      { label: "example", page: "reference/provider-coverage/example" },
    ],
  });
  expect(coverageNavigation(navigation, [inventory])).toEqual(navigation);
});

test("all official Rules and local definitions have dedicated stable anchors", () => {
  const inventory = officialDialectInventory(root);
  const sourceRules = declaredRuleIds(
    JSON.parse(readFileSync(join(root, "dialects/dialects.json"), "utf8")),
  );
  expect(new Set(inventory.flatMap((dialect) => dialect.rules.map((rule) => rule.id)))).toEqual(
    sourceRules,
  );
  const pages = generateCoveragePages(inventory);
  expect(pages.size).toBe(inventory.length + 1);
  for (const dialect of inventory) {
    const page = pages.get(`provider-coverage/${dialect.name}.md`)!;
    for (const rule of dialect.rules)
      expect(page.includes(`<div id="rule-${rule.name}"></div>`)).toBe(true);
    for (const definition of dialect.definitions)
      expect(page.includes(`<dt id="${definition.id.replaceAll(".", "-")}">`)).toBe(true);
    expect((page.match(/^\| Terraform type/gmu) ?? []).length).toBe(dialect.rules.length ? 1 : 0);
  }
  expect(pages.has("provider-coverage/secrets.md")).toBe(false);
  expect(pages.get("provider-coverage.md")).toContain('<a id="secrets"></a>');
  const visualOnly = inventoryFromSources("example", "0.1.0", [
    { file: "example/dialect.rf.hcl", text: manifest },
  ]);
  const bindingsOnly = dialectCoveragePage(visualOnly);
  expect(bindingsOnly).toContain("no interpretation Rules");
  expect(bindingsOnly).toContain("without adding architectural interpretation");
  expect(bindingsOnly).not.toContain("presentation mappings");
  expect(bindingsOnly).not.toContain("## Rule details");
  visualOnly.presentation = {
    file: "example/presentation.json",
    hasResources: true,
    hasDefinitions: false,
  };
  expect(dialectCoveragePage(visualOnly)).toContain("presentation mappings");
  expect(dialectCoveragePage(visualOnly)).not.toContain("## Interpreted types");
});
