---
title: "Evaluation"
description: "Normative RF evaluation order for Rule selection, representation, composition, facts, Policy queries, outcomes, and exit status."
---

RF evaluation fails closed. Unknown evidence remains unknown; it is never
converted to false, absence, or compliance.

## Architecture evaluation pipeline

Rootform builds Architecture IR in this order:

1. normalize source declarations;
2. classify Rule candidates and select at most one Rule per declaration;
3. apply or roll back composition;
4. create representations, first guaranteeing every managed-resource base,
   then attaching applied Rule, optional Concept, and composition meaning;
5. derive Context, Relation, and Contribution facts;
6. close source accounting, validate, and serialize autonomous Architecture IR.

Policies run later against validated Architecture IR. They do not reopen source
files or Dialect source.

## Base representation

Every normalized managed resource gets representation, even with no applicable
Rule or failed interpretation. This preserves resource coverage and source
provenance.

Other source kinds get representation only when Rule applies successfully.
Concept is always optional. Result can therefore have:

- represented resource without Rule;
- represented declaration with Rule and no Concept;
- represented declaration with Rule and Concept;
- represented composition root;
- source declaration without representation.

Resource coverage, Rule coverage, and Concept coverage are distinct.

## Rule selection

Each Rule candidate first checks kind, type, provider source, exact provider
version when available, then optional predicate. Candidate state is accepted,
rejected, predicate-indeterminate, provider-unresolved, or
version-incompatible.

Selection precedence for one declaration:

| Priority | Candidate set | Outcome |
| --- | --- | --- |
| 1 | More than one accepted | `AMBIGUOUS_RULE_MATCH` |
| 2 | Any predicate-indeterminate | `PREDICATE_UNRESOLVED` |
| 3 | Any provider-unresolved | `PROVIDER_IDENTITY_UNRESOLVED` |
| 4 | Exactly one accepted | Apply Rule |
| 5 | Any version-incompatible | `PROVIDER_VERSION_INCOMPATIBLE` |
| 6 | None | No Rule |

Higher row wins. For example, one accepted Rule plus one predicate-indeterminate
Rule is indeterminate, while one accepted Rule plus one version-incompatible
Rule applies accepted Rule.

Kind, type, and unrelated provider-source mismatches are ordinary rejected
candidates and produce no diagnostic. There is no Rule priority or first-match
behavior.

## Predicate truth

Predicate comparisons use known string, Boolean, or signed integer scalars.
Equality requires same type; ordering requires integers.

Boolean operators use three-valued logic:

| A | B | `A && B` | <code>A &#124;&#124; B</code> |
| --- | --- | --- | --- |
| `true` | `true` | `true` | `true` |
| `true` | `false` | `false` | `true` |
| `false` | `true` | `false` | `true` |
| `false` | `false` | `false` | `false` |
| `true` | `unknown` | `unknown` | `true` |
| `false` | `unknown` | `false` | `unknown` |
| `unknown` | `true` | `unknown` | `true` |
| `unknown` | `false` | `false` | `unknown` |
| `unknown` | `unknown` | `unknown` | `unknown` |

`!unknown` is unknown. Known `false` decides conjunction; known `true`
decides disjunction. Only final known `true` accepts candidate.

## Composition application

Rule without composition applies after selection. Rule with composition applies
only if every ordered member resolves, matches, and remains exclusive.

