---
title: "rootform add"
description: "Add content to rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Add content to rootform.lock.

## Usage

```text
rootform add <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform add |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Select Dialects or Policy Packs for this project. rootform add, remove,
and update are the only commands that write rootform.lock.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | help was shown |
| `2` | the command was used incorrectly |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform add dialects `](add/dialects.md) | Add Dialects to rootform.lock |
| [` rootform add policy-packs `](add/policy-packs.md) | Add Policy Packs to rootform.lock |

## Examples

```sh
rootform add dialects ./dialects/payments
rootform add dialects \
  registry.example.com/acme/dialects:dialect-payments-0.1.0
rootform add dialects ./dialects/aws --replace
rootform add policy-packs ./policies
rootform add policy-packs \
  registry.example.com/acme/policies:policy-pack-baseline-0.1.0
rootform add policy-packs ./policies --dry-run
```
