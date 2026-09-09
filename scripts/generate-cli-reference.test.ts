import { expect, test } from "bun:test";
import {
  beginBuild,
  commandNavigation,
  endBuild,
  parseReference,
  renderCommand,
  replaceBuild,
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
        subcommands: ["rootform build"],
      },
      {
        path: "rootform build",
        usage: "rootform build [directory] [flags]",
        summary: "Build architecture",
        description: "Write a document.\n\nExit status:\n  0  built\n  3  unavailable",
        aliases: ["compile"],
        examples: "  rootform build .",
        flags: [
          {
            name: "output",
            shorthand: "o",
            type: "string",
            default: "",
            usage: "Write to `path`",
            required: true,
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
  const build = present(commands[1]);
  const page = renderCommand(build, commands);
  expect(page).toContain("rootform build [directory] [flags]");
  expect(page).toContain("## Inherited flags");
  expect(page).toContain("` false `");
  expect(page).toContain("Required.");
  expect(page).toContain("Aliases: ` compile `.");
  expect(page).toContain("```text\n0  built\n3  unavailable\n```");
  expect(page).toContain("```sh\nrootform build .\n```");
  expect(page).not.toContain("Boolean flags set");
  expect(page).not.toContain("Command syntax and help are generated");
  expect(renderCommand(present(commands[0]), commands)).toContain("](build.md)");
  expect(commandNavigation(commands)).toEqual([{ label: "build", page: "reference/cli/build" }]);
});

test("only replaces the bounded generated block in an authored command page", () => {
  const build = present(parseReference(document())[1]);
  const page = `Authored introduction.\n${beginBuild}\nOld flags.\n${endBuild}\nReal example.\n`;
  const expected = `Authored introduction.\n${beginBuild}\n\n${syntax(build)}\n\n${endBuild}\nReal example.\n`;
  expect(replaceBuild(page, build)).toBe(expected);
  expect(replaceBuild(expected, build)).toBe(expected);
  expect(() => replaceBuild(page + beginBuild, build)).toThrow("exactly one");
  expect(() => replaceBuild(endBuild + beginBuild, build)).toThrow("reversed");
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
