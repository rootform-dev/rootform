---
title: "rootform lock"
description: "Lock resolved dialects"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Lock resolved dialects.

## Usage

```text
rootform lock <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform lock |

## Behavior

Record resolved dialects so a later run loads the same versions.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform lock dialects `](lock/dialects.md) | Lock resolved dialects |

## Examples

```sh
rootform lock dialects
```
