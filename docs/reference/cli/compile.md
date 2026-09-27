---
title: "rootform compile"
description: "Compile a Policy Pack for offline checks"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Compile a Policy Pack for offline checks.

## Usage

```text
rootform compile <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform compile |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Compile Policy Pack sources with explicit semantic pins for later checks.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | help was shown |
| `2` | the command was used incorrectly |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform compile policy-pack `](compile/policy-pack.md) | Compile and pin a Policy Pack |
