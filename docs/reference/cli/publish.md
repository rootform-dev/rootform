---
title: "rootform publish"
description: "Publish packaged Rootform content"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Publish packaged Rootform content.

## Usage

```text
rootform publish <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform publish |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Publish validated Rootform packages to a registry repository.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform publish dialects `](publish/dialects.md) | Publish a verified dialect registry layout |
| [` rootform publish policy-packs `](publish/policy-packs.md) | Publish a verified Policy Pack registry layout |

## Examples

```sh
rootform publish dialects ./oci --to r.example/acme/dialects
rootform publish policy-packs ./oci --to r.example/acme/policies
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
