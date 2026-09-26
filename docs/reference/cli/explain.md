---
title: "rootform explain"
description: "Trace an architecture element, semantic interpretation, or policy result."
---

Use `explain architecture` for evidence behind an architecture address,
`explain semantics` for a source declaration's interpretation, or `explain
policy` for an evaluated policy result. To inspect a definition without
tracing a result, use [`show`](show.md); to see the current selection, use
[`list`](list.md).

<!-- BEGIN GENERATED CLI: rootform explain -->

## Usage

```text
rootform explain <object> <name> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform explain architecture `](explain/architecture.md) | Explain an instance |
| [` rootform explain policy `](explain/policy.md) | Explain a policy result |
| [` rootform explain semantics `](explain/semantics.md) | Explain a rule |

<!-- END GENERATED CLI -->

Each subcommand has its own accepted input and options. See
[Explore an architecture](../../guides/explore-architecture.md) for following
evidence in the local interface.
