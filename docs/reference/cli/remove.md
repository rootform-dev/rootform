---
title: "rootform remove"
description: "Remove content from rootform.lock"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Remove content from rootform.lock.

## Usage

```text
rootform remove <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform remove |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Drop selected dialects or Policy Packs from this project, or exclude an
embedded dialect.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform remove dialects `](remove/dialects.md) | Remove dialects from rootform.lock |
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
