---
title: "Test and validate"
description: "Compile Dialects and Policy Packs, run planned fixtures, and evaluate policies."
---

Use `rootform validate dialects` to check a Dialect source and `rootform test` to compare its planned fixtures with reviewed analysis results. A fixture should include a Terraform or OpenTofu `plan.json` export and, when traversal evidence matters, the saved `plan.tfplan` that produced it.

```sh
rootform validate dialects ./dialects/payments
rootform test ./dialects/payments/fixtures
```

A test fixture proves the selected Dialect's interpretation of that producer evidence. Unknown and sensitive values remain unresolved. An emission must declare null and empty handling; target matching must use declared identity attributes. Inspect diagnostics and closure outcomes when an expected fact is missing.

For a Policy Pack, compile source and evaluate it against an actual plan or saved Rootform document:

```sh
rootform run plan.json --policy-pack ./policies --no-serve -o results.sarif
```

A pass requires selected and evaluated policies. Zero evaluations or indeterminate evidence is not compliance. See [Evaluation](reference/evaluation.md), [Diagnostics](reference/diagnostics.md), and [Run checks](../guides/check-architecture.md).
