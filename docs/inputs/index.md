---
title: "Choose an input"
description: "Select a Terraform or OpenTofu plan, state export, or saved Rootform document."
---

`rootform run` reads one input by content. It accepts plan JSON, state JSON, a saved format-1 Rootform document, or `-` for standard input. A configuration directory is not an analysis input. Rootform reads the export and applies the project's Dialects; it does not run Terraform or OpenTofu.

| Input | Produce or obtain it | Architecture evidence |
| --- | --- | --- |
| Plan JSON | `terraform plan -out=plan.tfplan` then `terraform show -json plan.tfplan > plan.json` | Proposed `planned` stage; available prior stages and comparisons. |
| State JSON | `terraform show -json > state.json` | One `recorded` snapshot stage. |
| Rootform JSON document | `rootform run plan.json --no-serve -o analysis.json` | Reopens validated architecture without analyzing the producer export again. |

Use `tofu` in place of `terraform` for OpenTofu. Keep plan and state files protected: they can contain sensitive values even when Rootform's output omits them. See [Plans](plans.md) for stage and drift interpretation.

```sh
rootform run plan.json
rootform run state.json --no-serve -o snapshot.json
rootform run analysis.json --no-serve -o report.md
rootform run before.json --diff after.json --no-serve -o comparison.json
```

Without `--no-serve`, the command opens a loopback browser view. The `--diff` result is a cross-input comparison, not a drift report. Select specific stages with `--before-stage` and `--after-stage` when the defaults are not the evidence you intend to compare.
