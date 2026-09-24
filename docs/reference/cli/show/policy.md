---
title: "rootform show policy"
description: "Inspect one Policy definition without evaluating it."
---

`show policy` displays a policy's target, assertion, message, owning Policy
Pack, and source location. It reads the project-selected pack by default.
Repeat `--policy-pack` with local authoring roots to overlay packs of the
same names for this invocation. Other selected packs remain active. Use a
qualified identifier such as
`tutorial.policy.subnet-network-context`, or a bare name when unambiguous.

<!-- BEGIN GENERATED CLI: rootform show policy -->

## Usage

```text
rootform show policy <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -o, --format ` | ` string ` | ` "" ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform show policy |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `dir`; repeatable |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

After creating `./policies` in [Run checks](../../../guides/check-architecture.md):

<!-- docs-check:cli-show-policy -->
```sh
rootform show policy subnet-network-context --policy-pack ./policies
rootform show policy tutorial.policy.subnet-network-context --policy-pack ./policies -o json
```

Text or JSON goes to standard output, diagnostics to standard error. Status
`0` means shown, `1` means definition not found, `2` means incorrect use,
and `3` means no single definition could be selected. This does not evaluate
the policy; use [`explain policy`](../explain/policy.md) for an evaluated result
or [Run checks](../../../guides/check-architecture.md) for a full report.
