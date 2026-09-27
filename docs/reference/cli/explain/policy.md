---
title: "rootform explain policy"
description: "Explain an evaluated policy result."
---

`explain policy` evaluates the plan, state, or saved Form named
by the required `--input` and explains why a policy passed, failed, or could
not be evaluated for an element. The owning Policy Pack comes from the project
selection or from a `--policy-pack` override for one command. Use a qualified
identifier or a bare policy name only when unambiguous.

<!-- BEGIN GENERATED CLI: rootform explain policy -->

## Usage

```text
rootform explain policy <identifier> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use dialect source `dir`; repeatable |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain policy |
| ` --input ` | ` string ` | ` "" ` | read `path`: a plan, state or saved Form, or `-` |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `dir`; repeatable |
| ` --stage ` | ` string ` | ` "" ` | explain the `stage`: planned, refreshed or recorded |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From a checkout of the repository, save the reviewed commerce plan, then
explain the baseline cluster Policy against that Form. The local Pack
override chooses the same source for this command without changing the lock.

<!-- docs-check:cli-explain-policy -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform check analysis.json --policy-pack policy-packs/baseline --color always
rootform explain policy baseline.policy.cluster-network-context \
  --input analysis.json --policy-pack policy-packs/baseline --color always
rootform explain policy baseline.policy.cluster-network-context \
  --input analysis.json --policy-pack policy-packs/baseline --format json
```

<!-- docs-output:cli-explain-policy -->
```text title="Policy check and explanation, excerpt"
Policies passed
Policies      2 policies selected: 2 passed
Evaluations   2 instances: 2 passed
baseline.policy.cluster-network-context: passed
Stage     planned
Targets   1: 1 passed, 0 violated, 0 indeterminate
Coverage  complete

Evaluations
  passed azurerm_kubernetes_cluster.prod
```

The policy passed for its one selected target. `rootform check` is the Policy
gate; if its result is indeterminate, inspect the instance closures. Text or JSON goes
to standard output, diagnostics to standard error. Status
`0` means explained, `1` means definition not found, `2` means incorrect
command use, and `3` means no explanation could be decided. To inspect the
definition instead, use [`show policy`](../show/policy.md); for a complete
evaluation, see [Check an architecture](../../../guides/check-architecture.md)
and the [`check` CLI reference](../check.md).
