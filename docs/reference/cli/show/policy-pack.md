---
title: "rootform show policy-pack"
description: "Show a Policy Pack"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Show a Policy Pack.

## Usage

```text
rootform show policy-pack <name> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show policy-pack |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Show a selected or local Policy Pack, including its version, the
policies it declares, its content identity, and its source location.

The name selects one loaded Policy Pack. With --policy-pack, only the
provided local authoring roots are read.

The text or JSON definition goes to standard output. Diagnostics go
to standard error.

## Exit status

```text
0  the definition was shown
1  the named definition was not found
2  the command was used incorrectly
3  no single definition could be selected
```

## Examples

```sh
rootform show policy-pack baseline
rootform show policy-pack baseline --policy-pack ./policies
rootform show policy-pack baseline -o json
```
