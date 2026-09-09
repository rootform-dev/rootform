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
rootform show policy baseline/private-database-reachability
rootform show rule google/cloud-sql-instance
```
