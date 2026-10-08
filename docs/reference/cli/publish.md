---
title: "rootform publish"
description: "Publish packaged Rootform content"
---

<!-- Generated from contracts/reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Publish packaged Rootform content.

## Usage

```text
rootform publish <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform publish |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Behavior

Publish validated Rootform packages to a registry repository.

## Exit status

| Status | Description |
| --- | --- |
| `0` | help was shown |
| `2` | the command was used incorrectly |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform publish dialects `](publish/dialects.md) | Publish a verified Dialect registry layout |
| [` rootform publish policy-packs `](publish/policy-packs.md) | Publish a verified Policy Pack registry layout |

## Examples

```sh
rootform publish dialects ./oci --to registry.example.com/acme/dialects
rootform publish policy-packs ./oci --to registry.example.com/acme/policies
```
