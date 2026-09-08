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
