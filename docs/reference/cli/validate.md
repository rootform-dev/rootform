---
title: "rootform validate"
description: "Validate an architecture or Rootform definition."
---

Choose `architecture` to check a built or saved architecture. Other
subcommands validate Dialect or Policy definitions and have their own
contracts. Validation checks structure and definitions; it does not evaluate
Policies or verify deployed cloud resources.

<!-- BEGIN GENERATED CLI: rootform validate -->

## Usage

```text
rootform validate <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform validate architecture `](validate/architecture.md) | Validate a saved Rootform document |
| [` rootform validate concept `](validate/concept.md) | Validate a concept definition |
| [` rootform validate context `](validate/context.md) | Validate a context dimension |
| [` rootform validate dialects `](validate/dialects.md) | Validate dialect definitions |
| [` rootform validate policy `](validate/policy.md) | Validate a policy definition |
| [` rootform validate relation `](validate/relation.md) | Validate a relation predicate |
| [` rootform validate rule `](validate/rule.md) | Validate a rule definition |

<!-- END GENERATED CLI -->

Save `architecture.json` with `run`, for example from
[Your first architecture](../../getting-started/first-architecture.md).

```sh
rootform validate architecture architecture.json
```

For governance use [`run`](run.md). For a complete architecture workflow,
see [Your first architecture](../../getting-started/first-architecture.md).
