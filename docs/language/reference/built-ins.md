---
title: "Built-ins"
description: "Exact signatures and three-valued semantics for Rootform policy queries, exists, and length."
---

Policy assertions expose three fact queries and two consumers. Queries cannot
appear bare or be inspected element by element.

```text title="Built-in grammar"
exists(contexts(context.DIALECT.NAME, concept.DIALECT.NAME))
exists(relations(relation.DIALECT.NAME, concept.DIALECT.NAME))
exists(contributions(concept.DIALECT.NAME))
length(query)
```

Every reference is qualified and its owner must be a direct Policy Pack
requirement. Unknown concepts, contexts, or relation predicates fail linking
before evaluation.

## Query value

Each query returns opaque confirmed fact IDs plus `supported` and `complete`.

| Consumer | Known result |
| --- | --- |
| `length(q)` | Fact count only when `supported && complete` |
| `exists(q)` | `true` with any confirmed fact; `false` only for supported complete zero |

Unsupported or incomplete factless query is indeterminate. `!` preserves that
state. One unresolved applicable emission keeps query incomplete even when
another emission proves no fact.

## Outgoing contexts

```hcl
exists(contexts(context.core.network, concept.core.virtual-network))
```

`contexts` selects outgoing context facts from current policy target with exact
dimension and exact concept on `to`. It does not recurse.

## Outgoing relations

```hcl
exists(relations(relation.core.private-reachability, concept.core.virtual-network))
```

`relations` selects outgoing relation facts from current target with exact
qualified predicate and exact target concept. Direction matters. Predicate is
typed vocabulary, never a string.

## Incoming contributions

```hcl
length(contributions(concept.core.kubernetes-node-pool)) >= 2
```

`contributions` selects incoming facts whose `to` is current target and whose
`from` representation has exact contributor concept. Closure ranges only over
contributor representations present in saved IR and their active rules. Empty
result claims nothing about all Terraform, provider resources, or deployed
infrastructure.

## Complete assertions

```hcl title="Independent assertion examples"
assert = exists(contexts(context.core.network, concept.core.virtual-network))

assert = (
  exists(relations(relation.core.private-reachability, concept.core.virtual-network)) ||
  exists(relations(relation.core.private-reachability, concept.core.subnet))
)

assert = length(contributions(concept.core.kubernetes-node-pool)) >= 2
```

Unsupported forms include bare queries, `count`, free relation strings, wrong
arity, unknown functions, indexing, iteration, splats, and comprehensions.

See [Evaluation](evaluation.md) for target coverage, unknown propagation, and
global status.
