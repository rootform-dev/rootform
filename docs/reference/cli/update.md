---
title: "rootform update"
description: "Change a selection in rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Change a selection in rootform.lock.

## Usage

```text
rootform update <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform update |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Record new content for one selected dialect or Policy Pack, or switch
it to another exact source.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform update dialects `](update/dialects.md) | Change one selected dialect |
| [` rootform update policy-packs `](update/policy-packs.md) | Change one selected Policy Pack |

## Examples

```sh
rootform update dialects payments
rootform update dialects payments ./dialects/payments-next
rootform update dialects payments registry.example.com/acme/payments:0.2.0
rootform update policy-packs baseline
rootform update policy-packs baseline ./policies
rootform update policy-packs baseline registry.example.com/acme/baseline:1.1.0
```
