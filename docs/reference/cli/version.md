---
title: "rootform version"
description: "Show the Rootform version"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Show the Rootform version.

## Usage

```text
rootform version [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform version |

## Behavior

Print the Rootform version to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  the version was printed
2  the command was used incorrectly
```

## Examples

```sh
rootform version
rootform --version
rootform version > rootform-version.txt
```
