---
title: "rootform list dialects"
description: "List the dialect catalog"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

List the dialect catalog.

## Usage

```text
rootform list dialects [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | limit results to this dialect `name`; repeatable |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text, wide, or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list dialects |

## Behavior

List the dialect catalog available to this project: the dialects
supplied with rootform and the dialects the project selects.

With no --dialect selection, every loaded dialect is included. The
default listing names one dialect per line, -o wide adds version,
origin and how much each dialect declares, and -o json carries the
exact version, origin and content digest of every selection.

The listing goes to standard output. Diagnostics go to standard
error.

## Exit status

```text
0  the definitions were listed
2  the command was used incorrectly
3  the selected definitions could not be read
```

## Examples

```sh
rootform list dialects
rootform list dialects -o wide
rootform list dialects --dialect google
rootform list dialects -o json
```
