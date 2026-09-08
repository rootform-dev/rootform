---
title: "rootform show dialect"
description: "Show a dialect"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Show a dialect.

## Usage

```text
rootform show dialect <name> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show dialect |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Show a dialect, including its version, requirements,
providers, concepts, and rules.

The name selects one loaded dialect.

The text or JSON definition goes to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  the definition was shown
1  the named definition was not found
2  the command was used incorrectly
3  no single definition could be selected
```

## Examples

```sh
rootform show dialect google
rootform show dialect kubernetes
rootform show dialect google --format json
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
