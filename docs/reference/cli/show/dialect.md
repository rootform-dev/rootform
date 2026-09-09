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

## Behavior

Show a dialect, including its version, requirements,
providers, concepts, contexts, relations, and rules.

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
