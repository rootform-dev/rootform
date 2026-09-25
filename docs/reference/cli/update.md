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
| [` rootform update dialect `](update/dialect.md) | Change one selected dialect |
| [` rootform update policy-pack `](update/policy-pack.md) | Change one selected Policy Pack |

## Examples

```sh
rootform update dialect payments
rootform update dialect payments ./dialects/payments-next
rootform update dialect payments registry.example.com/acme/payments:0.2.0
rootform update policy-pack baseline
rootform update policy-pack baseline ./policies
rootform update policy-pack baseline registry.example.com/acme/baseline:1.1.0
```
