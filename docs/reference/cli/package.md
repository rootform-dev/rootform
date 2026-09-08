---
title: "rootform package"
description: "Package Rootform content for distribution"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Package Rootform content for distribution.

## Usage

```text
rootform package <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform package |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Build deterministic local registry layouts from validated Rootform packages.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform package dialects `](package/dialects.md) | Build dialect packages and a discovery index |
| [` rootform package policy-packs `](package/policy-packs.md) | Build Policy Pack packages |

## Examples

```sh
rootform package dialects ./dialects --to ./artifacts/oci
rootform package policy-packs ./policies --to ./artifacts/policies
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
