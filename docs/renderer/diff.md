---
title: "Architecture Diff"
description: "Understand what Rootform compares, how uncertainty is reported, and how the Diff view presents change."
---

Architecture Diff compares architectural meaning between a **base** and a **head**.
It compares validated architecture facts, not Terraform text, plan actions, or
every configuration value. Formatting and provenance-only changes do
not create an architectural change.

Use [compare architectures](../guides/compare-architectures.md) for a runnable
example, or open the
[Diff Playground](https://docs.rootform.dev/playground/?mode=diff&scenario=commerce-rollout)
to inspect a predefined comparison. A [JSON plan](../inputs/plans.md) can supply
both sides for a Diff report.

## What can change

Diff compares representations, contexts, contributions, and relations. It also
reports changes in declaration accounting and diagnostics, so a coverage change
is not hidden behind an unchanged-looking graph.

| Classification | Shown in | Meaning |
| --- | --- | --- |
| `added` | Report and the Diff view | A fact is established on the head side and known absent on the base side. |
| `removed` | Report and the Diff view | A fact is established on the base side and known absent on the head side. |
| `changed` | Report; **Modified** in the Diff view | A matched fact has different architectural fields, such as concept, membership, or relation endpoints. |
| `moved` | The Diff view | The same representation provably changed context within one dimension. |
| `undetermined` | Report and the Diff view | Available evidence cannot support a determined change claim for that fact. |

`moved` is a strict presentation in the Diff view, not another entry state in Architecture
Diff JSON. The machine report retains the underlying removed and added context
facts. The Diff view groups them only when one stable subject has exactly one known old
context and one known new context in the same dimension.

An object known on one side but unresolved on the other is not automatically an
addition or removal. For example, an update plan may not contain enough evidence
to reconstruct a previous reference. Planned evidence cannot fill that gap on
the before side.

An empty comparison means valid comparable inputs, no architectural changes,
and no undetermined entries. A refused or incomplete comparison is never an
empty success.

## Compare like interpretations

Both documents must be valid and use compatible formats and the same Dialect
identities and versions. A different interpretation could otherwise look like an
infrastructure change. Keep the semantic selection fixed when comparing source
changes; review a Dialect upgrade separately.

Stable identities let Diff track facts independently of display order and canvas
coordinates. It compares representation meaning and membership, context
dimensions, relation types, and endpoints. Source positions and rule provenance
explain a fact but do not themselves create a change. The
[Diff contract](../../contracts/architecture-diff.md) lists exact fields.

## Read the Diff view

The **Diff view** presents one comparison surface, not a third architecture.
Base provides prior placement and reference context; head provides current
facts. Removed components remain visible as before-side references. Unknown
sides stay unknown instead of being drawn as confident deletions or moves.

For your own inputs, `rootform diff` emits text, JSON, or Markdown reports.
The [Commerce platform Diff Playground](https://docs.rootform.dev/playground/?mode=diff&scenario=commerce-rollout)
shows the predefined
[Commerce platform comparison](examples.md#compare-the-commerce-platform-states)
in the Diff view.
`rootform run --plan` displays the planned architecture only.

### Follow change within context

Survey, Plan, Focus, scope disclosure, and Inspector keep the same roles in
the Diff view. Survey gives changed areas priority within available space. A collapsed
scope can indicate changes inside; expand or focus it to locate them.
Plan exposes complete structure, including unchanged context needed to understand
a change. Focus isolates one changed area while preserving relevant boundary
connections.

Change is expressed with labels and line/border patterns as well as color.
The Inspector label **Modified** corresponds to the machine state `changed`.
An aggregate indicator is a route into the underlying facts, not a replacement
for their individual classifications.

A move never comes from proximity or a guessed rename. Ambiguous placements and
undetermined facts remain separate evidence.

![The Diff view marks the analytics cluster's move, a removed archive private endpoint and an added backup endpoint within the Azure environments.](../assets/renderer/azure-delta-light.png#gh-light-mode-only)
![The Diff view marks the analytics cluster's move, a removed archive private endpoint and an added backup endpoint within the Azure environments.](../assets/renderer/azure-delta-dark.png#gh-dark-mode-only)

The Diff view from the
[Commerce platform source pair](examples.md#compare-the-commerce-platform-states).
The analytics cluster keeps its identity and moves between subnets. Renamed
declarations appear as additions and removals, because their source identities
changed. The renderer does not guess that a rename preserved an object.

### Use Inspector to explain the change

Select a changed subject to read its before/after fields, previous and current
placement, related changes, and supporting evidence. A scope can carry changes
inside without having a direct field change of its own. Distinguish those cases
before deciding what changed about the selected object.

The overview's change count opens comparison context. Diagnostic and declaration
deltas help explain a change in coverage. An undetermined entry explains where
the available evidence stops; it is not a low-confidence guess at a change.

![The focused Diff view shows production analytics in its new edge subnet. Inspector compares its previous applications subnet with the edge subnet and lists both context changes.](../assets/renderer/azure-change-light.png#gh-light-mode-only)
![The focused Diff view shows production analytics in its new edge subnet. Inspector compares its previous applications subnet with the edge subnet and lists both context changes.](../assets/renderer/azure-change-dark.png#gh-dark-mode-only)

Inspector Change explains the move with its **Before** and **After** placement
and the underlying added/removed contexts. This is an architectural placement
change, not a claim that Rootform moved a deployed cluster.

## Use Diff in local and pull-request review

Follow [Compare two architectures](../guides/compare-architectures.md) to build
both sides and save a report, or use
[plan Diff](../inputs/plans.md#compare-both-sides-of-one-plan) when one plan
supplies both sides. [Git and CI workflows](../workflows/index.md) covers
preparation, review artifacts, and PR safety.

## What a Diff result cannot promise

A Terraform replacement may leave architectural facts unchanged. A no-change
Diff does not mean that Terraform has no work to apply, that all resource
attributes match, or that deployed infrastructure matches source. Rootform does
not independently refresh state or detect Drift.

A completed comparison can contain undetermined facts. Invalid or incompatible
inputs can prevent the comparison itself. Neither supports a no-change claim,
so read the report as well as its status. The
[Diff command reference](../reference/cli/diff.md#exit-status) defines exit
behavior for review gates.
