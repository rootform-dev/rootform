import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  beginGenerated,
  commandNavigation,
  endGenerated,
  generate,
  parseReference,
  renderCommand,
  replaceGenerated,
  syntax,
} from "./generate-cli-reference.ts";

function present<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing test fixture item");
  return value;
}

function document() {
  return {
    format_version: 1,
    commands: [
      {
        path: "rootform",
        usage: "rootform [command]",
        summary: "Read architecture",
        description: "Root",
        subcommands: ["rootform run"],
      },
      {
        path: "rootform run",
        usage: "rootform run <input> [flags]",
        summary: "Analyze a plan or state",
        description: "Write a document.\n\nExit status:\n  0  analyzed\n  3  refused",
        aliases: ["compile"],
        examples: "  rootform run plan.json --no-serve",
        flags: [
          {
            name: "output",
            shorthand: "o",
            type: "string",
            default: "",
            usage: "Write to `path`",
            required: true,
          },
          {
            name: "plan-file",
            type: "file",
            default: "",
            usage: "read JSON plan; use '-' for standard input",
          },
        ],
        inherited_flags: [
          {
            name: "quiet",
            type: "bool",
            default: "false",
            usage: "Reduce output",
            no_option_default: "true",
          },
        ],
      },
    ],
  };
}

test("rejects unrecognized metadata and incomplete trees at the opaque boundary", () => {
  expect(parseReference(document())).toHaveLength(2);
  expect(() => parseReference({ ...document(), internal: "private" })).toThrow("unknown field");
  const hidden = document();
  Object.assign(present(hidden.commands[1]), { hidden: true });
  expect(() => parseReference(hidden)).toThrow("unknown field");
  const missing = document();
  present(missing.commands[0]).subcommands = [];
  expect(() => parseReference(missing)).toThrow("incomplete child");
  const path = document();
  present(path.commands[1]).path = "rootform ../../private";
  expect(() => parseReference(path)).toThrow("invalid or duplicate");
  const flags = document();
  present(present(flags.commands[1]).inherited_flags?.[0]).name = "output";
  expect(() => parseReference(flags)).toThrow("shadowed flag");
});

test("renders exact usage, inherited defaults, aliases and required state", () => {
  const commands = parseReference(document());
  const command = present(commands[1]);
  const page = renderCommand(command, commands);
  expect(page).toContain("rootform run <input> [flags]");
  expect(page).toContain("## Inherited flags");
  expect(page).toContain("` false `");
  expect(page).toContain("Required.");
  expect(page).toContain("read JSON plan; use `-` for standard input");
  expect(page).toContain("Aliases: ` compile `.");
  expect(page).toContain(
    "| Status | Meaning |\n| --- | --- |\n| `0` | analyzed |\n| `3` | refused |",
  );
  expect(page).toContain("```sh\nrootform run plan.json --no-serve\n```");
  expect(page).not.toContain("Boolean flags set");
  expect(page).not.toContain("Command syntax and help are generated");
  expect(renderCommand(present(commands[0]), commands)).toContain("](run.md)");
  expect(commandNavigation(commands)).toEqual([{ label: "run", page: "reference/cli/run" }]);
});

test("only replaces generated syntax and inventory, preserving authored prose", () => {
  const commands = parseReference(document());
  const command = present(commands[1]);
  const begin = beginGenerated(command.path);
  const page = `Authored introduction.\n${begin}\nOld flags.\n${endGenerated}\nReal example.\n`;
  const expected = `Authored introduction.\n${begin}\n\n${syntax(command)}\n\n${endGenerated}\nReal example.\n`;
  expect(replaceGenerated(page, command, commands)).toBe(expected);
  expect(replaceGenerated(expected, command, commands)).toBe(expected);
  expect(() => replaceGenerated(page + begin, command, commands)).toThrow("exactly one");
  expect(() => replaceGenerated(page.replace(begin, ""), command, commands)).toThrow("exactly one");
  expect(() => replaceGenerated(endGenerated + begin, command, commands)).toThrow("reversed");
  const root = present(commands[0]);
  const rootPage = replaceGenerated(
    `${beginGenerated(root.path)}\n${endGenerated}`,
    root,
    commands,
  );
  expect(rootPage).toContain("## Command inventory");
  expect(rootPage).toContain("](run.md)");
});

test("index inventory links every exported command, including nested ones", () => {
  const commands = parseReference(
    JSON.parse(readFileSync(new URL("../reference/cli.json", import.meta.url), "utf8")),
  );
  const root = present(commands.find((entry) => entry.path === "rootform"));
  const page = replaceGenerated(`${beginGenerated(root.path)}\n${endGenerated}`, root, commands);
  expect(page.match(/^\| \[` rootform /gmu)).toHaveLength(commands.length - 1);
  expect(page).toContain("](explain/semantics.md)");
  expect(page).toContain("](validate/rule.md)");
});

test("generation refuses an exported inventory missing an authored command", () => {
  const root = mkdtempSync(join(tmpdir(), "rootform-cli-reference-"));
  try {
    mkdirSync(join(root, "reference"));
    writeFileSync(join(root, "reference/cli.json"), JSON.stringify(document()));
    expect(() => generate(root, true)).toThrow("Authored CLI reference has no exported command");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("help containing markup or code delimiters stays readable", () => {
  const commands = parseReference(document());
  const cmd = {
    ...present(commands[1]),
    description: "Use <path> with A | B.",
    examples: "printf '```'",
  };
  const page = renderCommand(cmd, commands);
  expect(page).toContain("Use &lt;path&gt; with A | B.");
  expect(page).toContain("````sh\nprintf '```'\n````");
});
