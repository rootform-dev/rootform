---
title: "Evaluation"
description: "How Rootform interprets plan and state instances, closes emissions, and evaluates policies."
---

Rootform reads a Terraform or OpenTofu plan or state JSON export. It masks sensitive values at ingestion, records each observed managed and data instance, binds providers to selected Dialects, applies at most one Rule per instance, and resolves that Rule's emissions. It never evaluates Terraform source or runs a provider. A saved Rootform document is validated and reopened without recompilation.

## Stage and representation scope

A plan has a `planned` stage and may have `refreshed` and reconstructed `recorded` stages when prior evidence permits. A state input has one `recorded` stage. Every observed managed and data instance has a representation, even if no Rule matches. An unbound provider or ambiguous Rule leaves interpretation explicit; it does not erase the instance. A Rule may assign a Concept, emit facts, or claim composition members.

## Emission closure

Each active emission closes per source instance as `resolved`, `absent`, or `indeterminate`. `on_null` and `on_empty` determine whether those known values prove absence or remain indeterminate. Known matching values or verified planned-stage identity traversals can establish a target. Unknown, sensitive, ambiguous, unavailable, or conflicting evidence never proves absence. A list may retain proven facts while another element keeps the closure indeterminate. Every fact cites its Rule, emission, closure, and `value`, `traversal`, or `both` evidence.

A target candidate with unknown or uncomparable identity cannot be ignored to force uniqueness. An unmatched known value becomes an external endpoint only when the emission allows it and no eligible in-scope candidate remains unresolved. Provider configuration paths require a verified saved-plan reference; otherwise their closure is `indeterminate(unavailable)`. See [Fact emissions](emissions.md).

## Query truth

A policy query can be true, false, or unknown. `exists` is true when a matching fact is proven, false only when relevant complete closures prove absence, and otherwise unknown. A negative assertion requires a complete relevant population. Unknown facts, unverified completeness, unresolved target interpretation, or an unavailable stage make a negative conclusion indeterminate. A source dependency is not an architectural fact.

Policies target the selected stage, defaulting to planned for a plan and recorded for a state. The reconstructed recorded stage of a plan is not a policy evaluation target. There is no policy predicate that proves drift from a cross-input comparison.

## Per-target outcomes

A selected assertion can pass, violate, or be indeterminate for each target. A Policy with no selected targets has zero evaluations and is `not_evaluated`; that is not a per-target pass. A confirmed violation takes precedence in a mixed result. If no policy is selected, `run` makes no compliance claim.

| `run` exit | Policy or operation result |
| --- | --- |
| `0` | Analysis succeeded and every selected policy passed. |
| `1` | A selected policy was violated. |
| `2` | Command use was invalid. |
| `3` | Input refused, or a selected policy was indeterminate or decided nothing. |
| `4` | Export or server failed. |

SARIF output records diagnostics and explicitly evaluated policy results. The JSON architecture document remains evidence rather than a policy verdict. See [Outputs and exit status](../../reference/outputs.md).
