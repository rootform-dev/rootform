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
        usage: "rootform <command> [options]",
        summary: "Read architecture",
        description: "Root",
        subcommands: ["rootform run"],
        flag_groups: ["Global options"],
        flags: [
          {
            name: "help",
            type: "bool",
            group: "Global options",
            default: "false",
            usage: "Show help",
          },
        ],
      },
      {
        path: "rootform run",
        usage: "rootform run <input> [options]",
        summary: "Analyze a plan or state",
        description: "Write a document.\n\nExit status:\n  0  analyzed\n  3  refused",
        aliases: ["compile"],
        examples: "  rootform run plan.json --no-serve",
        flag_groups: ["Input", "Global options"],
        flags: [
          {
            name: "output",
            shorthand: "o",
            type: "string",
            group: "Input",
            default: "",
            usage: "Write to `path`",
            required: true,
          },
          {
            name: "plan-file",
            type: "file",
            group: "Input",
            default: "",
            usage: "read JSON plan; use '-' for standard input",
          },
          {
            name: "help",
            type: "bool",
            group: "Global options",
            default: "false",
            usage: "Show help",
          },
        ],
        inherited_flags: [
          {
            name: "quiet",
            type: "bool",
            group: "Global options",
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

test("validates command and flag groups at the opaque boundary", () => {
  const fixture = () =>
    structuredClone(document()) as unknown as {
      format_version: number;
      commands: Record<string, unknown>[];
    };
  const entry = (commands: Record<string, unknown>[], index: number) => present(commands[index]);
  const flag = (cmd: Record<string, unknown>, key: string) =>
    present(cmd[key] as Record<string, unknown>[])[0] as Record<string, unknown>;
  const invalid = (change: (commands: Record<string, unknown>[]) => void, message: string) => {
    const value = fixture();
    change(value.commands);
    expect(() => parseReference(value)).toThrow(message);
  };
  invalid((commands) => {
    entry(commands, 0).flag_groups = undefined;
  }, "flag_groups must contain strings");
  invalid((commands) => {
    entry(commands, 0).flag_groups = [];
  }, "flag_groups must end");
  invalid((commands) => {
    entry(commands, 0).flag_groups = ["Input"];
  }, "flag_groups must end");
  invalid((commands) => {
    entry(commands, 0).flag_groups = [3, "Global options"];
  }, "flag_groups must contain strings");
  invalid((commands) => {
    entry(commands, 1).flag_groups = ["Input", "Input", "Global options"];
  }, "duplicate flag_groups");
  invalid((commands) => {
    entry(commands, 1).flag_groups = ["Input", "Unused", "Global options"];
  }, "empty flag group");
  invalid((commands) => {
    flag(entry(commands, 1), "flags").group = undefined;
  }, "missing flag group");
  invalid((commands) => {
    flag(entry(commands, 1), "flags").group = "Unknown";
  }, "flag group Unknown is not listed");
  invalid((commands) => {
    flag(entry(commands, 1), "inherited_flags").group = "Input";
  }, "must use Global options");
  invalid((commands) => {
    flag(entry(commands, 1), "flags").group = "Input";
    (entry(commands, 1).flags as Record<string, unknown>[])[2] = {
      name: "help",
      type: "bool",
      group: "Input",
      default: "false",
      usage: "Show help",
    };
  }, "help must use Global options");
  invalid((commands) => {
    flag(entry(commands, 1), "flags").secret = true;
  }, "unknown field");
  invalid((commands) => {
    entry(commands, 1).group = 3;
  }, "invalid group");
  invalid((commands) => {
    entry(commands, 0).command_groups = ["Analyze", "Analyze"];
  }, "duplicate command_groups");
  invalid((commands) => {
    entry(commands, 0).command_groups = "Analyze";
  }, "command_groups must contain strings");
  invalid((commands) => {
    entry(commands, 0).command_groups = [3];
  }, "command_groups must contain strings");
  invalid((commands) => {
    entry(commands, 0).command_groups = ["Inspect"];
    entry(commands, 1).group = "Analyze";
  }, "child group not listed");
  invalid((commands) => {
    entry(commands, 0).command_groups = ["Inspect"];
  }, "child group not listed");
  invalid((commands) => {
    entry(commands, 1).group = "Analyze";
  }, "child group without command_groups");
  const grouped = fixture();
  entry(grouped.commands, 0).command_groups = ["Analyze"];
  entry(grouped.commands, 1).group = "Analyze";
  expect(parseReference(grouped)).toHaveLength(2);
});

test("renders exact usage, inherited defaults, aliases and required state", () => {
  const commands = parseReference(document());
  const command = present(commands[1]);
  const page = renderCommand(command, commands);
  expect(page).toContain("rootform run <input> [options]");
  expect(page).toContain("## Options\n\n### Input");
  expect(page).toContain("### Global options");
  expect(page.indexOf("--plan-file")).toBeLessThan(page.indexOf("### Global options"));
  expect(page.indexOf("--help")).toBeLessThan(page.indexOf("--quiet"));
  expect(page.indexOf("--quiet")).toBeGreaterThan(page.indexOf("### Global options"));
  expect(page).toContain("` false `");
  expect(page).toContain("Required.");
  expect(page).toContain("read JSON plan; use `-` for standard input");
  expect(page).toContain("Aliases: ` compile `.");
  expect(page).toContain(
    "| Status | Description |\n| --- | --- |\n| `0` | analyzed |\n| `3` | refused |",
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
  const fixture = structuredClone(document()) as unknown as {
    format_version: number;
    commands: Record<string, unknown>[];
  };
  present(fixture.commands[0]).command_groups = ["Analyze", "Inspect"];
  present(fixture.commands[0]).subcommands = ["rootform run", "rootform show"];
  present(fixture.commands[1]).group = "Analyze";
  fixture.commands.push({
    path: "rootform run details",
    usage: "rootform run details [options]",
    summary: "Inspect run",
    description: "Details",
    flag_groups: ["Global options"],
    flags: [
      { name: "help", type: "bool", group: "Global options", default: "false", usage: "Show help" },
    ],
  });
  present(fixture.commands[1]).subcommands = ["rootform run details"];
  fixture.commands.push({
    path: "rootform show",
    usage: "rootform show [options]",
    summary: "Show definitions",
    description: "Show",
    group: "Inspect",
    flag_groups: ["Global options"],
    flags: [
      { name: "help", type: "bool", group: "Global options", default: "false", usage: "Show help" },
    ],
  });
  fixture.commands.reverse();
  const commands = parseReference(fixture);
  const root = present(commands.find((entry) => entry.path === "rootform"));
  const page = replaceGenerated(`${beginGenerated(root.path)}\n${endGenerated}`, root, commands);
  expect(page.match(/^\| \[` rootform /gmu)).toHaveLength(commands.length - 1);
  expect(page).toContain("### Analyze");
  expect(page).toContain("### Inspect");
  expect(page.indexOf("rootform run details")).toBeLessThan(page.indexOf("### Inspect"));
  expect(page.indexOf("rootform show")).toBeGreaterThan(page.indexOf("### Inspect"));
  expect(page).toContain("](run/details.md)");
  expect(page).toContain("](show.md)");
});

test("index inventory still links every command in the checked-in export", () => {
  const commands = parseReference(
    JSON.parse(readFileSync(new URL("../reference/cli.json", import.meta.url), "utf8")),
  );
  const root = present(commands.find((entry) => entry.path === "rootform"));
  const page = replaceGenerated(`${beginGenerated(root.path)}\n${endGenerated}`, root, commands);
  expect(page.match(/^\| \[` rootform /gmu)).toHaveLength(commands.length - 1);
  expect(page).toContain("](explain/instance.md)");
  expect(page).toContain("](explain/rule.md)");
  expect(page).toContain("](validate/rule.md)");
});

test("joins exit status continuation lines and rejects malformed lines", () => {
  const commands = parseReference(document());
  const command = {
    ...present(commands[1]),
    description:
      "Run.\n\nExit status:\n  0  worked\n  3  evidence missing\n     or refused\n     after checking",
  };
  const page = renderCommand(command, commands);
  expect(page).toContain("| `3` | evidence missing or refused after checking |");
  expect(() =>
    renderCommand(
      { ...command, description: command.description.replace("     or refused", "    or refused") },
      commands,
    ),
  ).toThrow("Invalid exit status");
  expect(() =>
    renderCommand(
      { ...command, description: "Run.\n\nExit status:\n     orphan\n  0  worked" },
      commands,
    ),
  ).toThrow("Invalid exit status");
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

test("an Options flag group sits directly under the Options heading", () => {
  const commands = parseReference(document());
  const run = present(commands[1]);
  const cmd = {
    ...run,
    flag_groups: ["Options", "Global options"],
    flags: (run.flags ?? []).map((flag) =>
      flag.group === "Input" ? { ...flag, group: "Options" } : flag,
    ),
  };
  const page = renderCommand(cmd, commands);
  expect(page).toContain("## Options\n\n| Flag | Type | Default | Description |");
  expect(page).not.toContain("### Options");
  expect(page).toContain("### Global options");
});
