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
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list dialects |

## Behavior

List the dialect catalog available to this project: provided
dialects and the selected dialects.

With no --dialect selection, every loaded dialect is included. The text
or JSON listing goes to standard output. Diagnostics go to standard
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
rootform list dialects --dialect google
rootform list dialects --format json
```
