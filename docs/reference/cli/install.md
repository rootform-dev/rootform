---
title: "rootform install"
description: "Install registry content in the Rootform home"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Install registry content in the Rootform home.

## Usage

```text
rootform install <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform install |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Behavior

Download and verify dialects or Policy Packs into the Rootform home.
Installing makes content available on this machine; it selects
nothing for any project.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform install dialects `](install/dialects.md) | Install dialects from registry references |
| [` rootform install policy-packs `](install/policy-packs.md) | Install Policy Packs from registry references |

## Examples

```sh
rootform install dialects \
  registry.example.com/acme/dialects:dialect-payments-0.1.0
rootform install policy-packs \
  registry.example.com/acme/policies:policy-pack-baseline-0.1.0
```
