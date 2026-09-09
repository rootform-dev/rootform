---
title: "Evaluation"
description: "Reference for rule selection, fact resolution, composition completeness, and policy decision behavior."
---

Rootform language has two evaluation stages. Dialect rules participate in
architecture compilation. Policy assertions evaluate later over validated,
autonomous Architecture IR.

## Rule selection

For each normalized source declaration, Rootform evaluates available rules in
stable order. A rule matches only when:

1. `match.kind` equals the declaration category;
2. `match.type` equals the declaration type;
3. the declaration's provider is eligible for the rule's Dialect;
4. optional `where` produces known `true`.

A source-matching Dialect with no provider declaration is invalid. Zero matching
rules leaves the declaration unrepresented or filtered according to source
accounting. One match classifies it. More than one match fails the declaration
with `AMBIGUOUS_RULE_MATCH`; Rootform does not choose by order.

### Unknown predicate values

Predicates read bounded source-adapter scalar evidence. Missing values,
unevaluated source expressions, and incompatible types are unknown.

Logical evaluation uses useful three-value decisions:

| Expression | Result with unknown side |
| --- | --- |
| `false && unknown` | known `false` |
| `true && unknown` | unknown |
| `true \|\| unknown` | known `true` |
| `false \|\| unknown` | unknown |
| `!unknown` | unknown |

Only known `true` selects a rule.

## Fact resolution

After classification, a fact follows its `via` path. A direct source or
provider reference can establish a target declaration. A fact-level match can
compare known scalar values using `exact` or `dot-ancestor`.

Rootform preserves resolved fact provenance. It does not infer missing contexts
or relations from concept names. Known absent optional source configuration
closes an applicable emission with an omission. Present but unknown, ambiguous,
partially dangling, or incomparably matched evidence produces an
emission-scoped diagnostic. It never becomes proof of absence.

Fact graph constraints are checked during language compilation:

- context targets are entities or scopes;
- contribution sources are details and targets are entities or scopes;
- relation endpoints are entities or scopes.

## Composition resolution

Composition members resolve in authored order. Every declared member is
required. If one member is absent, mismatched, conflicting, or unresolved, the
composition produces no partial representation. The root declaration fails and
members already consumed return to ordinary declaration accounting.

A complete composition produces one representation with ordered member
provenance. Member source declarations are accounted as supporting that
composition.

## Policy preflight

Before evaluating policies, Rootform verifies run boundary:

- no duplicate selected Policy Pack identity;
- each compiled pack's exact Dialect version and semantic digest matches IR;
- every referenced concept, context, and relation exists in IR snapshot;
- every active representation/emission pair has fact, omission, or diagnostic
  closure;
- policy and work limits are not exceeded.

A run-level preflight failure makes whole run indeterminate and clears partial
findings. Emission-scoped uncertainty affects only queries that depend on it,
so unrelated determinate evaluations remain visible.

## Target iteration

Each policy runs once for every entity, scope, or detail representation whose
concept exactly equals `target`.

```hcl title="pack.rf"
target = concept.core.subnet
```

One policy and three `core/subnet` representations produce three evaluations.
No matching representation produces zero evaluations. Zero is not a pass and
does not prove target coverage.

Targets and findings are emitted in canonical stable order.

## Query evaluation

Queries inspect one hop of Architecture IR from the current target:

- `contexts` reads outgoing context facts;
- `relations` reads outgoing relation facts;
- `contributions` reads incoming contribution facts.

Each query yields confirmed fact IDs plus support and completeness. Vocabulary
must exist, current active rules must support exact query shape, and every
applicable emission must close without unknown evidence before an empty answer
means zero. `contexts` and `relations` inspect outgoing closure. Incoming
`contributions` ranges only over contributor representations present in this
IR and their active rules; it makes no provider-wide or Terraform-wide coverage
claim.

`length(q)` is known only for supported complete query. `exists(q)` is known
true as soon as one confirmed fact exists, known false only for supported
complete empty query, and indeterminate otherwise. Each consulted fact,
emission, or omission ID enters evaluation's `inspected` list. Policies cannot
inspect fact fields or traverse onward.

## Outcomes

| Outcome | Condition | Finding |
| --- | --- | --- |
| `passed` | Assertion is known `true` | Evaluation only |
| `violated` | Assertion is known `false` | Evaluation plus violation using authored message |
| `indeterminate` | Rootform cannot produce a trusted Boolean decision | Diagnostic; no compliance claim |

A violation records pack/policy identity, target, Policy Pack source path and
line, message, and inspected fact IDs. Its source location points to policy
source, not Terraform/OpenTofu source. Follow target and fact provenance to
inspect infrastructure evidence.

An indeterminate per-target assertion records `POLICY_ASSERTION_UNKNOWN`. A
whole-run failure records one reason and clears partial evaluations and
violations. Boolean operators use three-valued logic: known `false` decides
`&&`, known `true` decides `||`, and `!unknown` remains unknown.

Global status is `compliant`, `violated`, `indeterminate`, or `not_evaluated`.
A policy with zero targets contributes coverage but no fake evaluation. Mixed
runs retain determinate results. Violation takes precedence; otherwise any
indeterminate evaluation, then any policy without targets, prevents compliance.

## Exit behavior

For `rootform check`, exit status is:

| Status | Meaning |
| --- | --- |
| `0` | Every selected policy evaluated and passed |
| `1` | One or more known violations |
| `2` | Incorrect command use |
| `3` | Verdict unavailable: indeterminate or not evaluated |

Zero selected policies, zero total evaluations, or any selected policy with no
target cannot produce compliance.

## Bounded work

One run accepts at most 1,024 policies, 100,000 evaluations, and 100,000
inspected fact references. An assertion is limited to 4,096 source bytes.
Exceeding a bound produces `POLICY_LIMIT_EXCEEDED`, clears partial findings,
and returns an indeterminate result.

Policies never read Terraform payloads, plans, state, variables, provider APIs,
or renderer state. Their evidence boundary is validated Architecture IR.
