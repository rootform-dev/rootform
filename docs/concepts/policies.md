---
title: "Policies and Policy Packs"
description: "Understand what a Policy proves over Architecture IR, how Policy Packs are selected, and what each outcome means."
---

A Policy asks whether the facts established in an architecture satisfy a
requirement. It runs after [Dialects](dialects.md) interpret the source, and it
never contacts a cloud provider. A Policy can check whether every represented
subnet has an established network context; it cannot test live connectivity or
invent a missing fact.

## Source stays portable

Every Policy belongs to one independent Policy Pack, which distributes related
Policies under a shared name and version. Pack source declares the pack name, its
version, and its Policies, and nothing else. It records no RF Vocabulary or
Dialect versions; those dependencies are derived when the pack is linked.

Pack ownership comes from the source root: one top-level `policy_pack` manifest
names the pack, and top-level `policy` blocks beneath that root belong to it.
Policy identity is owner-first, so `tutorial.policy.subnet-network-context`
identifies the Policy `subnet-network-context` in the pack `tutorial`. File and
folder names create no identity.

## Target representation

A Policy target selects the representations it evaluates along three dimensions:
`concept`, `rules`, and `dialects`. Values inside a list are ORed, dimensions
are ANDed, and at least `concept` or `rules` is required.

```hcl title="Policy target"
target {
  concept  = rf.concept.kubernetes-cluster
  rules    = [aws.rule.eks-cluster, google.rule.gke-cluster]
  dialects = [aws, google]
}
```

`concept` examines the classification established on a representation, `rules`
examines an applied Rule, and `dialects` filters the owner of that
interpretation. `rf` cannot appear in `dialects`, because RF Vocabulary is not a
Dialect. A base without a selected Concept or applied Rule is never matched by
its source type, and a composition member does not inherit its root's
eligibility. One selected representation is evaluated once.

## Read outcomes

Each evaluation ends in `passed`, `violated`, or `indeterminate`:

| Outcome | Meaning |
| --- | --- |
| `passed` | The assertion is known true for the target. |
| `violated` | The assertion is known false for the target. |
| `indeterminate` | Valid evidence cannot establish the Boolean. |

A violation reports the authored message, the target, the source location of the
assertion, and the inspected fact identities. A diagnostic explains a compile,
linking, or evidence failure. Rootform never turns an unknown into a pass or a
violation.

### Zero evaluations are not approval

A check with no selected pack reports:

```text
status not_evaluated; 0 policies, 0 evaluations, 0 passed, 0 violated, 0 indeterminate, 0 not evaluated
```

A selected Policy whose target matches no representation also contributes zero
evaluations and is counted as not evaluated. Neither case produces a governance
verdict, and both exit 3. In a mixed run the other evaluations stand, but the run
cannot become compliant while one selected Policy has no target.

## Use as a gate

```sh
rootform check . --policy-pack ./policies
rootform check architecture.json --policy-pack pack.json --format json
```

| Status | Gate meaning |
| --- | --- |
| `0` | Every selected Policy evaluated and passed. |
| `1` | At least one Policy was violated. |
| `2` | The command was used incorrectly. |
| `3` | Verdict unavailable: indeterminate, not evaluated, or missing evidence. |

Accept the expected Policy selection and evaluation coverage, not only the exit
status. A violation takes precedence in a mixed run, so exit 1. SARIF reports
violations as errors, and Policies carry no author-defined severity.

## Select Policy Packs explicitly

`rootform build` and `rootform run` ignore Policy Packs, so governance selection
never changes Architecture IR. `check` evaluates packs recorded in
`rootform.lock`; `--policy` can narrow that selection. A local source or compiled
pack passed with `--policy-pack` replaces project pack selection for that
invocation without being installed or added to the lock. Linking resolves
qualified references against the exact Architecture IR semantic snapshot and
records owner versions plus content and semantic digests. A linked artifact
whose pins disagree with the evaluated document fails closed, with no relink
and no fallback. See
[Add a third-party Dialect or Policy Pack](../guides/external-content.md) for
installation and vendoring.

## Know the scope of a claim

A Policy proves only its assertion over facts available in that architecture.
A missing fact is known absent only when relevant emission closure establishes
that absence. Incomplete evidence produces an indeterminate result instead. In
either case, the result does not prove an opposite real-world condition. Review
target coverage and evidence assumptions before adopting a pack as a gate.

Continue with [Check an architecture](../guides/check-architecture.md),
[Write a Policy Pack](../language/write-policy-pack.md), or
[Policy Packs](../language/reference/policy-packs.md).
