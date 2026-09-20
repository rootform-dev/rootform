---
title: "Rules and matching"
description: "Complete reference for Rule declarations, source matching, all match kinds, classification, and selection precedence."
---

A Rule interprets one normalized source declaration. Successful application
adds Rule identity, may add optional Concept classification, and may emit
architecture facts or claim composition members.

## Complete example

```hcl title="reference/dialect.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/example" {
    version = ">= 1.0.0, < 2.0.0"
  }
}

concept "application" {
  description = "A deployable application."
}

rule "web-service" {
  match {
    kind  = "resource"
    type  = "example_service"
    where = source.enabled == true && source.replicas >= 2
  }

  as = concept.application
}
```

## `rule` block

| Property | Contract |
| --- | --- |
| Placement | Top level of a Dialect source root |
| Cardinality | Zero or more |
| Labels | Exactly one required Rule name |
| Attributes | Optional `as` |
| Nested blocks | Exactly one `match`; zero or more emissions; zero or one `composition` |

### Parameters

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| Label | Identifier | Yes | None | Lowercase kebab case, 1-64 bytes; unique within Dialect |
| `as` | Concept reference | No | No Concept | Local/current-owner or supported `rf.concept.*` reference |

### Nested blocks

| Block | Cardinality | Purpose |
| --- | --- | --- |
| `match` | Exactly 1 | Select source declarations |
| `context` | 0 or more | Emit directed Context facts |
| `relation` | 0 or more | Emit directed Relation facts |
| `contribution` | 0 or more | Emit directed Contribution facts |
| `composition` | 0 or 1 | Claim ordered implementation members |

A Rule must provide architecture meaning through at least one of:

- `as`;
- one or more emissions;
- a nonempty `composition`.

A match-only Rule is invalid with `RULE_NO_ARCHITECTURE`. A Rule has no
`description` attribute. Its name and source type do not implicitly create a
Concept.

## `match` block

```hcl title="match block"
match {
  kind  = "resource"
  type  = "example_service"
  where = source.enabled == true && source.replicas >= 2
}
```

| Property | Contract |
| --- | --- |
| Placement | Exactly once inside `rule`; exactly once inside each composition `member` |
| Cardinality | Exactly one at either placement |
| Labels | Forbidden |
| Attributes | `kind`, `type`, `where` |
| Nested blocks | None |

### Parameters

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `kind` | Static string enum | No | `"resource"` | One of 15 values below |
| `type` | Static string | Yes | None | Nonempty, exact adapter-owned declaration type |
| `where` | Predicate expression | No | Equivalent to known `true` | Must follow [predicate grammar](expressions.md#predicate-expressions) |

`type` is case-sensitive and exact. RF does not glob, prefix-match, or infer
it from Rule name.

## `match.kind` values

Set is closed. Dialects cannot introduce new kinds.

| Value | Normalized source construct | Automatic base representation |
| --- | --- | --- |
| `settings` | Terraform/OpenTofu `terraform` settings block | No |
| `provider` | Provider configuration | No |
| `resource` | Managed resource | Yes |
| `data` | Data source | No |
| `ephemeral` | Ephemeral resource | No |
| `action` | Action block | No |
| `module` | Module call | No |
| `variable` | Input variable | No |
| `local` | Individual local value | No |
| `output` | Output value | No |
| `moved` | Moved declaration | No |
| `removed` | Removed declaration | No |
| `import` | Import declaration | No |
| `check` | Check block | No |
| `language` | OpenTofu `language` settings block | No |

Current Terraform and OpenTofu adapters expose a nonempty declaration
`type` for managed resources, data sources, ephemeral resources, and actions.
Other kinds remain part of RF's closed kind vocabulary but require source
adapter evidence with a nonempty type before a Rule can match them.

Only `resource` receives a base representation without a Rule. Every other
kind receives a representation only after one Rule applies successfully.
Therefore resource coverage and Rule coverage are different measurements.

## Classification with `as`

```hcl title="optional Concept classification"
as = concept.application
as = rf.concept.virtual-network
```

`as` attaches exactly one Concept to representation. It is optional when Rule
emits facts or has composition. RF has no Concept inference, inheritance, union,
or list classification.

Local reference resolves only in current Dialect. Qualified reference may name
current owner or an available [RF Vocabulary](rf-vocabulary.md) Concept.

## Eligibility pipeline

For each source declaration and Rule, Rootform evaluates:

1. `kind` equality;
2. exact `type` equality;
3. declared provider source compatibility;
4. exact provider version compatibility when exact evidence exists;
5. optional `where` predicate.

Kind, type, or unrelated provider-source mismatch rejects candidate silently.
Missing provider identity can be indeterminate when Dialect has a compatible
provider envelope. Known exact version outside envelope marks candidate
incompatible. Unknown predicate input never becomes `false`; candidate is
indeterminate.

## Selection precedence

After all candidate Rules are classified for one declaration, outcome uses this
precedence:

| Priority | Condition | Result |
| --- | --- | --- |
| 1 | More than one accepted Rule | `AMBIGUOUS_RULE_MATCH`; no Rule applies |
| 2 | Any predicate-indeterminate candidate | `PREDICATE_UNRESOLVED`; no Rule applies |
| 3 | Any provider-unresolved candidate | `PROVIDER_IDENTITY_UNRESOLVED`; no Rule applies |
| 4 | Exactly one accepted Rule | Rule applies |
| 5 | One or more version-incompatible candidates | `PROVIDER_VERSION_INCOMPATIBLE`; no Rule applies |
| 6 | No candidate remains | No Rule applies, without match diagnostic |

This precedence means one accepted Rule is not selected around a predicate or
provider uncertainty. Version-incompatible candidates do not block a sole
accepted Rule because accepted selection has higher precedence. There is no
priority by file order, package origin, or Rule name.

See [Evaluation](evaluation.md#rule-selection) for representation and policy
effects.

## Rejected forms

This complete source has a match-only Rule:

```hcl title="invalid/match-only.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/example" {
    version = ">= 1.0.0"
  }
}

rule "no-architecture" {
  match {
    type = "example_service"
  }
}
```

It produces `RULE_NO_ARCHITECTURE`.

A bare traversal is not a Boolean predicate:

```hcl title="invalid predicate"
where = source.enabled
```

Use an explicit comparison such as `source.enabled == true`. Bare traversal
produces `PREDICATE_UNRESOLVED`.
