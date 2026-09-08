---
title: "rootform vendor"
description: "Vendor resolved Rootform packages"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Vendor resolved Rootform packages.

## Usage

```text
rootform vendor <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Copy exact locked Rootform packages to project-local directories
for reproducible offline use.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform vendor dialects `](vendor/dialects.md) | Vendor resolved dialects |
| [` rootform vendor policy-packs `](vendor/policy-packs.md) | Vendor selected Policy Packs |

## Examples

```sh
rootform vendor dialects
rootform vendor policy-packs
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
