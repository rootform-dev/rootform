---
title: "rootform vendor"
description: "Vendor selected non-embedded content"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Vendor selected non-embedded content.

## Usage

```text
rootform vendor <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor |

## Behavior

Materialize the project's exact non-embedded selections: dialects
and Policy Pack sources, with their licenses and notices.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform vendor dialects `](vendor/dialects.md) | Vendor selected dialects |
| [` rootform vendor policy-packs `](vendor/policy-packs.md) | Vendor selected Policy Packs |

## Examples

```sh
rootform vendor dialects
rootform vendor policy-packs
```
