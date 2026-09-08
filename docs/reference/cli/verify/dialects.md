---
title: "rootform verify dialects"
description: "Verify locked dialects"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Verify locked dialects.

## Usage

```text
rootform verify dialects [directory] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform verify dialects |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Verify that the resolved dialects are consistent with the
recorded dialect resolution.

With no directory, verify reads the current directory. Matching names and
versions go to standard output. Diagnostics go to standard error.

## Exit status

```text
0  every resolved dialect matches rootform.lock
1  a dialect differs or the lock file could not be read
2  the command was used incorrectly
3  no complete verification was produced
```

## Examples

```sh
rootform verify dialects
rootform verify dialects ./dialects
rootform verify dialects ./vendor/dialects
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
