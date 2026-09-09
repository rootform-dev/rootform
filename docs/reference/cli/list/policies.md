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
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list policies |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |

## Behavior

List policies available from selected Policy Packs.

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
rootform list policies
rootform list policies --policy-pack ./policies
rootform list policies --format json
```
