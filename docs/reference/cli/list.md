---
title: "rootform list"
description: "List Rootform definitions"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

List Rootform definitions.

## Usage

```text
rootform list <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

List the dialects a project loads, the Policy Packs it selects, or
the policies those Policy Packs declare.

Use "rootform show" to read one listed definition in full.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform list dialects `](list/dialects.md) | List the dialect catalog |
| [` rootform list policies `](list/policies.md) | List policies |
| [` rootform list policy-packs `](list/policy-packs.md) | List Policy Packs |

## Examples

```sh
rootform list dialects
rootform list dialects -o wide
rootform list policy-packs
rootform list policies
```
