---
title: "Evaluation"
description: "Instance interpretation, closure truth, Policy targets, outcomes, and exit status."
---

Rootform interprets plan JSON or state JSON locally. It masks sensitive values before retaining requested paths, selects at most one Rule per managed or data instance, closes that Rule's emissions, and evaluates selected Policies over one architecture stage within a Form. It never runs Terraform or OpenTofu or contacts providers. A saved Form can be reopened after validation without reinterpreting the original input.

## Architecture evaluation pipeline

1. Read observed instances and their provider bindings from the plan or state export.
2. Classify Rule candidates, then select at most one per instance.
3. Attach optional Concept meaning and resolve ordered composition members per root instance.
4. Resolve Context, Relation, and Contribution emissions into per-instance closures and facts.
5. Record stage accounting, diagnostics, and the Form.
6. If Policies were selected, link and evaluate them against the selected stage.

This order matters: a Policy cannot treat an unclosed emission or failed interpretation as proof that a fact is absent.

## Instance population and stages

| Input | Available stages | Default Policy target |
| --- | --- | --- |
| Plan JSON | `planned`; `refreshed` and reconstructed `recorded` when prior evidence permits | `planned` |
| State JSON | One Recorded architecture | `recorded` |
| Saved Form | Its stages | Form default stage; both sides for a comparison Form |

## Base Representation

Every observed managed and data instance has a Representation, even without an applied Rule. A plan's reconstructed Recorded stage is never a Policy evaluation target. A plan can include Reported drift (Recorded to Refreshed) and Planned changes (Refreshed to Planned). A cross-input [comparison](../../concepts/comparisons.md) has no Policy predicate that proves drift.

## Rule selection

