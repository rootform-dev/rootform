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
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text, wide, or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list policy-packs |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

List the Policy Packs the project selects or that are supplied
locally.

With --policy-pack, only the supplied local authoring roots are
read; otherwise the project selection is loaded. The default
listing names one Policy Pack per line, -o wide adds version and
how many policies each declares, and -o json carries the exact
version and content digest.

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
rootform list policy-packs
rootform list policy-packs -o wide
rootform list policy-packs --policy-pack ./policies
rootform list policy-packs -o json
```
