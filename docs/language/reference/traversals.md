---
title: "Traversals and scope"
description: "Attribute path grammar, roots, instance values, and saved-plan reference evidence."
---

A traversal names an attribute path read by a Rule predicate, emission, or composition member. It does not name a Concept, Context, Relation, or Rule; those use [typed references](symbols.md).

## Grammar

```ebnf
traversal   = simple-root, step, { step }
            | "member", ".", member-name, step, { step } ;
simple-root = "source" | "provider" | "target" ;
step        = ".", attribute-name | "[", non-negative-integer, "]" ;
```

```rf title="Valid traversals"
source.vpc_id
source.metadata[0].name
target.name
provider.host
member.proxy.backend_id
```

Every root needs a path step. `member.proxy` alone is incomplete.

## Path steps

### Attribute step

Attribute names follow the input schema and match `[A-Za-z_][A-Za-z0-9_]*`, with a 64-byte maximum. They need not follow the kebab-case names of Rootform language definitions. A path such as `source.metadata[0].name` can walk a nested planned-value block represented as a list.

### Index step

`[0]` is a static, nonnegative signed 64-bit integer index. String keys, negative or computed indexes, slices, and splats are invalid authored traversal paths. For example, `source.tags["Name"]`, `source.items[-1]`, and `source.items[*].id` do not compile. A resource instance address may itself have a `count` index or `for_each` key; that exact address is part of the plan/state instance identity, separate from the authored attribute path. Rootform does not collapse `aws_subnet.app[0]` and `aws_subnet.app[1]` into one target.

## Roots

`source` names the current candidate or emitting instance. `provider` names its bound provider configuration. `target` names a candidate during emission identity comparison. `member.<name>` names an earlier accepted composition member. The same `source` spelling reads the candidate in `match.where` and the Rule root in emission `via`.

## Root availability

| Position | Accepted root | Meaning |
| --- | --- | --- |
| Rule or member `match.where` | `source` | Candidate instance values |
| Emission `via` | `source`; `provider` only without nested `match` | Emitting instance or its bound provider configuration |
| Emission `match.by` | `target` | Candidate target instance's declared identity attribute |
| Composition member `via` | `source`, or `member.<name>` for an earlier member | Root or already accepted member |

`provider` follows the configuration block bound to the source instance, including aliases and module inheritance. It is not a free provider identity field. A root in the wrong position produces `INVALID_REFERENCE`, `FACT_INVALID`, or `COMPOSITION_INVALID` according to its enclosing declaration.

## Traversal use by position

### Predicate scalar inspection

`where = source.enabled == true` can decide a Rule only when the read value is a known supported scalar. Missing, unknown, sensitive, collection-valued, or type-incompatible values make the predicate indeterminate. [Expressions](expressions.md#predicate-expressions) defines the Boolean grammar.

### Fact reference resolution

`via = source.vpc_id` reads evaluated planned or recorded values. A known string or number can match a target Rule's declared identity. Null and empty values follow the emission's required `on_null` and `on_empty` declarations. An undefined attribute on the emitted instance produces `EMISSION_PATH_UNDEFINED`; it does not prove absence.

### Provider configuration resolution

`via = provider.host` can identify a managed endpoint only when a verified saved plan shows a direct reference or supported pass-through in the bound provider block. Without that reference, the closure is `indeterminate(unavailable)`. Rootform never reads a literal provider configuration value, because plan exports do not provide the provider schema needed to classify it safely. This also applies to state input, historical plan stages, OpenTofu provider `for_each`, and JSON provider configuration syntax.

### Explicit target comparison

`match.by = target.name` is legal only inside an emission's nested match, and `name` must be in the target Rule's `identity.attributes`. See [Fact emissions](emissions.md#explicit-attribute-match).

### Composition chaining

`member.proxy.backend_id` can chain only from an earlier accepted member in the same composition. See [Composition](composition.md#member-block).

## Value and identity evidence

A plan JSON supplies evaluated values; a paired saved plan supplies a configuration snapshot. With `rootform run plan.json --plan-file plan.tfplan`, Rootform verifies the pairing, then may follow a bare reference or a single interpolation through variables, locals, and module outputs to an exact instance endpoint. A tuple written directly at the emitted attribute or within one static block can pair its elements separately. This is available on the `planned` stage only. A function, operator, conditional, `try`, splat, dynamic block, or computed index can remain dependency evidence but cannot prove endpoint identity.

| Evidence | Fact's `evidence` field |
| --- | --- |
| Evaluated value uniquely matches declared target identity | `value` |
| Verified reference names a declared endpoint | `traversal` |
| Both agree on the same instance | `both` |

A disagreement yields `EVIDENCE_CONFLICT` and `indeterminate(reference_ambiguous)`. Unknown or sensitive values are never printed to resolve a conflict. Plan JSON, saved plans, and state JSON may contain clear-text secrets; keep them out of Git and public artifacts.

## Resolution states

A path can yield a known value, known null/empty, unknown until apply, sensitive, unavailable, or undefined. The emitting Rule's closure converts these to `resolved`, `absent`, or `indeterminate` according to its declarations and target candidates. An unresolved candidate cannot be dropped merely because another candidate matches. [Omission and uncertainty](emissions.md#omission-and-uncertainty) gives the exact closure consequences.

## Rejected roots and forms

`source` and `provider` have no path step. `target.name` outside `match.by`, `member.future.id` before `future` is accepted, and a Terraform address such as `aws_vpc.main.id` are not valid authored traversals. Run [source validation](../test-validate.md#compile-a-dialect-source-set) before testing plan fixtures.
