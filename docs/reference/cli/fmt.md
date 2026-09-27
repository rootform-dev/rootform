---
title: "rootform fmt"
description: "Format Rootform files"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Format Rootform files.

## Usage

```text
rootform fmt [path] [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --check ` | ` bool ` | ` false ` | check formatting without rewriting files |
| ` --diff ` | ` bool ` | ` false ` | show formatting changes without rewriting files |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform fmt |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Rewrite Rootform source files using the canonical format.

Without a path, fmt reads the current directory. By default it rewrites
changed files. --check reports their names and --diff writes changes to
standard output without rewriting. Diagnostics go to standard error.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | the sources are formatted |
| `1` | a source cannot be parsed, or --check or --diff found a source that is not formatted |
| `2` | the command was used incorrectly |
| `4` | a source could not be read or rewritten |

## Examples

```sh
rootform fmt
rootform fmt ./dialects
rootform fmt --check
rootform fmt ./dialects --diff
```
