---
title: "Run checks"
description: "Evaluate selected policies against a plan or state architecture."
---

Prepare a plan export and select a Policy Pack. A pack is not selected by adding a Dialect.

```sh
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
rootform run plan.json --plan-file plan.tfplan --policy-pack ./policies --no-serve -o results.sarif
```

`run` analyzes the input once and evaluates policies on the selected stage. Use `--stage recorded`, `refreshed`, or `planned` to choose a stage the input contains. A state export has only `recorded`. A selected policy can pass, violate, or remain indeterminate. No policy selection or no evaluations is no decision.

| Exit | Meaning |
| --- | --- |
| `0` | Analysis succeeded and every selected policy passed. |
| `1` | A selected policy was violated. |
| `2` | Command usage was invalid. |
| `3` | Input was refused or a selected policy was indeterminate or decided nothing. |
| `4` | Export or server failed. |

SARIF includes explicit evaluation results and diagnostics. A warning about unknown, sensitive, or unavailable evidence does not authorize a pass. See [Policies](../concepts/policies.md) and [Outputs](../reference/outputs.md).
