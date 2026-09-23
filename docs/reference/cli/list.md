---
title: "rootform list"
description: "See Dialects, Policy Packs, and policies accessible to a project."
---

`list` reports effective local content: loaded Dialects, selected Policy
Packs, or their declared policies. It is not a remote catalog search. Use
[`show`](show.md) to inspect one definition and [`explain`](explain.md) to
trace a result.

<!-- BEGIN GENERATED CLI: rootform list -->

## Usage

```text
rootform list <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform list dialects `](list/dialects.md) | List the dialect catalog |
| [` rootform list policies `](list/policies.md) | List policies |
| [` rootform list policy-packs `](list/policy-packs.md) | List Policy Packs |

<!-- END GENERATED CLI -->

```sh
rootform list dialects -o wide
rootform list policy-packs
rootform list policies
```

See [Select Dialects and Policy Packs](../../cli.md) for what the project
loads by default.
