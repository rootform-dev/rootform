---
title: "Terraform and OpenTofu plans"
description: "Export a plan, verify an optional saved plan, and interpret stages, comparisons, and drift."
---

Save a plan and export its JSON from the same file:

```sh
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
rootform run plan.json --plan-file plan.tfplan --no-serve -o analysis.json
```

For OpenTofu, use `tofu` in both producer commands. Rootform never starts either producer. `--plan-file` checks that the saved plan and JSON export pair. A verified pair supplies configuration snapshot traversals for identity evidence. `--require-enrichment` refuses the run if verification fails. Without a saved plan, value evidence can still resolve facts; unknown or shared values may leave a closure indeterminate.

A plan document has a `planned` stage. If the producer supplied prior state, it can also have `refreshed` and a reconstructed, possibly partial `recorded` stage. Internal comparisons are `planned` (refreshed to planned), `drift` (recorded to refreshed), and `net` (recorded to planned). A plan's drift report describes producer-reported changes made outside Terraform or OpenTofu between recorded and refreshed state. “No drift reported in this plan” describes the reported scope, not proof that no drift happened. Data sources and deposed instances are outside that drift coverage.

```sh
rootform run plan.json --stage planned --no-serve -o planned.md
rootform run plan.json --no-serve -o analysis.json -o report.sarif
terraform show -json plan.tfplan | rootform run - --no-serve -o analysis.json
```

The same `run` can evaluate selected policies with `--policy-pack` or `--policy`. A policy pass requires an actual selected and evaluated policy; missing evidence stays indeterminate. See [Outputs and exit status](../reference/outputs.md).

Treat `plan.json` and `plan.tfplan` as sensitive producer artifacts. Restrict access and retention according to the project policy. Rootform's output masks sensitive values, but the producer exports do not.
