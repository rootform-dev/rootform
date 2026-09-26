---
title: "Review a pull request"
description: "Review planned architecture, policy results, and producer-reported drift."
---

Plan the proposed revision with Terraform or OpenTofu, then analyze the exported JSON. Rootform reads the producer output and selected Dialects; it never evaluates configuration itself.

```sh
terraform init -input=false
terraform plan -input=false -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
rootform run plan.json --plan-file plan.tfplan --require-enrichment --no-serve -o analysis.json -o review.md
```

Review the `planned` stage, unresolved closures, and the plan's internal `planned`, `net`, and `drift` comparisons where prior state is available. Drift describes producer-reported outside changes between recorded and refreshed state. “No drift reported in this plan” includes a scope statement and does not prove absence of drift. A reconstructed recorded stage may be partial.

For two independently exported revisions, compare selected stages:

```sh
rootform run before.json --diff after.json --no-serve -o comparison.json -o comparison.md
```

This produces a cross-input comparison. It cannot identify which differences were outside changes. Review `undetermined` and comparison problems before treating an empty change list as no change. To gate the proposed architecture, pass a selected Policy Pack to `run` and inspect the exit status and evaluated target count.

See [Plan inputs](../inputs/plans.md), [Comparisons](../concepts/diff.md), and [CI integration](../integrations/ci/README.md).
