---
title: "rootform install"
description: "Install registry content in the Rootform home"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Install registry content in the Rootform home.

## Usage

```text
rootform install <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform install |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Behavior

Download and verify Dialects or Policy Packs into the Rootform home.
Installing makes content available on this machine; it selects
nothing for any project.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | help was shown |
| `2` | the command was used incorrectly |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform install dialects `](install/dialects.md) | Install Dialects from registry references |
| [` rootform install policy-packs `](install/policy-packs.md) | Install Policy Packs from registry references |

## Examples

```sh
rootform install dialects \
  registry.example.com/acme/dialects:dialect-payments-0.1.0
rootform install policy-packs \
  registry.example.com/acme/policies:policy-pack-baseline-0.1.0
```
