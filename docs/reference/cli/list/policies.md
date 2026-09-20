---
title: "rootform list policies"
description: "List policies"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

List policies.

## Usage

```text
rootform list policies [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text, wide, or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list policies |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

List the policies the selected Policy Packs declare.

With --policy-pack, only the supplied local authoring roots are
read; otherwise the project selection is loaded. The default
listing names one qualified policy per line, -o wide adds what
each policy targets, and -o json carries the owning Policy Pack
and target of every policy.

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
rootform list policies
rootform list policies -o wide
rootform list policies --policy-pack ./policies
rootform list policies -o json
```
