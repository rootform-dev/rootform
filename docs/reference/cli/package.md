---
title: "rootform package"
description: "Package Rootform content for distribution"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Package Rootform content for distribution.

## Usage

```text
rootform package <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform package |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Build deterministic local registry layouts from validated Rootform packages.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | help was shown |
| `2` | the command was used incorrectly |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform package dialects `](package/dialects.md) | Build Dialect packages |
| [` rootform package policy-packs `](package/policy-packs.md) | Build Policy Pack packages |

## Examples

```sh
rootform package dialects ./dialects --to ./artifacts/dialects
rootform package policy-packs ./policies --to ./artifacts/policies
```
