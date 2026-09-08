---
title: "rootform list"
description: "List Rootform definitions"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

List Rootform definitions.

## Usage

```text
rootform list <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

List loaded dialects, Policy Packs, policies, rules, or concepts.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform list concepts `](list/concepts.md) | List concepts |
| [` rootform list dialects `](list/dialects.md) | List resolved dialects |
| [` rootform list policies `](list/policies.md) | List policies |
| [` rootform list policy-packs `](list/policy-packs.md) | List Policy Packs |
| [` rootform list rules `](list/rules.md) | List rules |

## Examples

```sh
rootform list dialects
rootform list policy-packs
rootform list policies
rootform list rules --dialect google
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
