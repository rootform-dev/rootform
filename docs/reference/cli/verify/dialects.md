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

## Behavior

Verify that the resolved dialects are consistent with the
recorded dialect resolution. The directory selects Dialect sources;
rootform.lock is read from the current working directory.

With no directory, the current directory also supplies Dialect sources.
Matching names and
versions go to standard output. Diagnostics go to standard error.

## Exit status

```text
0  every resolved dialect matches rootform.lock
1  sources, presentation, or rootform.lock could not be verified
2  the command was used incorrectly
```

## Examples

```sh
rootform verify dialects
rootform verify dialects ./dialects
rootform verify dialects ./vendor/dialects
```
