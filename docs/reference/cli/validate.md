---
title: "rootform validate"
description: "Validate a saved Form or a Rootform definition."
---

Choose `form` to check a saved Form. Other
subcommands validate Dialect or Policy definitions and have their own
contracts. Validation checks structure and definitions; it does not evaluate
Policies or verify deployed cloud resources.

<!-- BEGIN GENERATED CLI: rootform validate -->

## Usage

```text
rootform validate <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform validate concept `](validate/concept.md) | Validate a Concept definition |
| [` rootform validate context `](validate/context.md) | Validate a context dimension |
| [` rootform validate dialects `](validate/dialects.md) | Validate Dialect definitions |
| [` rootform validate form `](validate/form.md) | Validate a saved Form |
| [` rootform validate policy `](validate/policy.md) | Validate a Policy definition |
| [` rootform validate relation `](validate/relation.md) | Validate a relation predicate |
| [` rootform validate rule `](validate/rule.md) | Validate a Rule definition |

<!-- END GENERATED CLI -->

Save a Form with `run --no-serve -o analysis.json`, as in
the [quickstart](../../getting-started/quickstart.md), then
validate its structure:

```sh
rootform validate form analysis.json
```

Validation reads the Form alone. To evaluate Policies, use
[`check`](check.md):

```sh
rootform check analysis.json --policy-pack ./policies
```
