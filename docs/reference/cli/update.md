---
title: "rootform update"
description: "Change a selection in rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Change a selection in rootform.lock.

## Usage

```text
rootform update <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform update |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Record new content for one selected Dialect or Policy Pack, or switch
it to another exact source.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | help was shown |
| `2` | the command was used incorrectly |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform update dialect `](update/dialect.md) | Change one selected Dialect |
| [` rootform update policy-pack `](update/policy-pack.md) | Change one selected Policy Pack |

## Examples

```sh
rootform update dialect payments
rootform update dialect payments ./dialects/payments-next
rootform update dialect payments \
  registry.example.com/acme/dialects:dialect-payments-0.2.0
rootform update policy-pack baseline
rootform update policy-pack baseline ./policies
rootform update policy-pack baseline \
  registry.example.com/acme/policies:policy-pack-baseline-0.2.0
```
