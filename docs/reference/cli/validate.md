---
title: "rootform validate"
description: "Validate a Rootform object"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Validate a Rootform object.

## Usage

```text
rootform validate <object> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform validate |

## Behavior

Validate an architecture or Rootform definition and report any problems
found.

Validation checks definitions; it does not evaluate policies. Use
"rootform check" for that.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform validate architecture `](validate/architecture.md) | Validate an architecture |
| [` rootform validate concept `](validate/concept.md) | Validate a concept definition |
| [` rootform validate context `](validate/context.md) | Validate a context dimension |
| [` rootform validate dialects `](validate/dialects.md) | Validate dialect definitions |
| [` rootform validate policy `](validate/policy.md) | Validate a policy definition |
| [` rootform validate relation `](validate/relation.md) | Validate a relation predicate |
| [` rootform validate rule `](validate/rule.md) | Validate a rule definition |

## Examples

```sh
rootform validate architecture ./infra
rootform validate dialects ./dialects
rootform validate rule google/cloud-sql-instance
```
