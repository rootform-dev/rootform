---
title: "rootform explain"
description: "Justify an instance, Rule application, or recorded Policy outcome."
---

Use [`explain instance`](explain/instance.md) to trace one instance at a stage
of a Form. Use [`explain rule`](explain/rule.md) to trace how one Rule applied in
an input. Use [`explain policy`](explain/policy.md) to inspect an outcome already
recorded by `rootform check`. For definitions, use [`show`](show.md); for the
current selection, use [`list`](list.md).

<!-- BEGIN GENERATED CLI: rootform explain -->

## Usage

```text
rootform explain <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform explain instance `](explain/instance.md) | Explain how one instance was interpreted |
| [` rootform explain policy `](explain/policy.md) | Explain one Policy outcome recorded by check |
| [` rootform explain rule `](explain/rule.md) | Explain how one Rule applied in an input |

<!-- END GENERATED CLI -->

Instance and Rule explanations read inputs as `run` does. A Policy explanation
reads a saved Policy result and never evaluates the Policy again.
