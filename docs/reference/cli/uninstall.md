---
title: "rootform uninstall"
description: "Delete installed versions from the Rootform home"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Delete installed versions from the Rootform home.

## Usage

```text
rootform uninstall <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform uninstall |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Delete exact installed versions of dialects or Policy Packs from the
Rootform home. Projects are not read; a project that still selects a
deleted version gets it back through rootform init.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform uninstall dialects `](uninstall/dialects.md) | Delete installed dialect versions |
| [` rootform uninstall policy-packs `](uninstall/policy-packs.md) | Delete installed Policy Pack versions |

## Examples

```sh
rootform uninstall dialects payments@0.1.0
rootform uninstall policy-packs baseline@1.0.0
```
