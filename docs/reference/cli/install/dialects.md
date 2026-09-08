---
title: "rootform install dialects"
description: "Install dialects"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Install dialects.

## Usage

```text
rootform install dialects <directory> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform install dialects |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Install every dialect found in a directory into the local Rootform
store.

Installed names and versions go to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  every dialect was installed
1  the dialects could not be installed
2  the command was used incorrectly
```

## Examples

```sh
rootform install dialects ./dialects
rootform install dialects ./dialects/google
rootform install dialects ./vendor/dialects
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
