---
title: "rootform uninstall"
description: "Delete installed versions from the Rootform home"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Delete installed versions from the Rootform home.

## Usage

```text
rootform uninstall <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform uninstall |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Delete exact installed versions of Dialects or Policy Packs from the
Rootform home. Projects are not read; a project that still selects a
deleted version gets it back through rootform init.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | help was shown |
| `2` | the command was used incorrectly |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform uninstall dialects `](uninstall/dialects.md) | Delete installed Dialect versions |
| [` rootform uninstall policy-packs `](uninstall/policy-packs.md) | Delete installed Policy Pack versions |

## Examples

```sh
rootform uninstall dialects payments@0.1.0
rootform uninstall policy-packs baseline@1.0.0
```
