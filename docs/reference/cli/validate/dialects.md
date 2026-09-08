---
title: "rootform validate dialects"
description: "Validate dialect definitions"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate dialect definitions.

## Usage

```text
rootform validate dialects [directory] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate dialects |

## Behavior

Compile and validate a dialect, including its concepts, rules,
and references.

With no directory, validation reads the current directory. The text or
JSON result goes to standard output. Diagnostics go to standard error.

## Exit status

```text
0  every dialect is valid
1  at least one dialect is not valid
2  the command was used incorrectly
3  no dialect result could be decided
```

## Examples

```sh
rootform validate dialects
rootform validate dialects ./dialects
rootform validate dialects ./dialects --format json
```
