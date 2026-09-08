---
title: "rootform list policy-packs"
description: "List Policy Packs"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

List Policy Packs.

## Usage

```text
rootform list policy-packs [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list policy-packs |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

List Policy Packs selected by the project or supplied locally.

With --policy-pack, only supplied local authoring roots are used;
otherwise the project selection is loaded. The text
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
rootform list policy-packs
rootform list policy-packs --policy-pack ./policies
rootform list policy-packs --format json
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
