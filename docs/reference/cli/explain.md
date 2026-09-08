---
title: "rootform explain"
description: "Explain an architecture result"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Explain an architecture result.

## Usage

```text
rootform explain <object> <name> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Explain how an architecture element was derived, how a source
declaration was interpreted, or why a policy produced a result.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform explain architecture `](explain/architecture.md) | Explain an architecture element |
| [` rootform explain policy `](explain/policy.md) | Explain a policy result |
| [` rootform explain semantics `](explain/semantics.md) | Explain a semantic interpretation |

## Examples

```sh
rootform explain architecture google_sql_database_instance.main
rootform explain semantics google/cloud-sql-instance
rootform explain policy baseline/database-private-connectivity
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
