import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ActionReference,
  actionNames,
  renderReference,
  updateReference,
} from "./generate-action-reference.ts";

const root = join(import.meta.dir, "..");
const snapshot = JSON.parse(
  readFileSync(join(root, "contracts/reference/github-actions.json"), "utf8"),
) as ActionReference;

test("every Action page exposes its complete exact input/output contract", () => {
  for (const name of actionNames) {
    const page = readFileSync(join(root, "docs/integrations/github-actions", `${name}.md`), "utf8");
    const generated = renderReference(snapshot, name);
    expect(generated).toContain("| Input | Type | Default | Description |");
    expect(updateReference(page, generated)).toBe(page);
    const rows = generated.split("\n").filter((line) => line.startsWith("| `"));
    const metadata = snapshot.actions[name];
    expect(rows).toHaveLength(
      Object.keys(metadata.inputs).length + Object.keys(metadata.outputs).length,
    );
    for (const id of [...Object.keys(metadata.inputs), ...Object.keys(metadata.outputs)])
      expect(rows.some((row) => row.startsWith(`| \`${id}\` |`))).toBe(true);
    expect(generated).toContain(snapshot.source.commit);
  }
});

test("input tables describe accepted values and preserve literal defaults", () => {
  const generated = renderReference(snapshot, "action");
  expect(generated).toContain("GitHub passes all inputs as strings");
  expect(generated).toContain('| `version` | `string` | `""` |');
  expect(generated).toContain("| `locked` | `bool` | `false` |");
  expect(generated).toContain("| `retention-days` | `int` | `7` |");
  const changed = structuredClone(snapshot);
  changed.actions.setup.inputs.newInput = { description: "New", required: false, default: "" };
  expect(() => renderReference(changed, "setup")).toThrow("Missing documented input type");
});

test("metadata cannot split table cells or introduce raw markup", () => {
  const changed = structuredClone(snapshot);
  const version = changed.actions.setup.inputs.version;
  if (!version) throw new Error("setup requires version metadata");
  version.description = "One | two\n<three> `four`";
  expect(renderReference(changed, "setup")).toContain("One \\| two &lt;three&gt; &#96;four&#96;");
});

test("generation preserves user guidance and rejects incomplete or duplicate regions", () => {
  const before = "Guide\n<!-- BEGIN GENERATED ACTION -->\nold\n<!-- END GENERATED ACTION -->\nNext";
  expect(updateReference(before, "new")).toBe("Guide\nnew\nNext");
  for (const invalid of [
    "Guide",
    "<!-- BEGIN GENERATED ACTION -->",
    `${before}\n${before}`,
    "<!-- END GENERATED ACTION --><!-- BEGIN GENERATED ACTION -->",
  ])
    expect(() => updateReference(invalid, "new")).toThrow("one complete generated region");
});

test("documented workflow inputs exist and each raw plan has its saved-plan pair", () => {
  for (const name of actionNames) {
    const page = readFileSync(join(root, "docs/integrations/github-actions", `${name}.md`), "utf8");
    const examples = [...page.matchAll(/```yaml[^\n]*\n([\s\S]*?)\n```/g)];
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      const yaml = example[1];
      if (!yaml) throw new Error("missing YAML example");
      const steps = Bun.YAML.parse(yaml) as {
        uses?: string;
        with?: Record<string, unknown>;
      }[];
      const step = steps.find(
        (item) => item.uses === `rootform-dev/action${name === "action" ? "" : `/${name}`}@v1`,
      );
      expect(step).toBeDefined();
      if (!step) throw new Error(`missing ${name} step`);
      for (const key of Object.keys(step.with ?? {}))
        expect(snapshot.actions[name].inputs).toHaveProperty(key);
      for (const [input, saved] of [
        ["input", "plan-file"],
        ["before", "before-plan-file"],
        ["after", "after-plan-file"],
      ] as const) {
        if (String(step.with?.[input]).endsWith("/plan.json"))
          expect(step.with?.[saved]).toBe(
            String(step.with?.[input]).replace(/plan\.json$/, "plan.tfplan"),
          );
      }
    }
  }
});
