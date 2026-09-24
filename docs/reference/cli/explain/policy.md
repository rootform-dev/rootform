---
title: "rootform explain policy"
description: "Explain an evaluated policy result."
---

`explain policy` evaluates the current project architecture and explains why
a selected policy passed, failed, or could not be evaluated for an element.
The owning Policy Pack must already be selected by the project. Use a
qualified identifier or a bare policy name only when unambiguous. This
command has no `--input` or `--policy-pack` override.

<!-- BEGIN GENERATED CLI: rootform explain policy -->

## Usage

```text
rootform explain policy <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use a dialect source `dir` for this run; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain policy |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From the [first architecture](../../../getting-started/first-architecture.md)
project, first [add the tutorial Policy Pack](../../../guides/external-content.md#add-local-content).
Then run from that project root:

<!-- docs-check:cli-explain-policy -->
```sh
rootform explain policy tutorial.policy.subnet-network-context
rootform explain policy tutorial.policy.subnet-network-context --format json
```

Text or JSON goes to standard output, diagnostics to standard error. Status
`0` means explained, `1` means definition not found, `2` means incorrect
command use, and `3` means no explanation could be decided. To inspect the
definition instead, use [`show policy`](../show/policy.md); for a complete
evaluation, see [Run checks](../../../guides/check-architecture.md).
