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

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

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
| [` rootform validate dialects `](validate/dialects.md) | Validate dialect definitions |
| [` rootform validate policy `](validate/policy.md) | Validate a policy definition |
| [` rootform validate rule `](validate/rule.md) | Validate a rule definition |

## Examples

```sh
rootform validate architecture ./infra
rootform validate dialects ./dialects
rootform validate rule google/cloud-sql-instance
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