Composition failure is transactional: selected Rule, Concept, emissions, and
partial membership roll back. Managed-resource base remains. See
[Composition](composition.md#transactional-behavior).

## Fact derivation

Emission runs only for applied Rule representation. For each emission:

1. attempt direct `via` resolution, then use explicit attribute `match` only
   where direct evidence permits fallback;
2. require represented target;
3. require target's applied Rule to satisfy `to`;
4. emit deduplicated fact with provenance.

Results:

| Evidence | Result |
| --- | --- |
| Target proven | Context, Relation, or Contribution fact |
| Source path proven absent | `source_absent` omission |
| Complete explicit comparison with no target | `no_match` omission |
| Unknown, dangling, ambiguous, unrepresented, or mismatched target | Warning and incomplete emission |

Facts and warnings may coexist for partial collections. Omission is positive
evidence that compiler proved no fact for that emission instance. Warning is
not omission.

## Policy linking

Portable Policy Pack source must link against Architecture IR before
evaluation. Linker:

- validates Architecture IR;
- resolves every qualified symbol and owner;
- rejects contradictory target dimensions;
- derives exact semantic owner pins;
- emits deterministic compiled Pack.

At evaluation, language version and every pinned owner kind, version, and
semantic digest must match Architecture IR. Mismatch makes run indeterminate;
Rootform never substitutes another Dialect or relinks silently.

## Policy target selection

Policy target dimensions combine with AND; entries within lists combine with
OR. Only representations with applied Rule can be selected.

Target domain is incomplete when a failed declaration could have satisfied
target or source/selection errors could hide another target. Incomplete target
domain produces `POLICY_TARGET_DOMAIN_INCOMPLETE`; run cannot be compliant.

A Policy selecting zero representations produces no per-target evaluation and
counts as `not_evaluated`. Zero targets never means pass.

## Query truth

Architecture query result carries confirmed facts plus support and completeness.

### `exists(query)`

| Facts | Supported | Complete | Result |
| --- | --- | --- | --- |
| One or more | Any | Any | `true` |
| Zero | Yes | Yes | `false` |
| Zero | No | Any | `Unknown` |
| Zero | Yes | No | `Unknown` |

### `length(query)`

| Supported | Complete | Result |
| --- | --- | --- |
| Yes | Yes | Exact deduplicated fact count |
| No | Any | `Unknown` |
| Yes | No | `Unknown` |

Policy Boolean operators use same three-valued truth table as predicates.
Final unknown assertion produces `POLICY_ASSERTION_UNKNOWN`, never violation
or pass.

## Worked example

Suppose Architecture IR contains:

- `aws_vpc.main`, interpreted by `aws.rule.vpc` as
  `rf.concept.virtual-network`;
- `aws_subnet.application`, interpreted by `aws.rule.subnet` as
  `rf.concept.subnet`;
- subnet `vpc_id` referencing VPC.

Policy:

```rf title="worked Policy"
policy "subnet-has-network" {
  target {
    rules = [aws.rule.subnet]
  }

  assert = exists(
    contexts(rf.context.network, rf.concept.virtual-network)
  )

  message = "Each subnet must declare its virtual network."
}
```

Outcomes:

| Source evidence | Query | Evaluation |
| --- | --- | --- |
| `vpc_id` resolves to represented VPC | One confirmed Context | `passed` |
| `vpc_id` is proven absent | Supported, complete, zero Contexts | `violated` |
| `vpc_id` is unknown or dangling | Incomplete, zero confirmed Contexts | `indeterminate` |
| No subnet representation exists | No target evaluation | `not_evaluated` |

## Per-target outcomes

| Outcome | Meaning |
| --- | --- |
| `passed` | Assertion is known `true` |
| `violated` | Assertion is known `false`; Policy message becomes violation |
| `indeterminate` | Assertion or required evidence cannot be decided |

`not_evaluated` is aggregate count/status for Policy with no selected target,
not a per-target evaluation outcome.

## Aggregate result status

Overall status uses this precedence:

| Priority | Condition | Status |
| --- | --- | --- |
| 1 | At least one confirmed violation | `violated` |
| 2 | Any indeterminate evaluation or diagnostic | `indeterminate` |
| 3 | Any not-evaluated Policy or zero evaluations | `not_evaluated` |
| 4 | Every selected evaluation passed | `compliant` |

Violation takes precedence in mixed run. Only `compliant` sets result
`compliant` Boolean to true.

## `rootform check` exit status

| Exit | Meaning |
| --- | --- |
| `0` | All selected Policies evaluated and compliant |
| `1` | At least one confirmed violation, including mixed runs |
| `2` | Invalid CLI usage |
| `3` | Indeterminate or not evaluated, with no confirmed violation |

Runtime or compilation failure during `check` is indeterminate, not
compliant.

## Determinism and limits

Canonical output ordering does not depend on source discovery order. Facts are
deduplicated while retaining bounded provenance. Exceeding evaluation or
semantic-expansion bound fails closed and clears unsafe partial conclusions.

See [Diagnostics and limits](diagnostics.md#limits) for exact numbers.
