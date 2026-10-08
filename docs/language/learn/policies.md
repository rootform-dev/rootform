---
title: "Policies over facts"
description: "Understand how Policy assertions use established architecture facts without mistaking uncertainty for absence."
---

A Dialect establishes architecture. A Policy asks whether that architecture
satisfies an authored assertion. It does not inspect raw Terraform attributes,
repair interpretation, or contact a provider.

The subnet example asks whether an interpreted subnet has network Context:

```rf title="policies/subnet-network-context.rf.hcl"
policy "subnet-network-context" {
  target {
    concept = rf.concept.subnet
  }

  assert = exists(contexts(rf.context.network, rf.concept.virtual-network))
  message = "Subnets must have an established virtual network context."
}
```

This Policy belongs to the source root containing its `policy_pack` manifest.
`target` selects instances by Concept, applied Rule or both; an owner filter
can narrow that selection. It does not select arbitrary raw resource types.
Possible target interpretations that remain unsettled are retained as uncertain
evaluations. [Policy target selection](../reference/evaluation.md#policy-target-selection)
defines the coverage behavior.

## Query the claim you intend

`contexts` and `relations` query direct outgoing facts on the selected instance.
`contributions` queries incoming contributions from a specified contributor.
For example, a bucket Policy asks about its incoming versioning Contribution.
Queries do not follow placement or Relations transitively.

A query target filter names the emission's exact `to` contract. A Concept and
a Rule are not interchangeable filters merely because one instance carries both.
[Built-ins](../reference/built-ins.md) defines all five functions.

## Presence and absence need different proof

One confirmed fact makes `exists` true even when another endpoint remains
unresolved. Zero facts make it false only when the query is supported and its
relevant closures and population are complete. Missing emission coverage or an
indeterminate closure makes the empty result unknown. Negating that unknown
result cannot prove absence.

`length` needs complete evidence for an exact count. Some numeric assertions
can still be proved from a known lower bound: at least one confirmed fact proves
`length(...) >= 1`, but not `length(...) == 1` when more facts remain unresolved.

A known-true assertion passes, known-false violates, and unknown is
indeterminate. A Policy with no targets makes no decision. None of these
outcomes writes back into the Form. Use
[Understand Policy outcomes](../../guides/check-architecture.md) to run the
same assertion through pass, violation, uncertainty and zero targets.

## Keep the semantic environment fixed

Policy source uses qualified references. Linking resolves them against the
Form's recorded semantic identities and produces exact pins. A compiled Pack
with different pins is refused, not silently relinked. Policies evaluate a
selected architecture stage: normally Planned for a plan and Recorded for a
state. A comparison Form evaluates its two selected sides by default.

Continue with [Write a Policy Pack](../write-policy-pack.md).
[Evaluation](../reference/evaluation.md) owns exact truth tables and exit status.
