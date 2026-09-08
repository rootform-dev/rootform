---
title: "rootform list rules"
description: "List rules"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

List rules.

## Usage

```text
rootform list rules [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | limit results to this dialect `name`; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list rules |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

List rules available from the loaded dialects.

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
rootform list rules
rootform list rules --dialect kubernetes
rootform list rules --format json
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
