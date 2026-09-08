---
title: "rootform fmt"
description: "Format Rootform files"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Format Rootform files.

## Usage

```text
rootform fmt [path] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --check ` | ` bool ` | ` false ` | check formatting without rewriting files |
| ` --diff ` | ` bool ` | ` false ` | show formatting changes without rewriting files |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform fmt |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Rewrite Rootform source files using the canonical format.

With no path, fmt reads the current directory. By default it rewrites
changed files. --check reports their names and --diff writes changes to
standard output without rewriting. Diagnostics go to standard error.

## Exit status

```text
0  the sources are formatted
1  --check or --diff found a source that is not formatted
2  the command was used incorrectly
3  a source could not be read, parsed, or rewritten
```

## Examples

```sh
rootform fmt
rootform fmt ./dialects
rootform fmt --check
rootform fmt ./dialects --diff
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
