---
title: "Policies and Policy Packs"
description: "Understand selection, evaluation, and evidence limits of Rootform Policies."
---

A Policy evaluates a selected architecture stage within a [Form](forms.md). It cannot contact a provider, infer live state, or invent a missing fact. A Policy Pack owns related Policies and their selection. The Policy result is a separate artifact and carries `form_format_version`.

## Definition, selection, and evaluation

| Object | Role | Evidence boundary |
| --- | --- | --- |
| **Policy** | Defines target, assertion, and message | Its existence does not mean it ran |
| **Policy Pack** | Owns a set of Policies | Its presence does not mean it was selected |
| **Selection** | Chooses Packs and specific Policies for one check | A Dialect selection alone selects no Policies |
| **Result** | Records targets, outcomes, and diagnostics | Shows which selected Policies actually evaluated instances |

`rootform check` evaluates Policies; `rootform run` only analyzes and never selects or evaluates them. The active Packs come from `rootform.lock`, and `--policy-pack ./policies` overlays a local Pack for one command, replacing a selected Pack of the same name. Without `--policy`, a check selects every Policy of the overlay Packs, or of every active Pack when there is no overlay. Repeat `--policy` to narrow that selection before anything is linked; an unknown or ambiguous selector is a usage error. `--locked` refuses overlays. See [Follow a Policy through every outcome](../guides/check-architecture.md) for the procedure, the [`check` reference](../reference/cli/check.md) for exact options, and [external content](external-content.md) for project selection.

## Target scope is exact

A Policy target matches each eligible Representation on the evaluated stage through authored Concept, Rule, and Dialect conditions. Values within one condition are alternatives; different conditions must all match. Similar provider types and source dependencies do not substitute for a selected Concept or applied Rule. Each matching instance is evaluated separately; an instance cannot borrow a sibling's proven Context. Composition members do not inherit the root's Concept.

This makes coverage part of the governance claim. A passing evaluation applies only to its matched target and authored assertion. It says nothing about instances outside that target or Policies outside the selection. Review the selected Policy count, matched target count, and each outcome before treating a check as a gate.

## Evaluate a supported stage

For a plan Form, `rootform check` evaluates Planned by default and can evaluate Refreshed when present. It never evaluates a plan's reconstructed Recorded stage. For a state Form, it evaluates Recorded. A comparison Form evaluates both Before and After by default, each at the stage selected in the saved comparison for that side; `--side` accepts `before`, `after`, or `both`. `--stage` chooses an available stage and never falls back to another; on a comparison Form it requires `--side before` or `--side after`. A Policy does not directly ask whether drift occurred: comparisons, drift, and the drift report are never evaluated as architectures. It evaluates architectural facts on each selected architecture.

## Evidence produces three outcomes

| Outcome | Meaning |
| --- | --- |
| Passed | Available facts and population establish the assertion as true |
| Violated | Available facts establish the assertion as false |
| Indeterminate | Valid architecture cannot establish either Boolean |

A proven `absent` closure can make an assertion false. Unknown, sensitive, conflicting, unavailable, carried, or deferred evidence stays indeterminate when it affects the answer. A carried instance remains in Planned because the plan neither changes nor deletes it, but the plan did not evaluate it; a Policy cannot pass or fail on missing evidence from it, and an evaluation that depends on it is indeterminate with reason `population_unverified`. A negative assertion needs complete relevant population before absence can count as a pass. A selected Policy with no matching target has no evaluation; that is no decision, not a fourth evaluation outcome. [Follow a Policy through every outcome](../guides/check-architecture.md) shows the outcomes on small plans: the same Policy passes, is violated, or stays indeterminate because the evidence differs, not because the Policy changes. [Evaluation semantics](../language/reference/evaluation.md) defines the exact truth rules.

## Read the aggregate decision

`rootform check` states one verdict across the evaluated architectures, with this priority:

1. Any violation makes the result violated and exits `1`.
2. Otherwise, any indeterminate evaluation or incomplete target coverage makes the result indeterminate and exits `3`.
3. Otherwise, a selected Policy with no target, or no selected Policy at all, is no decision and exits `3`.
4. Only when every selected Policy evaluates at least one target and every evaluation passes is the result passed, with exit `0`.

A check that cannot evaluate, for example because the stage is unavailable, no Policy Pack is selected, or a selected Pack cannot link, reports its code and exits `3`. Invalid usage exits `2`; a report that cannot be written exits `4` after the verdict is stated. `rootform run` never evaluates Policies, so its status `0` makes no compliance claim. A violation can coexist with lower-priority uncertainty, and exit `1` does not remove it from the report. Always read the selected Policy count, evaluation count, and result distribution with the status. [Outputs and exit status](../reference/outputs.md) has the full command matrix.

## What a Policy result proves

A subnet Context Policy can establish that the supplied stage includes a Dialect-proven network placement. It cannot establish runtime reachability. A failed match can mean proven absence, or uncertainty can prevent a verdict; those are different review decisions. The check's JSON result and SARIF preserve diagnostic and evaluation detail; its Markdown review shows the outcomes to reviewers and lists every evaluation when written with `--details`. SARIF records the verdict status in the properties of its SARIF run, so a check that evaluated nothing does not read as approval.

Review these boundaries before treating a Pack as a gate:

- the exact Pack and Policy selection;
- the number and identity of matched targets;
- the outcome of every evaluation;
- diagnostics and the facts they cite;
- the Form semantics used for linking.

## Portable source and compiled Pack serve different stages

A Policy Pack source is a portable authored unit. Before evaluation, Rootform links its qualified references against the semantics of the evaluated Form: the vocabulary, Dialects, and Rules that interpreted it. The linked Pack records owner versions, content digests, and semantic digests. A saved Form keeps its Dialect meaning, so reopening it with a newer binary does not rewrite that meaning.

`rootform compile policy-pack` pins a Pack to one Form's semantics, so the Pack can be evaluated later and offline without the Dialect sources that interpreted it. When a compiled Pack's pins disagree with the evaluated Form, for example after a Dialect version changes, evaluation fails closed with `POLICY_SEMANTICS_MISMATCH: compiled Policy Pack semantic pin differs from the document` and exit status `3`. Rootform does not relink silently, reload other Dialects, or fall back to another Pack.

A project lock selects Policy Pack source. `--policy-pack` supplies a local source directory or compiled Pack for one invocation; `--policy` narrows which Policies one check evaluates without changing the lock. Neither changes the Form. Continue with [Check a Form with Policies](../guides/check-with-policies.md),
[Follow a Policy through every outcome](../guides/check-architecture.md), the [`check` reference](../reference/cli/check.md), [Write a Policy Pack](../language/write-policy-pack.md), or [Policy Packs reference](../language/reference/policy-packs.md).
