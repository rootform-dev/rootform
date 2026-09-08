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
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show policy-pack |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `directory`; repeatable |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Show a Policy Pack, including version, semantic requirements, policies,
exact registry pins, and provenance available locally.

The name selects one loaded Policy Pack.

The text or JSON definition goes to standard output. Diagnostics go to
standard error.

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
rootform show policy-pack baseline --format json
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
