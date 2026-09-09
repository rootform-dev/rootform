---
title: "Evaluation"
description: "Reference for rule selection, fact resolution, composition completeness, and policy decision behavior."
---

The Rootform language has two evaluation stages. Dialect rules participate in
architecture compilation. Policy assertions evaluate later over a validated,
complete Architecture IR document.

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

Rootform preserves resolved fact provenance. It does not infer a missing
context or relation from concept names. Absent optional source configuration
states no fact; invalid, unavailable, or ambiguous evidence remains explicit in
declaration outcomes and diagnostics.

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

Before evaluating any policy, Rootform verifies the complete run boundary:

- no duplicate selected Policy Pack identity;
- every pack's exact Dialect requirement is loaded at the required version;
- every referenced concept and context exists in the loaded vocabulary;
- loaded Dialects exactly match the semantics that produced the architecture;
- the Architecture IR is structurally valid and complete;
- source reference evidence is available;
- policy and work limits are not exceeded.

A preflight failure makes the whole run indeterminate. Rootform discards partial
passes and violations because they would describe an untrusted subset.

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

A valid query with no matches has length `0`. Each matched fact ID is recorded
in the evaluation's `inspected` list. Policies can count those opaque facts but
cannot inspect their fields or traverse onward.

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
violations.

Policy logical evaluation requires both operands to be known. If either side of
`&&` or `||` is unknown, the combined assertion is unknown. This differs from
rule-predicate selection, where a known `false` can decide `&&` and a known
`true` can decide `||`.

## Exit behavior

For `rootform check`, exit status is:

| Status | Meaning |
| --- | --- |
| `0` | Complete run with no violations or indeterminate result |
| `1` | One or more known violations |
| `2` | Incorrect command use |
| `3` | Result is indeterminate |

Check expected policy and evaluation counts in automation. Status `0` with zero
selected policies or zero targets is mechanically successful but does not prove
that an intended requirement ran.

## Bounded work

One run accepts at most 1,024 policies, 100,000 evaluations, and 100,000
inspected fact references. An assertion is limited to 4,096 source bytes.
Exceeding a bound produces `POLICY_LIMIT_EXCEEDED`, clears partial findings,
and returns an indeterminate result.

Policies never read Terraform payloads, plans, state, variables, provider APIs,
or renderer state. Their evidence boundary is validated Architecture IR.
