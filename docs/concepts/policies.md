---
title: "Policies and Policy Packs"
description: "Understand governance selection, target scope, evidence outcomes, and what a Policy result proves."
---

A Policy evaluates established [Architecture IR](architecture-ir.md) facts
against a requirement. It runs after [Dialects](dialects.md) interpret source.
It cannot contact a cloud provider, infer live state, or invent a missing fact.

## Definition, selection, and evaluation

| Object | Role | Evidence boundary |
| --- | --- | --- |
| **Policy** | Defines a target, assertion, and violation message | Its existence does not show that it ran |
| **Policy Pack** | Groups related Policies | Its presence does not show that it was selected |
| **Selection** | Chooses exact Packs and optional Policy subset | Establishes the scope of a check |
| **Result** | Records targets, outcomes, diagnostics, and aggregate status | Shows which selected Policies actually evaluated targets |

Selecting a Dialect never selects a Policy Pack. `rootform build` and `rootform run`
do not evaluate governance. `rootform check` does, using an explicit Policy Pack
selection.

## Target scope is exact

A Policy target selects representations through a Concept, applied Rules, and
Dialect owners declared by the Pack. Values within one dimension are alternatives.
Different dimensions must all match.

A base representation without the selected Concept or applied Rule is not
selected by a similar source type. A composition member does not inherit root
eligibility. Each selected representation is evaluated once.

This makes coverage part of the governance claim. A passing evaluation says the
assertion was true for its matched target. It says nothing about representations
outside the target or Policies outside the selection.

## Evidence produces three outcomes

Each evaluation ends with one of three outcomes.

| Outcome | Meaning |
| --- | --- |
| `passed` | Available architecture facts establish assertion as true |
| `violated` | Available architecture facts establish assertion as false |
| `indeterminate` | Valid architecture cannot establish either Boolean |

`not evaluated` is not a fourth evaluation outcome. It means a selected Policy
had no target. A run with no selected Pack evaluates no Policies at all. Neither
case is approval.

[Run checks](../guides/check-architecture.md) demonstrates all boundaries with
one subnet Policy and one EC2 team convention. An instance with an explicit,
resolvable subnet reference passes the convention. A proven source omission
violates it. A literal subnet identifier that Rootform cannot resolve is
indeterminate. Those cases differ because the evidence differs, not because the
Policy changes.

## Aggregate verdict follows strongest result

The run summary and process status use a global priority.

1. Any violation makes the run `violated` and status `1`.
2. Otherwise any indeterminate result makes the run `indeterminate` and status `3`.
3. Otherwise, no selected Policy or any selected Policy without a target makes
   the run `not evaluated` and status `3`.
4. Only when at least one Policy is selected and every selected Policy evaluates
   and passes does the run become `compliant` with status `0`.

Status `2` means a command usage error. Always review the selected Policy count,
evaluation count, and result distribution alongside process status. A violation
can coexist with lower-priority uncertainty, and status `1` does not erase it
from the report.

## What a Policy result proves

A Policy result proves only its authored assertion over matched representations
and facts available in the evaluated architecture. A proven omission can support
a false assertion. Missing proof caused by unresolved or incomplete evidence
produces an indeterminate result instead.

Neither result proves the opposite real-world condition. For example, a Policy
about a declared subnet Context evaluates source architecture evidence. It does
not test runtime network reachability.

Review these boundaries before treating a Pack as a gate.

- Exact Pack and Policy selection
- Number and identity of matched targets
- Outcome for every evaluation
- Diagnostics and inspected fact identities
- The Architecture IR semantic snapshot used for linking

## Portable source and linked artifact serve different stages

A Policy Pack source is a portable authored unit. Before evaluation, Rootform links
its qualified references against the exact Architecture IR semantic snapshot.
The linked Pack records owner versions, content digests, and semantic digests.

A compiled Policy Pack is a replay artifact bound to that snapshot. If an
explicitly supplied artifact's pins disagree with the evaluated architecture,
Rootform fails closed. It does not relink silently, reload producer Dialects, or
fall back to another Pack.

A project lock can select Policy Pack source. `--policy-pack` can instead provide
local source or a compiled artifact for one invocation. Neither selection changes
Architecture IR.

Continue with [Run checks](../guides/check-architecture.md) for executable
examples. Use [Write a Policy Pack](../language/write-policy-pack.md) for
authoring workflow and [Policy Packs reference](../language/reference/policy-packs.md)
for syntax and linking rules.
