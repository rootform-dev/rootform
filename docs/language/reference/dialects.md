---
title: "Dialect definitions"
description: "Reference for Dialect identity, exact requirements, provider envelopes, concepts, and context vocabulary."
---

A Dialect source root compiles to one versioned semantic artifact. Its top
level accepts `dialect`, `concept`, `context`, and `rule` blocks. Definitions
may be split across `.rf` and `.rf.json` files beneath the root.

## Dialect block

```hcl title="dialect.rf"
dialect "aws" {
  version = "0.1.0"

  requires {
    core = "0.1.0"
  }

  provider "hashicorp/aws" {
    version = "= 6.62.0"
  }
}
```

| Item | Cardinality | Value |
| --- | --- | --- |
| Label | exactly 1 | Dialect name; lower kebab case |
| `version` | exactly 1 | Literal exact `MAJOR.MINOR.PATCH` string |
| `requires` | 0 or more blocks | Exact direct Dialect requirements |
| `provider` | 0 or more blocks | Provider compatibility envelopes |

Exactly one `dialect` declaration must occur across the source root. Zero
declarations produces `DIALECT_MISSING`; more than one produces
`DIALECT_DUPLICATE`.

The canonical identity is `<name>@<version>`. Source directories do not add an
identity segment.

## Requirements

Each attribute maps a Dialect name to one exact version:

```hcl title="dialect.rf"
requires {
  core       = "0.1.0"
  kubernetes = "0.1.0"
}
```

| Position | Form |
| --- | --- |
| Attribute name | Required Dialect name |
| Attribute value | Literal exact `MAJOR.MINOR.PATCH` string |

Requirements establish compilation scope. A definition in `aws` can refer to
`concept.core.subnet` only when `aws` directly requires `core` at the loaded
version. Requirements are not transitive authoring imports.

Duplicate names, missing packages, version mismatches, and cycles are errors.
The compiled artifact stores canonical direct requirements.

## Provider envelope

A provider block declares which provider and versions the Dialect can
interpret:

```hcl title="dialect.rf"
provider "hashicorp/kubernetes" {
  version = ">= 2.0.0, < 3.0.0"
}
```

| Item | Cardinality | Value |
| --- | --- | --- |
| Label | exactly 1 | `namespace/name` or `host/namespace/name` provider source |
| `version` | exactly 1 | Literal provider constraint string |

Each constraint clause uses `=`, `!=`, `>`, `>=`, `<`, `<=`, or `~>` followed
by a three-component version. Separate multiple clauses with commas.

An unhosted `namespace/name` source can match that provider namespace and name
across registry hosts. A hosted source fixes the host as well. One-part names,
empty constraints, invalid versions, and duplicate provider envelopes are
rejected.

A Dialect with rules for provider declarations needs a matching provider
envelope. The envelope participates in selection and validation; it does not
replace the `kind` and `type` in each rule.

## Concept definition

```hcl title="concepts.rf"
concept "subnet" {
  kind        = scope
  description = "A subnet that segments a virtual network."
}
```

| Item | Cardinality | Value |
| --- | --- | --- |
| Label | exactly 1 | Concept name; lower kebab case |
| `kind` | exactly 1 | Bare identifier `entity`, `scope`, or `detail` |
| `description` | exactly 1 | Nonempty literal string, at most 1024 UTF-8 bytes |

Concept identity is `<dialect>/<concept>`, such as `core/subnet`.

| Kind | Graph contract |
| --- | --- |
| `entity` | Can stand alone, provide context target, receive a contribution, and be a relation endpoint. |
| `scope` | Same graph eligibility as entity; can also provide visible contextual boundaries. |
| `detail` | Supports another representation through `contribution`; cannot be a context target or relation endpoint. |

The kind is semantic, not a renderer style. A renderer decides how to present a
valid entity, scope, or contributed detail without changing its concept.

## Context definition

A top-level context block defines one placement dimension:

```hcl title="contexts.rf"
context "network" {
  description = "Network placement or containment."
}
```

| Item | Cardinality | Value |
| --- | --- | --- |
| Label | exactly 1 | Context name; lower kebab case |
| `description` | exactly 1 | Nonempty literal string, at most 1024 UTF-8 bytes |

Context definition identity is `<dialect>/<context>`, such as `core/network`.
The definition supplies vocabulary. A rule's nested `context` fact uses that
vocabulary to place one representation relative to another.

Do not define a context merely to group files or reduce canvas density. It must
name a stable architectural dimension whose fact can be proven from source.

## Definition uniqueness

Within one compiled Dialect:

- concept names are unique;
- context names are unique;
- rule names are unique;
- provider sources are unique;
- requirement names are unique.

The same local name in two different Dialects remains distinct because the
canonical identity includes the Dialect. Use qualified references at a
cross-Dialect boundary.

See [Rules](rules.md) for mapping source declarations to this vocabulary and
[Traversals and scope](traversals.md) for reference forms.
