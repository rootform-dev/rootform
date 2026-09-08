---
title: "rootform remove dialect"
description: "Remove a dialect"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Remove a dialect.

## Usage

```text
rootform remove dialect <name> <version> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform remove dialect |

## Behavior

Remove one installed version of a dialect from the local Rootform
store.

The removed name and version go to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  the dialect was removed
1  the dialect could not be removed
2  the command was used incorrectly
```

## Examples

```sh
rootform remove dialect google 0.1.0
rootform remove dialect kubernetes 0.1.0
rootform list dialects
```
