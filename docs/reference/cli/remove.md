---
title: "rootform remove"
description: "Remove content from rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Remove content from rootform.lock.

## Usage

```text
rootform remove <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform remove |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Drop selected Dialects or Policy Packs from this project, or exclude an
embedded Dialect.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | help was shown |
| `2` | the command was used incorrectly |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform remove dialects `](remove/dialects.md) | Remove Dialects from rootform.lock |
| [` rootform remove policy-packs `](remove/policy-packs.md) | Remove Policy Packs from rootform.lock |

## Examples

```sh
rootform remove dialects payments
rootform remove dialects payments billing --dry-run
rootform remove dialects aws --embedded
rootform remove policy-packs baseline
rootform remove policy-packs baseline audit
rootform remove policy-packs baseline --format json
```
