---
title: "Use a local Dialect while authoring"
description: "Analyze a plan with a Dialect source override without changing project selection."
---

Pass a local Dialect directory as a one-run override while you edit its Rules:

```sh
rootform run plan.json --dialect ./dialects/payments --no-serve -o architecture.json
```

The plan or state JSON remains the evidence. The Dialect decides how matching instances become Concepts and facts. Inspect closures and diagnostics, especially unknown values, `EMISSION_PATH_UNDEFINED`, duplicate identities, and evidence conflicts. A verified `--plan-file` can supply traversal evidence when values alone cannot identify an endpoint.

Use `rootform test` on planned fixtures and `rootform validate dialects` on the source before selecting the Dialect in `rootform.lock`. See [Write a Dialect](../dialect-authoring.md).
