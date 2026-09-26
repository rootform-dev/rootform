---
title: "rootform explain policy"
description: "Explain an evaluated policy result."
---

`explain policy` evaluates the plan, state, or saved Rootform document named
by the required `--input` and explains why a policy passed, failed, or could
not be evaluated for an element. The owning Policy Pack comes from the project
selection or from a one-run `--policy-pack` override. Use a qualified
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
| ` --input ` | ` string ` | ` "" ` | read `path`: a plan, state or Rootform document, or `-` |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `dir`; repeatable |
| ` --stage ` | ` string ` | ` "" ` | explain the `stage`: planned, refreshed or recorded |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From a checkout of the repository, save the reviewed commerce plan, then
explain the baseline cluster Policy against that document. The local Pack
override chooses the same source for this command without changing the lock.

<!-- docs-check:cli-explain-policy -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform explain policy baseline.policy.cluster-network-context \
  --input analysis.json --policy-pack policy-packs/baseline --color always
rootform explain policy baseline.policy.cluster-network-context \
  --input analysis.json --policy-pack policy-packs/baseline --format json
```

<!-- docs-output:cli-explain-policy -->
```ansi title="Policy explanation, excerpt"
[1m[32mbaseline.policy.cluster-network-context: passed[0m
[2mStage[0m     planned
[2mTargets[0m   1: 1 passed, 0 violated, 0 indeterminate

[1m[38;5;208mEvaluations[0m
  [32mpassed[0m azurerm_kubernetes_cluster.prod
```

The policy passed for its one selected target. If the result is indeterminate,
inspect the instance closures before treating it as a gate. Text or JSON goes
to standard output, diagnostics to standard error. Status
`0` means explained, `1` means definition not found, `2` means incorrect
command use, and `3` means no explanation could be decided. To inspect the
definition instead, use [`show policy`](../show/policy.md); for a complete
evaluation, see [Run checks](../../../guides/check-architecture.md).
