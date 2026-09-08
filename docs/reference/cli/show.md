---
title: "rootform show"
description: "Show a Rootform definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Show a Rootform definition.

## Usage

```text
rootform show <object> <name> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Show a dialect, Policy Pack, policy, rule, or concept by name.

Policy identifiers use "&lt;policy-pack&gt;/&lt;name&gt;"; semantic declaration
identifiers use "&lt;dialect&gt;/&lt;name&gt;". A bare declaration name is accepted
when it resolves unambiguously.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform show concept `](show/concept.md) | Show a concept definition |
| [` rootform show dialect `](show/dialect.md) | Show a dialect |
| [` rootform show policy `](show/policy.md) | Show a policy definition |
| [` rootform show policy-pack `](show/policy-pack.md) | Show a Policy Pack |
| [` rootform show rule `](show/rule.md) | Show a rule definition |

## Examples

```sh
rootform show dialect google
rootform show policy-pack baseline
rootform show policy baseline/database-private-connectivity
rootform show rule google/cloud-sql-instance
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