A candidate must match resource mode, exact type, provider source, then a known-true `where` predicate. The provider version envelope belongs to the Dialect manifest; the instance selector does not compare an observed exact version. More than one accepted Rule yields `RULE_MATCH_AMBIGUOUS`; an unresolved predicate prevents choosing around uncertainty. An unbound provider produces `PROVIDER_UNBOUND` and failed interpretation. Exactly one accepted Rule applies; otherwise the instance remains represented but unclassified. There is no first-match order. [Rules and matching](rules.md#selection-precedence) has the selection table.

## Composition application

Composition records each established member and each unresolved member on the root instance. An unresolved earlier member leaves a dependent later member unavailable, while an independent later member may still resolve. The root Rule, Concept, and emissions remain available. See [Member resolution](composition.md#member-resolution) and [Unresolved members](composition.md#unresolved-members).

## Predicate truth

Rule predicates compare known scalar values. Boolean operations use three-valued logic: `false && unknown` is false, `true || unknown` is true, and `!unknown` remains unknown. Only final known true accepts a Rule. Unknown, sensitive, or missing evidence is never silently false.

| A | B | `A && B` | <code>A &#124;&#124; B</code> |
| --- | --- | --- | --- |
| `true` | `true` | `true` | `true` |
| `true` | `false` | `false` | `true` |
| `true` | `unknown` | `unknown` | `true` |
| `false` | `false` | `false` | `false` |
| `false` | `unknown` | `false` | `unknown` |
| `unknown` | `unknown` | `unknown` | `unknown` |

The operations are commutative, so swapping A and B gives the remaining cases.

## Fact derivation

### Emission closure

Each active emission has one closure per source instance and stage. A known matching value or verified Planned-stage identity traversal can establish a fact. `on_null` and `on_empty` decide whether a known missing value proves `absent` or remains indeterminate. Unknown, sensitive, unavailable, ambiguous, and conflicting evidence never proves absence. A list can retain proven facts while another element keeps its closure indeterminate. A fact records its Rule, emission, closure, target and `value`, `traversal`, or `both` evidence.

## Policy linking

A Policy Pack links against the Form's exact semantic owner identities. A missing definition, conflicting selection, or incompatible semantic digest prevents a policy decision.

## Policy target selection

Target dimensions combine with AND; entries within one list combine with OR. Representations with an applied Rule can be selected. A failed or indeterminate interpretation whose candidate Rule could satisfy the target is also selected for an indeterminate evaluation. An unverified instance population can make target coverage incomplete. A `carried` instance stays in Planned because the plan neither changes nor deletes it, but the plan did not evaluate it. Missing evidence from it cannot produce a pass or violation. A Policy with zero targets has zero per-target evaluations and contributes no compliance decision.

## Query truth

### `exists(query)`

| Matching facts | Query supported | Relevant closures complete | `exists(query)` |
| --- | --- | --- | --- |
| One or more | Either | Either | True |
| Zero | Yes | Yes | False |
| Zero | No | Either | Unknown |
| Zero | Yes | No | Unknown |

### `length(query)`

`length(query)` has an exact deduplicated count only for supported, complete evidence. A numeric comparison may still be decided from a proven lower bound when evidence is incomplete; otherwise it is unknown. Negative assertions need complete relevant closures, so an indeterminate closure cannot make `!exists(...)` pass. Boolean operators preserve three-valued truth: a known false decides `&&`, a known true decides `||`, and other combinations with unknown remain unknown. See [Built-ins](built-ins.md#support-completeness-and-evidence) for signatures.

## Worked example

For a subnet Rule emitting network Context to a VPC:

| Evidence for `source.vpc_id` | Closure | `exists(contexts(...))` |
| --- | --- | --- |
| Known matching identity or verified endpoint traversal | `resolved` | True |
| Known null with `on_null = "absent"` | `absent` | False, if relevant population complete |
| Unknown until apply | `indeterminate(unknown_until_apply)` | Unknown |
| No selected subnet instance | No evaluation | No decision |

A false assertion is a violation; an unknown assertion is indeterminate. If a different target has a confirmed violation, that violation takes precedence in the check result.

## Indeterminate and no-decision reasons

| Reason in result | Why evidence cannot decide | Reader action |
| --- | --- | --- |
| `unknown_until_apply` | Planned value is not known before apply | Evaluate a later state or plan when available |
| `sensitive` | Value is masked | Change the Dialect to use safe identity evidence if possible |
| `ambiguous_unknown`, `uncomparable_candidate`, `duplicate_identity`, `identity_incomplete` | Candidate identity or uniqueness is unsettled | Inspect candidate counts and declared identities |
| `reference_ambiguous` | Evaluated value conflicts with verified traversal | Inspect the plan pair and Rule endpoint/identity declarations |
| `unavailable`, `external_denied` | Evidence cannot be read or external target is disallowed | Supply a paired saved plan when relevant; review the external policy |
| `interpretation_failed` | Candidate Rule could not apply safely | Read the instance diagnostic |
| `population_unverified` | An instance that could affect target coverage was not verified | Analyze a complete plan or state export |

These reasons can appear on a closure, evaluation, or coverage entry according to where uncertainty arose. `external_denied` does not authorize claiming that the external object is absent. A Policy with zero targets has no evaluation and outcome `no_target`, which makes the result status `no_decision`; a check with no selected Policies makes no compliance claim. An unavailable requested stage or incompatible Pack fails evaluation with its own diagnostic.

## Per-target outcomes

| Outcome | Meaning |
| --- | --- |
| `passed` | Assertion known true |
| `violated` | Assertion known false; Policy message applies |
| `indeterminate` | Required evidence or assertion undecidable |

`no_target` is the Policy outcome when a selected Policy has zero targets; it is not a passed per-target result. A check with no selected Policies makes no compliance claim.

## Aggregate result and exit status

### Aggregate result status

A confirmed violation takes precedence over indeterminate evaluations. Without one, indeterminate evaluation or incomplete target coverage produces `indeterminate`; a selected Policy with no target, or no selected Policy, produces `no_decision`; every selected Policy evaluating a target and passing produces `passed`. Only the last status is a compliance claim.

| Priority | Condition | Status |
| --- | --- | --- |
| 1 | At least one confirmed violation | `violated` |
| 2 | Indeterminate evaluation or incomplete target coverage | `indeterminate` |
| 3 | A selected Policy has no target, or no Policy is selected | `no_decision` |
| 4 | Every selected Policy evaluated a target and passed | `passed` |

These are the aggregate `status` values of the Policy result written by
`rootform check`. A check that cannot evaluate has status `failed`.
`rootform explain policy <policy> --result <file> --format json` reports the
selected Policy's `outcome` in each recorded architecture. Text and Markdown
summaries render `no_decision` as `NO DECISION`.

For a comparison Form, `check` evaluates both the Before and After sides by
default. `--side before|after|both` selects the scope; `--stage` requires one
side. The JSON Policy result has one `architectures` entry for each evaluated
side, and SARIF has one run per evaluated side. The overall verdict is stated
once.

### `rootform check` exit status

| Condition | Reported result | `rootform check` exit |
| --- | --- | --- |
| Every selected Policy was evaluated and passed | `passed` | `0` |
| At least one confirmed violation, even with indeterminate results elsewhere | `violated` | `1` |
| No verdict: indeterminate, no target, nothing selected, a side that could not be evaluated, an input that was refused, or an invalid `rootform.lock` | Indeterminate, no decision, or not checked | `3` |
| Invalid command use or unknown Policy selector | Usage error | `2` |
| Input or report could not be read or written | Operational failure | `4` |

`rootform run` analyzes or compares architecture and never selects or evaluates
Policies. It exits `0` when the Form was produced or opened, `2` for incorrect
usage, `3` when an input was refused or a requested stage is unavailable, and
`4` when an input or output file, or the explorer, failed. To gate a plan,
state, or saved Form, use `rootform check`. With `--policy-pack` and no
`--policy`, check evaluates every Policy in the overlay Policy Packs.
A zero-target Policy produces a `NO DECISION` verdict and exits `3`.
A reported drift entry alone does not change check status. The JSON Form stores
architecture evidence, not Policy results. Check reports can be written as JSON,
Markdown, or SARIF;
`explain policy <policy> --result <file>` inspects a recorded result without
reevaluation. See [Outputs and exit status](../../reference/outputs.md).

## Determinism and limits

The same input and semantic selection produce canonical, byte-identical Forms. Facts deduplicate while retaining bounded provenance. Exceeding a semantic or policy bound fails closed rather than returning partial compliance. [Diagnostics and limits](diagnostics.md#limits) lists the bounds. Continue with [Test and validate](../test-validate.md) to prove a Dialect against planned evidence.
