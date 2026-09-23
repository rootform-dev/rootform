---
title: "rootform explain policy"
description: "Explain an evaluated policy result."
---

`explain policy` evaluates the current project architecture and explains why
a selected policy passed, failed, or could not be evaluated for an element.
The owning Policy Pack must already be selected by the project. Use a
qualified identifier such as `baseline.policy.cluster-network-context`, or a
bare policy name only when unambiguous. This command has no `--input` or
`--policy-pack` override.

<!-- BEGIN GENERATED CLI: rootform explain policy -->

## Usage

```text
rootform explain policy <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain policy |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

```sh
rootform explain policy baseline.policy.cluster-network-context
rootform explain policy baseline.policy.cluster-network-context --format json
```

Text or JSON goes to standard output, diagnostics to standard error. Status
`0` means explained, `1` means definition not found, `2` means incorrect
command use, and `3` means no explanation could be decided. To inspect the
definition instead, use [`show policy`](../show/policy.md); for a complete
evaluation, see [Run checks](../../../guides/check-architecture.md).
