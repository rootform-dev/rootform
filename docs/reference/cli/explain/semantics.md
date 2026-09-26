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
| ` --dialect ` | ` stringArray ` | ` [] ` | use dialect source `dir`; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain semantics |
| ` --input ` | ` string ` | ` "" ` | read `path`: a plan, state or Rootform document, or `-` |
| ` --stage ` | ` string ` | ` "" ` | explain the `stage`: planned, refreshed or recorded |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From the [first architecture](../../../getting-started/first-architecture.md)
project, where `aws_subnet.application` is present:

<!-- docs-check:cli-explain-semantics -->
```sh
rootform explain semantics aws.rule.subnet
rootform explain semantics aws.rule.subnet --format json
```

Text or JSON goes to standard output, diagnostics to standard error. Status
`0` means explained, `1` means definition not found, `2` means incorrect
command use, and `3` means no explanation could be decided. See
[Dialects and RF Vocabulary](../../../concepts/dialects.md) for the meaning of
Rules and [Explore an architecture](../../../guides/explore-architecture.md)
for following their evidence.
