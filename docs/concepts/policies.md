---
title: "Policies and Policy Packs"
description: "Understand selection, evaluation, and evidence limits of Rootform policies."
---

A Policy Pack contains named assertions over the architecture produced by selected Dialects. Selecting a Dialect does not select a Policy Pack. `rootform run` evaluates selected policies on its chosen stage when a Pack or policy selection is supplied.

```sh
rootform run plan.json --policy-pack ./policies --no-serve -o report.sarif
```

Each evaluated assertion is a pass, violation, or indeterminate result. Unknown or sensitive facts cannot prove an assertion true or false. A negative assertion requires a complete relevant population before absence is a pass. Zero selected policies or zero evaluations is no compliance decision and can produce exit status `3`. A confirmed violation produces status `1`; status `0` requires every selected policy to pass. See [Run checks](../guides/check-architecture.md) and [Evaluation](../language/reference/evaluation.md).
