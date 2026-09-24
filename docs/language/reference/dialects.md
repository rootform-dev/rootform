---
title: "Dialect declarations"
description: "Complete reference for Dialect identity, provider envelopes, Concepts, Contexts, and Relations."
---

A Dialect is one named and versioned interpretation unit. Its Rules add
architecture meaning to normalized source declarations.

Definitions and Rules are top-level siblings of the `dialect` block. Only
`provider` blocks are nested inside `dialect`.

## Complete layout

```rf title="example-dialect/dialect.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/example" {
    version = ">= 1.0.0, < 2.0.0"
  }
}

concept "application" {
  description = "A deployable application service."
}

context "runtime" {
  description = "The runtime selected for an application."
}

relation "calls" {
  description = "A declared application dependency."
}
```

A source root may split these blocks across any number of `.rf.hcl` and
`.rf.json` files.

## `dialect` block

| Property | Contract |
| --- | --- |
| Placement | Top level of a Dialect source root |
| Cardinality | Exactly one per source root |
| Labels | Exactly one required Dialect owner |
| Attributes | `version` |
| Nested blocks | `provider` only |

### Parameters

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| Label | Identifier | Yes | None | Lowercase kebab case, 1-64 bytes; `rf` forbidden |
| `version` | Static string | Yes | None | Exact `MAJOR.MINOR.PATCH` |

Canonical unit identity combines label and version, for example
`example@0.1.0`.

A Dialect has no authored dependency list. It may reference its own symbols and
`rf.*` only. Compiler derives RF Vocabulary dependency when used.

## `provider` block

```rf title="provider envelopes"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/example" {
    version = ">= 1.4.0, < 2.0.0"
  }

  provider "registry.example.com/acme/platform" {
    version = "~> 3.2.0"
  }
}
```

| Property | Contract |
| --- | --- |
| Placement | Inside `dialect` |
| Cardinality | Zero or more; at least one when source root declares any Rule |
| Labels | Exactly one required provider source |
| Attributes | `version` |
| Nested blocks | None |

### Parameters

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| Label | Provider source | Yes | None | `namespace/type` or `host/namespace/type` |
| `version` | Static string | Yes | None | One or more comma-separated clauses |

Accepted clause operators are `=`, `!=`, `>`, `>=`, `<`, `<=`,
and `~>`. Every clause must include an operator and an exact three-component
version:

```ebnf
provider-constraint = clause, { ",", clause } ;
clause              = operator, version ;
operator            = "=" | "!=" | ">" | ">=" | "<" | "<=" | "~>" ;
```

All clauses combine with logical AND against one known exact provider version.

| Operator | Version test |
| --- | --- |
| `= 3.2.0` | Equal to `3.2.0` |
| `!= 3.2.0` | Not equal to `3.2.0` |
| `> 3.2.0` | Greater than `3.2.0` |
| `>= 3.2.0` | Greater than or equal to `3.2.0` |
| `< 3.2.0` | Less than `3.2.0` |
| `<= 3.2.0` | Less than or equal to `3.2.0` |
| `~> 3.2.0` | Greater than or equal to `3.2.0` and less than `3.3.0` |

Whitespace around clauses is normalized. Duplicate clauses are removed and
remaining clauses are sorted in compiled output. A bare version such as
`"1.4.0"` is invalid.

Two-part provider sources match same namespace and type on any registry host.
Three-part sources require exact host, namespace, and type. Duplicate normalized
provider sources produce `DUPLICATE_ID`.

Provider envelope participates in Rule eligibility:

Every Rule in the Dialect uses this shared provider list. Rules do not declare
their own provider selector.

- provider source must match source declaration's resolved provider identity;
- unresolved required identity can produce `PROVIDER_IDENTITY_UNRESOLVED`;
- when source adapter provides exact `= MAJOR.MINOR.PATCH` evidence, version
  must satisfy envelope or Rule becomes incompatible;
- absent, unverified, or non-exact source constraints do not invent exact
  version evidence and do not block Rule from continuing to its predicate.

## Semantic definition blocks

`concept`, top-level `context`, and top-level `relation` share one shape:

```rf title="definitions.rf.hcl"
concept "database" {
  description = "A database service."
}

context "runtime" {
  description = "The runtime selected for a service."
}

relation "reads-from" {
  description = "A declared read dependency."
}
```

| Property | Contract |
| --- | --- |
| Placement | Top level of a Dialect source root |
| Cardinality | Zero or more of each kind |
| Labels | Exactly one required name |
| Attributes | Optional `description` |
| Nested blocks | None |

### Parameters

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| Label | Identifier | Yes | None | Lowercase kebab case, 1-64 bytes; unique within symbol kind |
| `description` | Static string | No | Empty | Valid UTF-8, at most 1,024 bytes; empty allowed |

### Meaning

| Block | Defines | Does not define |
| --- | --- | --- |
| `concept` | Optional nominal classification | Shape, inheritance, properties, or structural coverage |
| `context` | Named directed placement dimension | A fact by itself |
| `relation` | Named directed relation predicate | A fact by itself |

Rules emit concrete Contexts, Relations, and Contributions. Concepts classify a
representation only when a Rule uses `as`. A Concept is optional and never
inferred from a Rule name or source type.

Descriptions are editorial metadata. They affect exact content identity but
are excluded from Dialect semantic digest.

Labeled Rule emissions may introduce a local Context or Relation without a
separate top-level definition. Top-level definition remains useful for a
description. Concepts always require explicit definition.

## Allowed references

A Dialect may resolve:

| Form | Scope |
| --- | --- |
| `concept.name`, `context.name`, `relation.name`, `rule.name` | Current Dialect |
| `owner.kind.name` where owner equals current Dialect | Current Dialect |
| Supported `rf.*` ID | Embedded [RF Vocabulary](rf-vocabulary.md) |

Foreign Dialect references are invalid. File location never changes scope. See
[Symbols and references](symbols.md) for complete resolution rules.

## Rejected forms

```rf title="invalid-provider.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "example" {
    version = "1.4.0"
  }
}
```

Provider source has too few slash-separated segments and version clause has no
operator. Compiler reports `PROVIDER_INVALID`.

A `requires` block, nested `concept`, unknown attribute, or second
`dialect` block also fails closed.
