---
title: "Fact emissions"
description: "How a Dialect emits Context, Relation, and Contribution facts from plan or state evidence."
---

A Rule emits directed facts from one represented instance to another endpoint. `context` names a placement dimension, `relation` names a predicate, and `contribution` names a target without a dimension or predicate. `to` constrains the target's Rule or Concept. `via` reads the emitting instance's evidence. A source dependency alone is not an architectural relation.

## Forms and parameters

```rf title="Emission examples"
context {
  as        = rf.context.network
  to        = rf.concept.virtual-network
  via       = source.network_id
  on_null   = "absent"
  on_empty  = "absent"
  external  = "deny"
}

relation "reads-from" {
  to        = concept.database
  via       = source.database_id
  on_null   = "absent"
  on_empty  = "indeterminate"
  external  = "deny"
}

contribution {
  to        = concept.database
  via       = source.database_id
  on_null   = "absent"
  on_empty  = "absent"
  external  = "deny"
}
```

All three forms require `to`, `via`, `on_null`, and `on_empty`. Context and Relation take either a label or `as`, exactly one. Contribution takes neither. `via` starts at `source` or `provider`. A missing attribute path produces `EMISSION_PATH_UNDEFINED`; a value with an unsupported shape produces `VIA_VALUE_SHAPE`.

`on_null` and `on_empty` each accept `"absent"` or `"indeterminate"`. They declare what a known null, or an empty string, list, or map means. Unknown values remain `indeterminate(unknown_until_apply)` and masked values remain `indeterminate(sensitive)` regardless of these declarations. A known list fans out element by element. Proven elements can yield facts while another element leaves the closure indeterminate.

## Matching target identities

A `match` block compares `via` with identity attributes declared by a target Rule:

```rf title="Matching a target"
context {
  as        = context.ownership
  to        = concept.namespace
  via       = source.namespace_name
  on_null   = "absent"
  on_empty  = "indeterminate"
  external  = "deny"

  match {
    by       = [target.name, target.display_name]
    strategy = "exact"
  }
}
```

`by` is a nonempty ordered list of target attribute traversals. A single traversal is also accepted. Each path must be one of the target Rule's declared identity attributes. Rootform tries paths in order. `strategy` is `"exact"`, `"dot-ancestor"`, or `"last-segment"`; the last option compares the final `/`-separated segment of the value. An eligible target with unknown, sensitive, or unavailable identity cannot be discarded to force a unique match. If its value cannot be compared, the closure can be `indeterminate(uncomparable_candidate)`; duplicate known identities produce `DUPLICATE_IDENTITY`.

`prefix` removes a declared prefix from the emitting value before a `match` comparison and requires a `match` block. It does not change the target identity. A known value and a verified identity traversal that point to different targets produce `EVIDENCE_CONFLICT` rather than a fact.

## Traversal evidence

`--plan-file` verifies a saved plan against its JSON export and reads the plan's configuration snapshot. For a bare traversal or a single interpolation passing through variables, locals, or module outputs, the snapshot can pair a reference with its target instance. This evidence is available on the `planned` stage, even when the value is unknown, shared by several candidates, or crosses providers. `evidence` on a fact is `value`, `traversal`, or `both`. A tuple written directly at an emitted attribute, or inside one static block, such as `[a.id, b.id]`, pairs elements separately. A transformed expression or dynamic index does not establish traversal identity; the closure follows its evaluated value, such as `indeterminate(unknown_until_apply)` for a value computed at apply. `indeterminate(reference_ambiguous)` means the evaluated value and verified traversal name different endpoints, with an `EVIDENCE_CONFLICT` warning.

### Provider configuration references

An emission such as `via = provider.host` follows the provider configuration block named for the emitting resource. With a verified saved plan, on the `planned` stage, a direct reference in that provider attribute to a managed resource endpoint can establish a fact with `traversal` evidence. Pass-through through variables, locals, or module outputs in the provider block's module is accepted. The target is paired as a reference written once in that module; provider blocks are not expanded into resource instances.

Without a verified saved plan, on state input, or on a `refreshed` or `recorded` stage, the closure is `indeterminate(unavailable)`. A literal or transformed provider attribute also yields `indeterminate(unavailable)`. An OpenTofu provider block with `for_each` and a provider block written in JSON configuration syntax establish no endpoint. Rootform never reads literal provider configuration values: plan exports carry no provider schema, so a literal cannot be classified as sensitive or safe to expose.

## External endpoints and disclosure

`external = "deny"` is the default. `external = "allow"` permits an endpoint for a known unmatched value only when no eligible in-scope candidate remains unresolved. Put a nearby comment explaining why the referenced target can exist outside the plan or state inventory. An external endpoint states a declared reference, not verification of a remote object.

With `external = "allow"`, `disclose` can be `"none"`, `"record"`, or `"report"`. `none` keeps external identity only in memory; `record` allows it in the Rootform JSON document; `report` also allows it in human-readable output. Sensitive values never enter any tier. If several emissions reach one external endpoint, the most restrictive tier wins. `external_denied` records a known unmatched value under the default policy.

Each source instance and emission has a closure with outcome `resolved`, `absent`, or `indeterminate`. Its reason and candidate counts explain why a fact was or was not established. See [Architecture documents](../../concepts/architecture-ir.md) for serialized closure and provenance fields.
