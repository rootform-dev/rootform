---
title: Choose an input
description: Choose plan, state, or saved architecture evidence for the question at hand.
---

Choose the plan, state, or saved document that contains the evidence your question needs.
`rootform run` detects input by content, not filename. Rootform reads local
files and never runs Terraform or OpenTofu, contacts providers, or refreshes
infrastructure.

| Question | Input | What it establishes |
| --- | --- | --- |
| What would this operation create or change? | Plan JSON, preferably paired with its saved plan | Planned instances; available earlier stages, drift records, and comparisons |
| What does this plan show without its saved plan? | Plan JSON alone | Evaluated values and dependencies, with unknown identity traversals left unresolved |
| What is recorded in state? | State JSON | One Recorded Form, without plan changes, refresh evidence, or configuration traversals |
| Can I reopen a prior analysis? | Saved Rootform document | The validated document, including its original stage evidence, without reanalyzing plan or state JSON |
| Can I compare two points in time? | Two accepted inputs with `--diff` | An architectural comparison; it is not a drift report |
| Can I stream an export? | `-` on standard input | The same content-based detection; at most one comparison operand may read the stream |

## Choose a plan for change evidence

Export a completed saved plan with `terraform show -json plan.tfplan > plan.json`.
OpenTofu users run the same command with `tofu`. A verified
`--plan-file plan.tfplan` can establish direct identity traversals that the
JSON export does not preserve. A plan may contain `planned`, `refreshed`, and
`recorded` stages, depending on what the plan contains. Rootform shows
Reported drift separately from Planned changes. See
[Terraform and OpenTofu plans](plans.md) for production, verification, and
completeness.

## Choose state for a Recorded Form

When the working directory already has state, export it with
`terraform show -json > state.json`. State JSON contains instances and
sensitivity masks, but no configuration expressions or before and after plan
values. It cannot prove that no drift occurred. A raw `terraform.tfstate` file
is a different shape and is not accepted.

A working directory without state, such as a new example, exports only a
format version. Rootform refuses that file with status `3`, says that it
records no state, and suggests the plan commands instead.

## Reuse or compare documents

A Rootform document is reusable input. The same `run` command can
open it without the plan, save a report, or compare it with a later input.
An input comparison orders the first input as Before and the `--diff`
input as After. A fact that cannot be settled on both sides stays
[indeterminate](../concepts/comparisons.md#indeterminate-preserves-uncertainty); it
never counts as no change. If an operand is itself a comparison document, use
`--before-side` or `--after-side` to identify the side to compare.

<!-- docs-check:journey-inputs-reuse -->
```sh
rootform run analysis.json --no-serve -o report.md
```

The file is a readable report of the saved architecture. It does not rerun
Terraform or OpenTofu or add evidence missing from that document.

A configuration directory is not an analysis input: it is a project location.
`--project` selects its Dialects and policies; it does not supply infrastructure
evidence. A binary saved plan alone is also not an input: export its JSON first,
then optionally pair the two files. Rootform refuses malformed JSON, plan event
streams from `plan -json`, and unrecognized documents rather than inferring a
partial architecture.

> [!WARNING]
> Saved plans, plan JSON, and state JSON may contain secrets in clear text.
> Keep them out of Git and public artifacts. Rootform outputs omit sensitive
> values but still reveal names and topology; review access before sharing.

To produce the export and verify its saved plan, continue with
[Terraform and OpenTofu plans](plans.md). For a pull request with two planned
revisions, go on to [Review a pull request](../workflows/index.md).
