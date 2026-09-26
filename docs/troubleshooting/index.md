---
title: "Troubleshooting"
description: "Resolve refused inputs, unverified plans, unresolved architecture, and policy outcomes."
---

## Input refused

`rootform run` accepts plan JSON, state JSON, saved format-1 Rootform documents, or `-` for standard input. A configuration directory or binary plan file is not an analysis input. Export a saved plan with `terraform show -json plan.tfplan > plan.json`, then run `rootform run plan.json`. An errored producer plan is refused rather than treated as an empty architecture.

## Saved plan did not verify

`--plan-file` must name the saved plan used to make that exact JSON export. If the pair fails verification, Rootform reports enrichment as refused and continues with plan-only evidence unless `--require-enrichment` was set. Re-export JSON from the saved plan and retry. Do not assume an unrelated saved plan provides traversal evidence.

## An expected relation is missing

Inspect the relevant instance's Rule, emission, closure outcome, reason, and diagnostics in the saved document or Explorer. `EMISSION_PATH_UNDEFINED` means the Dialect path is not defined on that instance type. `VIA_VALUE_SHAPE` means the value shape cannot be read as endpoint evidence. `DUPLICATE_IDENTITY` means several eligible candidates share the matched identity. `EVIDENCE_CONFLICT` means value and traversal point to different endpoints. Unknown, sensitive, transformed, or unavailable evidence stays unresolved.

A raw dependency does not create an architectural Relation. The Dialect must emit that meaning. For a target outside the inventory, `external = "allow"` must be declared and no eligible in-scope candidate may remain unresolved.

## A policy did not pass

Confirm a Policy Pack was selected and the expected policy and target counts are nonzero. A violation exits `1`; an indeterminate or unevaluated selection can exit `3`. Unknown and sensitive facts cannot prove a negative assertion. Export SARIF for diagnostics and explicit evaluation results:

```sh
rootform run plan.json --policy-pack ./policies --no-serve -o results.sarif
```

## Comparison appears empty

Check selected stages, `comparable`, `problems`, and `undetermined` entries. A plan's default stage is planned; a state snapshot has only recorded. `run --diff` compares separate inputs and is not a drift report. A no-change result covers only the selected Dialects and evidence scope.

See [Diagnostics](../language/reference/diagnostics.md), [Limitations](../limitations.md), and [Outputs](../reference/outputs.md).
