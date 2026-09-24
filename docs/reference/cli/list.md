---
title: "rootform list"
description: "See Dialects, Policy Packs, and policies accessible to a project."
---

`list` reports active Dialects, selected Policy Packs, or their declared
Policies. `list dialects <name>...` filters by positional owner names;
`--dialect` supplies a source directory for this run. `list dialects
--installed` and `list policy-packs --installed` inspect the Rootform home
without reading a project. It is not a remote catalog search. Use
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

<!-- docs-check:cli-list-selection -->
```sh
rootform list dialects aws -o wide
rootform list policy-packs
rootform list policies
rootform list dialects --installed -o wide
rootform list policy-packs --installed -o wide
```

See [Install, add, and vendor](../../concepts/external-content.md) for
the difference between installed, selected, and active content.
