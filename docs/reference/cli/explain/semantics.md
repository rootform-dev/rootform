---
title: "rootform explain semantics"
description: "Trace how a source declaration was interpreted."
---

`explain semantics` uses the current project to show a matching Dialect Rule
and the architecture it produced. Pass a qualified definition identifier such
as `google.rule.cloud-sql-instance`, or an unambiguous bare name. This is a
semantic definition name, not a Terraform resource address; use
[`explain architecture`](architecture.md) for an address.

<!-- BEGIN GENERATED CLI: rootform explain semantics -->

## Usage

```text
rootform explain semantics <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain semantics |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

```sh
rootform explain semantics google.rule.cloud-sql-instance
rootform explain semantics google.rule.cloud-sql-instance --format json
```

Text or JSON goes to standard output, diagnostics to standard error. Status
`0` means explained, `1` means definition not found, `2` means incorrect
command use, and `3` means no explanation could be decided. See
[Dialects and RF Vocabulary](../../../concepts/dialects.md) for the meaning of
Rules and [Explore an architecture](../../../guides/explore-architecture.md)
for following their evidence.
