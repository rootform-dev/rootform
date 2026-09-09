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

## Behavior

Compile Dialect sources from the supplied directory and replace
rootform.lock in the current working directory. Existing Policy Pack
selections and registry acquisition pins are not preserved. Use rootform init
for project preparation.

With no directory, the current directory also supplies Dialect sources.
Locked names and
versions go to standard output. Diagnostics go to standard error.

## Exit status

```text
0  rootform.lock was written
1  sources or presentation could not compile, or the lock could not be written
2  the command was used incorrectly
```

## Examples

```sh
rootform lock dialects
rootform lock dialects ./dialects
rootform lock dialects ./vendor/dialects
```
