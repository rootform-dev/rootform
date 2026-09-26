---
title: "Architecture comparisons"
description: "Interpret cross-input and within-plan changes without confusing them with drift."
---

`rootform run before.json --diff after.json` selects a stage from each input and creates one format-1 `comparison` document. This cross-input comparison is never drift. Inputs can be plan JSON, state JSON, or saved Rootform documents. Use `--before-stage` and `--after-stage` when a plan has multiple stages and its default is not the intended side.

```sh
rootform run before.json --diff after.json --no-serve -o comparison.json
rootform run before.json --diff after.json --no-serve -o comparison.md
```

A comparable result reports representation and fact changes and any undetermined entries. A fact can be declared added or removed only when relevant closures prove absence on the other side. An unknown value, sensitive identity, unavailable target, or incompatible semantic selection can leave the change undetermined. No changes under the selected Dialects is a narrower statement than no infrastructure changes.

A plan with prior state can also contain `drift` (recorded to refreshed), `planned` (refreshed to planned), and `net` (recorded to planned). Drift is a producer-reported outside change between recorded and refreshed state. Two separate inputs do not establish that cause. See [Plan inputs](../inputs/plans.md) and the [comparison contract](../../contracts/architecture-diff.md).
