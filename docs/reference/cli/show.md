---
title: "rootform show"
description: "Inspect one Dialect or RF Vocabulary definition."
---

`show` displays a loaded Dialect, the RF Vocabulary, or one declaration.
A bare owner such as `google` shows that owner and its declarations. Use a
qualified `owner.kind.name` such as `google.rule.cloud-sql-instance` for one
declaration; a bare declaration name works only when unambiguous. These are
definition identifiers, not Terraform resource addresses.

<!-- BEGIN GENERATED CLI: rootform show -->

## Usage

```text
rootform show <name> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform show policy `](show/policy.md) | Show a policy definition |
| [` rootform show policy-pack `](show/policy-pack.md) | Show a Policy Pack |

<!-- END GENERATED CLI -->

```sh
rootform show google.rule.cloud-sql-instance
rootform show rf.concept.virtual-network -o json
```

Text or JSON goes to standard output, diagnostics to standard error. Status
`0` means shown, `1` means definition not found, `2` means incorrect use,
and `3` means no single definition could be selected. Use
[`list dialects`](list/dialects.md) to see available owners or
[`explain semantics`](explain/semantics.md) to trace an interpretation.
