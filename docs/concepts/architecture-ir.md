---
title: "Architecture documents"
description: "Read Rootform snapshot, plan, and comparison documents and their evidence limits."
---

Rootform's format-1 JSON document records architecture and why it was established. A plan input produces `kind: "plan"`; a state input produces `kind: "snapshot"`. `rootform run before.json --diff after.json` produces `kind: "comparison"`, with both analysis documents embedded. The [public contract](../../contracts/architecture-ir.md) and [JSON Schema](../../schemas/architecture-ir.schema.json) define exact fields.

## Stages and facts

A plan's `planned` stage describes the proposed outcome. When the producer provides prior evidence, `refreshed` describes its prior snapshot and `recorded` reconstructs the state before reported drift. Reconstruction may be partial. A state export has one `recorded` stage. Each stage contains represented resource instances, interpretation, facts, closures, dependencies, and accounting.

A Dialect Rule assigns meaning to an instance. Its emissions can establish Contexts, Relations, and Contributions. Every active emission has a closure: `resolved`, `absent`, or `indeterminate`. A fact cites its Rule, emission, closure, and evidence kind (`value`, `traversal`, or `both`). An instance without a Rule remains represented; no architectural meaning is invented. Dependency evidence alone is not a Relation.

A saved document includes the selected semantic definitions needed to reopen it without compiling the producer input again. It excludes raw plan and state values, configuration source, and sensitive values. External endpoint identity follows its Dialect's disclosure tier.

## Comparisons and drift

Internal plan comparisons can show recorded-to-refreshed drift, refreshed-to-planned change, and recorded-to-planned net change. The drift report names producer-reported records and their architectural consequence. A comparison between separate inputs is `cross`, never drift. `undetermined` marks a missing proof of addition, removal, or no change.

```sh
rootform run plan.json --no-serve -o analysis.json
rootform run analysis.json --no-serve -o report.md
```

Validate a saved document before using it as an integration input. See [Comparison semantics](diff.md), [Outputs](../reference/outputs.md), and [Limitations](../limitations.md).
