---
title: "rootform lock dialects"
description: "Lock resolved dialects"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Lock resolved dialects.

## Usage

```text
rootform lock dialects [directory] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform lock dialects |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Record the resolved dialects and their selected versions in the
generated, deterministic JSON file rootform.lock.

With no directory, lock reads the current directory. Locked names and
versions go to standard output. Diagnostics go to standard error.

## Exit status

```text
0  rootform.lock was written
1  the dialects or lock file could not be read or written
2  the command was used incorrectly
3  no complete dialect resolution was produced
```

## Examples

```sh
rootform lock dialects
rootform lock dialects ./dialects
rootform lock dialects ./vendor/dialects
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
