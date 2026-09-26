---
title: "Evaluation"
description: "Instance interpretation, closure truth, policy targets, outcomes, and exit status."
---

Rootform interprets plan JSON or state JSON locally. It masks sensitive values before retaining requested paths, selects at most one Rule per managed or data instance, closes that Rule's emissions, and evaluates selected policies over one stage. It never runs Terraform or OpenTofu or contacts providers. A saved Rootform document can be reopened after validation without reinterpreting the original input.

## Architecture evaluation pipeline

1. Read observed instances and their provider bindings from the plan or state export.
2. Classify Rule candidates, then select at most one per instance.
3. Attach optional Concept meaning and resolve ordered composition members per root instance.
4. Resolve Context, Relation, and Contribution emissions into per-instance closures and facts.
5. Record stage accounting, diagnostics, and the Rootform document.
6. If policies were selected, link and evaluate them against the selected stage.

This order matters: a policy cannot treat an unclosed emission or failed interpretation as proof that a fact is absent.

## Instance population and stages

| Input | Stages | Default policy target |
| --- | --- | --- |
| Plan JSON | `planned`; `refreshed` and reconstructed `recorded` when prior evidence permits | `planned` |
| State JSON | One `recorded` stage | `recorded` |
| Saved Rootform document | Its recorded stages | Document default stage |

## Base representation

Every observed managed and data instance has a Representation, even without an applied Rule. A plan's reconstructed `recorded` stage is never a policy evaluation target. A plan can report drift between recorded and refreshed and proposed change between refreshed and planned. A cross-input [comparison](../../concepts/diff.md) has no policy predicate that proves drift.

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

Each active emission has one closure per source instance and stage. A known matching value or verified planned-stage identity traversal can establish a fact. `on_null` and `on_empty` decide whether a known missing value proves `absent` or remains indeterminate. Unknown, sensitive, unavailable, ambiguous, and conflicting evidence never proves absence. A list can retain proven facts while another element keeps its closure indeterminate. A fact records its Rule, emission, closure, target and `value`, `traversal`, or `both` evidence.

## Policy linking

A Policy Pack links against the document's exact semantic owner identities. A missing definition, conflicting selection, or incompatible semantic digest prevents a policy decision.

## Policy target selection

Target dimensions combine with AND; entries within one list combine with OR. Representations with an applied Rule can be selected. A failed or indeterminate interpretation whose candidate Rule could satisfy the target is also selected for an indeterminate evaluation. An unverified instance population can make target coverage incomplete. A Policy with zero targets has zero per-target evaluations and contributes no compliance decision.

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

A false assertion is a violation; an unknown assertion is indeterminate. If a different target has a confirmed violation, that violation still takes precedence for the run.

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

These reasons can appear on a closure, evaluation, or coverage entry according to where uncertainty arose. `external_denied` does not authorize claiming that the external object is absent. A Policy with zero targets has no evaluation and status `no_decision`; a run with no selected policies has status `not_evaluated` and makes no compliance claim. An unavailable requested stage or incompatible Pack fails evaluation with its own diagnostic.

## Per-target outcomes

| Outcome | Meaning |
| --- | --- |
| `passed` | Assertion known true |
| `violated` | Assertion known false; Policy message applies |
| `indeterminate` | Required evidence or assertion undecidable |

`not_evaluated` describes a Policy with zero selected targets, not a passed per-target result. A run with no selected policies makes no compliance claim.

## Aggregate result and exit status

### Aggregate result status

A confirmed violation takes precedence over indeterminate evaluations. Without one, indeterminate evaluation or incomplete target coverage produces `indeterminate`; zero target evaluations produce `no_decision`; all selected evaluations passing produces `passed`. Only the last status is a compliance claim.

| Priority | Condition | Status |
| --- | --- | --- |
| 1 | At least one confirmed violation | `violated` |
| 2 | Indeterminate evaluation or incomplete target coverage | `indeterminate` |
| 3 | Zero target evaluations | `no_decision` |
| 4 | Every selected evaluation passed | `passed` |

These are the status values of `rootform explain policy --format json`. Text and Markdown outputs print `no_decision` as `no decision`.

### `rootform run` exit status

| Condition | Reported result | `rootform run` exit |
| --- | --- | --- |
| Every selected policy evaluated and passed, or analysis without selected policies succeeded | `passed` when policies were selected; otherwise no policy result | `0` |
| At least one confirmed violation, even with indeterminate results elsewhere | `violated` | `1` |
| Selected policy indeterminate or selected no target, with no violation | `indeterminate` or no decision | `3` |
| Invalid command use | Usage error | `2` |
| Input refused | Refusal | `3` |
| Export or server failed | Operation failure | `4` |

With `--policy-pack` and no `--policy`, Rootform evaluates every Policy in the Pack. A zero-target Pack run ends with `POLICY_NO_DECISION` and exit `3`. A reported drift entry alone does not change exit status. The JSON Rootform document stores architecture evidence, not policy results; text, Markdown, SARIF, and `explain policy` can report policy outcomes. See [Outputs and exit status](../../reference/outputs.md).

## Determinism and limits

The same input and semantic selection produce canonical, byte-identical Rootform documents. Facts deduplicate while retaining bounded provenance. Exceeding a semantic or policy bound fails closed rather than returning partial compliance. [Diagnostics and limits](diagnostics.md#limits) lists the bounds. Continue with [Test and validate](../test-validate.md) to prove a Dialect against planned evidence.
