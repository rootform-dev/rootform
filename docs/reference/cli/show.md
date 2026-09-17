---
title: "rootform show"
description: "Show a Rootform definition"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Show a Rootform definition.

## Usage

```text
rootform show <name> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show |

## Behavior

Show one dialect, the rf vocabulary, or one declaration they
make.

A bare owner name such as google or rf shows that owner and every
declaration it makes. A qualified &lt;owner&gt;.&lt;kind&gt;.&lt;name&gt; shows one
declaration, where kind is concept, context, relation, or rule. A
bare declaration name is accepted when it resolves unambiguously.

The text or JSON definition goes to standard output. Diagnostics go
to standard error.

## Exit status

```text
0  the definition was shown
1  the named definition was not found
2  the command was used incorrectly
3  no single definition could be selected
```

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform show policy `](show/policy.md) | Show a policy definition |
| [` rootform show policy-pack `](show/policy-pack.md) | Show a Policy Pack |

## Examples

```sh
rootform show google
rootform show google.rule.cloud-sql-instance
rootform show google.relation.runs-as
rootform show rf.concept.virtual-network
rootform show google -o json
```
