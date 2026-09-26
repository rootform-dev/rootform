---
title: "Compare architectures"
description: "Compare selected stages from two plan, state, or saved Rootform documents."
---

Export each producer input separately, then compare the stages relevant to the review. A plan's default is `planned`; a state snapshot's only stage is `recorded`.

```sh
terraform show -json before.tfplan > before.json
terraform show -json after.tfplan > after.json
rootform run before.json --diff after.json --no-serve -o comparison.json -o comparison.md
```

The JSON result has `kind: "comparison"`; its `cross` comparison embeds both sides and names selected stages. If a plan has a prior state and you intend to compare recorded states, add `--before-stage recorded --after-stage recorded`. Rootform refuses an unavailable stage rather than treating it as empty.

Review `comparable`, `problems`, fact and representation changes, and `undetermined`. A cross-input difference can include changes made outside Terraform or OpenTofu between the exports, but the two inputs cannot establish drift causation. For drift, inspect one plan's recorded and refreshed stages. See [Architecture comparisons](../concepts/diff.md).
