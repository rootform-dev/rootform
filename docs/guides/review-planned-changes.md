---
title: Review planned changes
description: Read what one plan proposes, what drift it reports, and what changes remain once both are combined.
---

One plan answers three questions, and Rootform keeps them apart: what the plan
proposes, what drift it reports, and what remains once the two combine. You
read all three in the summary, the Markdown report, or the Explorer.

The examples use the commerce platform plan from the
[quickstart](../getting-started/quickstart.md); your own `plan.json` and
`plan.tfplan` work the same way.

## Read the three views

Analyze the plan without serving the Explorer to read the summary in the
terminal:

<!-- docs-check:review-changes-summary -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve
```

```ansi title="Plan summary, excerpt"
[1m[38;5;208mPlanned changes[0m
  Refreshed -> Planned
  [2mInstances[0m               153 added
[1m[38;5;208mReported drift[0m
  No drift reported in this plan.
[1m[38;5;208mNet change[0m
  Same determined changes as Planned changes.
```

| Heading | Compares | Question it answers |
| --- | --- | --- |
| **Planned changes** | Refreshed to Planned | What does this plan propose to change? |
| **Reported drift** | Recorded to Refreshed | What changed outside Terraform, according to the plan's drift records? |
| **Net change** | Recorded to Planned | What remains once drift the plan reverts cancels out? |

This sample plan starts from an empty state, so every instance is added, no
drift is reported, and **Net change** repeats **Planned changes**. A plan made
against existing state lists drift records under **Reported drift** with their
architectural consequence, and **Net change** shows a cancelled entry for each
fact drift removed and the plan restores.
[See drift cancel in the net change](../concepts/comparisons.md#see-drift-cancel-in-the-net-change)
walks through such a plan.

"No drift reported in this plan" means the export contains no drift record, not
that infrastructure is unchanged: the plan may have run with `-refresh=false`
or a narrowed scope, and the export does not record how far refresh went. The
summary says "The export does not establish the refresh scope" for that reason.

## Read the change list

The terminal lists added and removed resource instances and changed
Relations, Contexts and Contributions, using a pager for a long report.
`--details` adds depth to each entry. Markdown shows a bounded preview
unless you request `--details`; folded lists alone do not make it exhaustive. **Indeterminate closures** are counted separately: a fact whose
evidence cannot settle on one side is neither added nor removed, and never
counts as unchanged.

For a pull request, write the same content as a Markdown report:

<!-- docs-check:review-changes-report -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve -o review.md
```

The report leads with the totals, keeps the three headings, and folds long
lists so a reviewer sees the shape first.
[Review with Markdown](../reference/outputs.md#review-with-markdown) explains
its layout and how `--details` expands it.

## See each change in place

Open the plan in the Explorer with `rootform run plan.json --plan-file
plan.tfplan`. The selector at the top left names the current view, starting
with **Planned changes** and offering **Reported drift** and **Net change**
when the plan holds those stages. The reading block at the bottom left picks
one side or the difference: **Refreshed**, **Changes**, or **Planned**. Beside
it, the **Added**, **Removed**, **Changed**, and **Indeterminate** filters
narrow the canvas. Positions stay put when you switch views, so a change is
easy to locate.

The **About this view** button beside the selector states what the view
compares, its totals, and any limit that changes how to read it, such as
instances the plan did not evaluate.
[What does this plan change?](explore-architecture.md#what-does-this-plan-change)
covers the controls in detail.

## Keep the questions apart

A plan's own views compare stages of one Form. Comparing two plans, two
states, or two saved Forms with `--diff` is a different operation: its result
is **Differences** between two inputs, and it is never drift.
[Compare two Forms](compare-architectures.md) covers that comparison and
[Comparisons and drift](../concepts/comparisons.md) owns the model behind
both.
