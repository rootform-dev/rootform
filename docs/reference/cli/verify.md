---
title: "rootform verify"
description: "Verify locked dialects"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Verify locked dialects.

## Usage

```text
rootform verify <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform verify |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Verify that resolved dialects match the recorded resolution.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform verify dialects `](verify/dialects.md) | Verify locked dialects |

## Examples

```sh
rootform verify dialects
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
