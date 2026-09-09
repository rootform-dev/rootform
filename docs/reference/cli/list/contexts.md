---
title: "rootform list contexts"
description: "List context dimensions"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

List context dimensions.

## Usage

```text
rootform list contexts [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | limit results to this dialect `name`; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list contexts |

## Behavior

List context dimensions available from loaded dialects.

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
rootform list contexts
rootform list contexts --dialect core
rootform list contexts --format json
```
