---
title: "Policies and Policy Packs"
description: "Understand selection, evaluation, and evidence limits of Rootform policies."
---

A Policy evaluates exactly one Form. It cannot contact a provider, infer live state, or invent a missing fact. A Policy Pack owns related Policies and their selection. A [Rootform document](forms.md) preserves the Form used for evaluation; the policy result is separate.

## Definition, selection, and evaluation

| Object | Role | Evidence boundary |
| --- | --- | --- |
| **Policy** | Defines target, assertion, and message | Its existence does not mean it ran |
| **Policy Pack** | Owns a set of Policies | Its presence does not mean it was selected |
| **Selection** | Chooses a Pack or specific Policies for one run | A Dialect selection alone selects no Policies |
| **Result** | Records targets, outcomes, and diagnostics | Shows which selected Policies actually evaluated instances |

`--policy-pack ./policies` selects a local Pack for one invocation. A project can record a Pack in `rootform.lock` and use `--policy` to select specific Policies under `--locked`; `--policy-pack` is refused with `--locked`. A run without Policy selection performs analysis and returns status `0` when successful, but makes no compliance claim. See [Run checks](../guides/check-architecture.md) for the procedure and [external content](external-content.md) for project selection.

## Target scope is exact

A Policy target matches each eligible Representation on the evaluated stage through authored Concept, Rule, and Dialect conditions. Values within one condition are alternatives; different conditions must all match. Similar provider types and source dependencies do not substitute for a selected Concept or applied Rule. Each matching instance is evaluated separately; an instance cannot borrow a sibling's proven Context. Composition members do not inherit the root's Concept.

This makes coverage part of the governance claim. A passing evaluation applies only to its matched target and authored assertion. It says nothing about instances outside that target or Policies outside the selection. Review the selected Policy count, matched target count, and each outcome before treating a run as a gate.

## Evaluate a supported stage

A plan evaluates Planned by default and can evaluate Refreshed when present. It never evaluates a plan's reconstructed Recorded Form. A state analysis evaluates its sole Recorded Form. `--stage` chooses an available stage for a single input; an input comparison uses its selected After stage. A Policy does not directly ask whether drift occurred. It evaluates architectural facts on the chosen Form.

## Evidence produces three outcomes

| Outcome | Meaning |
| --- | --- |
| Passed | Available facts and population establish the assertion as true |
| Violated | Available facts establish the assertion as false |
| Indeterminate | Valid architecture cannot establish either Boolean |

A proven `absent` closure can make an assertion false. Unknown, sensitive, conflicting, or unavailable evidence stays indeterminate when it affects the answer. A negative assertion needs complete relevant population before absence can count as a pass. A selected Policy with no matching target is *not evaluated*; that is no decision, not a fourth evaluation outcome. [Run checks](../guides/check-architecture.md) shows the outcomes on small plans: the same Policy passes, is violated, or stays indeterminate because the evidence differs, not because the Policy changes. [Evaluation semantics](../language/reference/evaluation.md) defines the exact truth rules.

## Read the aggregate decision

The run summary and exit status follow one priority:

1. Any violation makes the result violated and returns status `1`.
2. Otherwise, any indeterminate evaluation, or a selected Policy that evaluated no target, returns status `3`.
3. Only when at least one selected Policy evaluates and every evaluation passes is the result compliant, with status `0`.

A run with no Policy selected also returns `0` after successful analysis, with an explicit no-policy message; that is not a compliance claim. Invalid usage returns `2`, refused input `3`, and an output or server failure `4`. A violation can coexist with lower-priority uncertainty, and status `1` does not remove it from the report. Always read the selected Policy count, evaluation count, and result distribution with the status. [Outputs and exit status](../reference/outputs.md) has the full command matrix.

## What a Policy result proves

A subnet Context Policy can establish that the supplied stage includes a Dialect-proven network placement. It cannot establish runtime reachability. A failed match can mean proven absence, or uncertainty can prevent a verdict; those are different review decisions. Architecture and SARIF reports preserve diagnostic and evaluation detail. SARIF states when nothing was evaluated instead of implying approval.

Review these boundaries before treating a Pack as a gate:

- the exact Pack and Policy selection;
- the number and identity of matched targets;
- the outcome of every evaluation;
- diagnostics and the facts they cite;
- the document semantics used for linking.

## Portable source and compiled Pack serve different stages

A Policy Pack source is a portable authored unit. Before evaluation, Rootform links its qualified references against the semantics of the evaluated Rootform document: the vocabulary, Dialects, and Rules that interpreted it. The linked Pack records owner versions, content digests, and semantic digests. A saved document keeps its Dialect meaning, so reopening it with a newer binary does not rewrite that meaning.

`rootform compile policy-pack` pins a Pack to one document's semantics, so the Pack can be evaluated later and offline without the Dialect sources that interpreted that document. When a compiled Pack's pins disagree with the evaluated document, for example after a Dialect version changes, evaluation fails closed with `POLICY_SEMANTICS_MISMATCH: compiled Policy Pack semantic pin differs from the document` and exit status `3`. Rootform does not relink silently, reload other Dialects, or fall back to another Pack.

A project lock selects Policy Pack source. `--policy-pack` supplies a local source directory or compiled Pack for one invocation; `--policy` narrows which selected Policies evaluate without changing the selection. Neither changes the Rootform document. Continue with [Run checks](../guides/check-architecture.md), [Write a Policy Pack](../language/write-policy-pack.md), or [Policy Packs reference](../language/reference/policy-packs.md).
