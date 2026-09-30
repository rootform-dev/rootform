---
title: Analyze your own plan
description: Export a completed Terraform or OpenTofu plan, or state, and open its architecture in Rootform.
---

Turn a plan you already produce into a Form you can explore, explain, compare,
and check; the last section does the same with a state export. You need
[Rootform](../installation.md) and a root module you can plan with your usual
backend, workspace, and credentials.

Rootform itself needs none of those: it reads the exported files and never
runs Terraform or OpenTofu, contacts a provider, or refreshes state.

## Export the plan

From the root module, save a plan and export that same saved plan as JSON.

<!-- rootform:tabs Planning tool -->
<!-- rootform:tab Terraform -->

```sh
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
```

<!-- rootform:tab OpenTofu -->

```sh
tofu plan -out=plan.tfplan
tofu show -json plan.tfplan > plan.json
```

<!-- rootform:endtabs -->

> [!WARNING]
> `plan.tfplan` and `plan.json` can contain secrets in clear text, even when the
> terminal hides them. Keep both out of Git and shared artifacts. Rootform
> reads them locally and leaves them unchanged.

## Open the architecture

<!-- docs-check:analyze-own-run -->
```sh
rootform run plan.json --plan-file plan.tfplan
```

```ansi title="Run output excerpt"
[1mPlan analyzed[0m
[2mEnrichment[0m         Saved plan paired with this plan JSON (1 module)
[2mStage[0m              Planned
```

The summary counts the planned resource instances, how many a Dialect Rule
interpreted, and the facts those Rules established, then lists the plan's
changes.

The Explorer opens in your browser from a local server, and the terminal shows
its address. Press `Ctrl+C` to stop it.

**Enrichment** confirms that the saved plan paired with the JSON export, which
lets Rootform follow references whose values are unknown until apply. Without
`--plan-file`, those placements stay `indeterminate` rather than guessed. If
pairing is refused, export the JSON again from the saved plan you pass;
[Pair the saved plan](../inputs/plans.md#pair-the-saved-plan) explains the check,
and [Trace a placement](first-architecture.md) shows one
closure with and without the saved plan.

## Read what the summary can and cannot say

**Interpreted** counts instances that matched a Rule, which does not settle
every fact: the **Uncertainty** section counts the closures that stayed
indeterminate and why, most often a value unknown until apply. A resource
without a Rule keeps its place in the Form with no architectural facts, as
[Instances without Rules](../limitations.md#instances-without-rules) explains.

**Planned changes** compares what the plan starts from with what it proposes.
**Reported drift** lists the drift records the export holds, and **Net change**
what remains once drift and plan combine; on a plan from an empty state, the
first is empty and the second repeats the planned changes. "No drift reported
in this plan" means the export holds no drift record, not that infrastructure
is unchanged.
[Review planned changes](../guides/review-planned-changes.md) reads all three.

## Keep the result

Write the Form and a report instead of serving the Explorer:

<!-- docs-check:analyze-own-save -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve -o analysis.json -o review.md
```

`analysis.json` is the Form. It reopens with `rootform run analysis.json`
without the plan files and feeds `explain`, `check`, and comparisons.
`review.md` is a readable report for a pull request. Neither holds sensitive
plan values, but both name resources and describe topology, so share them as
you would an architecture diagram.
[Outputs and exit status](../reference/outputs.md) lists every format.

## Analyze a state export

State gives a different view: a snapshot of the architecture recorded in
state, with no planned change. Export it from the same root module and run the
same command. OpenTofu users export with `tofu show -json`.

```sh
terraform show -json > state.json
rootform run state.json
```

The summary reads **State analyzed**, and the Form has one stage, Recorded. It
holds what state records, not a live view of your cloud: Rootform refreshes
nothing. You explore, explain, save, and compare it like a plan Form. A
comparison with a later plan shows how the architecture that plan proposes
differs from the recorded one, as in
[Compare other stage pairs](../guides/compare-architectures.md#compare-other-stage-pairs).

Rootform reads only the export, so a `state.json` produced elsewhere can be
analyzed on a machine without Terraform, providers, or cloud credentials. State
JSON can contain secrets too; keep it out of Git.
[Choose an input](../inputs/index.md) explains when state, a plan, or a saved
Form answers your question.

Continue in [Explore a Form](../guides/explore-architecture.md) to find
resources and read their evidence, or ask the same questions from the terminal
with [Explain an architecture](../guides/explain-architecture.md).
