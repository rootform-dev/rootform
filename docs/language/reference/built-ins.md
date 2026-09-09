---
title: "Built-ins"
description: "Exact signatures and semantics for Rootform policy queries and length."
---

Policy assertions expose four built-in names in one fixed composition:
`length(query)`. There is no general function library and no user-defined
function mechanism.

## Supported shape

```text title="Built-in grammar"
length(contexts(context.DIALECT.NAME, concept.DIALECT.NAME))
length(relations("relation-type", concept.DIALECT.NAME))
length(contributions(concept.DIALECT.NAME))
```

The inner query returns opaque matching fact IDs for the current policy target.
It cannot be used by itself or inspected element by element. `length` returns
the number of IDs so the assertion can compare it with an integer.

## Count matches with length

| Signature | Result |
| --- | --- |
| `length(query)` | Signed integer count of matching facts |

Exactly one argument is required, and it must be one of the three query calls
below. Strings, traversals, nested `length`, and other calls are invalid
arguments.

An empty, answerable query returns `0`. It is not unknown.

## Query contexts

```hcl title="pack.rf"
length(contexts(context.core.network, concept.core.virtual-network))
```

| Argument | Meaning |
| --- | --- |
| 1 | Dialect-qualified context dimension |
| 2 | Dialect-qualified concept of the context target |

The query selects **outgoing context facts** whose `from` endpoint is the
current policy target, whose dimension matches the first argument, and whose
`to` representation has the second argument's exact concept.

It does not search ancestors recursively and does not ask whether the current
target itself has the concept in the second argument.

## Query relations

```hcl title="pack.rf"
length(relations("private-reachability", concept.core.virtual-network))
```

| Argument | Meaning |
| --- | --- |
| 1 | Literal lower-kebab relation type |
| 2 | Dialect-qualified concept of the relation target |

The query selects **outgoing relation facts** whose `from` endpoint is the
current policy target, whose relation type matches the string, and whose `to`
representation has the requested exact concept.

Direction matters. A matching incoming relation is not returned.

## Query contributions

```hcl title="pack.rf"
length(contributions(concept.core.kubernetes-node-pool))
```

| Argument | Meaning |
| --- | --- |
| 1 | Dialect-qualified concept of the contributor |

The query selects **incoming contribution facts** whose `to` endpoint is the
current policy target and whose contributing `from` representation has the
requested exact concept.

This direction differs from `contexts` and `relations`: a policy asks which
details contribute to its target.

## Complete assertions

```hcl title="Independent assertion examples"
# Choose one assertion for each policy.
assert = length(contexts(context.core.network, concept.core.virtual-network)) > 0

assert = (
  length(relations("private-reachability", concept.core.virtual-network)) > 0 ||
  length(relations("private-reachability", concept.core.subnet)) > 0
)

assert = length(contributions(concept.core.kubernetes-node-pool)) >= 2
```

Every concept and context argument must name a Dialect in the pack's direct
`requires`, and the loaded semantics must declare it. Unknown vocabulary makes
the run indeterminate rather than returning an empty collection.

The following forms are not supported:

```hcl title="Unsupported forms"
assert = contexts(context.core.network, concept.core.virtual-network)
assert = count(contexts(context.core.network, concept.core.virtual-network)) > 0
assert = length(contexts(context.core.network)) > 0
assert = length(resources(concept.core.subnet)) > 0
```

See [Evaluation](evaluation.md) for target iteration and inspected fact IDs.
