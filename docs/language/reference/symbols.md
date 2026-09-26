---
title: "Symbols and references"
description: "Canonical symbol IDs, local and qualified references, resolution scope, and duplicate-definition rules."
---

RF symbols name architecture semantics. They are distinct from
[traversals](traversals.md), which read instance or verified saved-plan
evidence at a specified language position.

## Canonical symbol IDs

```ebnf
symbol-id       = owner, ".", kind, ".", name ;
kind            = "concept" | "context" | "relation" | "rule" ;
local-reference = kind, ".", name ;
```

| Part | Meaning | Example |
| --- | --- | --- |
| `owner` | Dialect owner or embedded `rf` owner | `aws` |
| `kind` | Closed semantic kind | `concept` |
| `name` | Lowercase kebab-case identifier | `load-balancer` |

Examples of canonical IDs:

| ID | Owner | Kind | Name |
| --- | --- | --- | --- |
| `aws.rule.subnet` | aws | rule | subnet |
| `aws.relation.subscribes-to` | aws | relation | subscribes-to |
| `google.concept.load-balancer` | google | concept | load-balancer |
| `rf.context.network` | rf | context | network |

Slash-form IDs and untyped free strings are not symbol references.

## Reference forms by position

| Position | Accepted kind | Local form | Qualified form |
| --- | --- | --- | --- |
| Rule `as` | Concept | `concept.application` | Current owner or `rf` |
| Context emission `as` | Context | `context.runtime` | Current owner or `rf` |
| Relation emission `as` | Relation | `relation.uses-network` | Current owner only in 0.1.0 |
| Emission `to` | Concept or Rule | `concept.database`, `rule.database` | Current owner or allowed `rf` Concept |
| Policy `target.concept` | Concept | Not accepted | Any linked qualified owner |
| Policy `target.rules` item | Rule | Not accepted | Any linked qualified Dialect owner |
| `contexts` first argument | Context | Not accepted in Policy source | Any linked qualified owner |
| `relations` first argument | Relation | Not accepted in Policy source | Any linked qualified owner |
| Query target or contributor | Concept or Rule | Not accepted in Policy source | Any linked qualified owner |

RF Vocabulary currently contains Concepts and Contexts only. Therefore an
`rf.relation.*` or `rf.rule.*` reference is invalid.

## Dialect resolution

Inside a Dialect:

1. `kind.name` resolves only against current Dialect.
2. `owner.kind.name` may name current owner or `rf`.
3. A local miss does not fall back to `rf`.
4. A reference to another Dialect owner is rejected.
5. There are no imports, aliases, wildcard references, or shadowing rules.

```rf title="reference forms"
rule "subnet" {
  match {
    type = "example_subnet"
  }

  as = rf.concept.subnet

  context {
    as       = rf.context.network
    to       = concept.virtual-network
    via      = source.network_id
    on_null  = "absent"
    on_empty = "absent"
  }
}
```

Here, `concept.virtual-network` means current Dialect's Concept. It does not
mean `rf.concept.virtual-network`.

## Policy Pack resolution

Every semantic reference in Policy source must be owner-qualified:

```rf title="qualified Policy references"
target {
  concept = rf.concept.subnet
  rules   = [aws.rule.subnet]
}

assert = exists(contexts(rf.context.network, rf.concept.virtual-network))
```

Portable Policy Pack source carries references, not version pins. Compilation
against a Rootform document resolves each reference and derives exact semantic pins.
Unknown owners or symbols fail linking.

## Collection and duplicates

Dialect compilation has two passes. Compiler first collects definitions, then
resolves references. A Rule may therefore reference a definition in a later
file.

| Case | Result |
| --- | --- |
| Same top-level Concept declared twice | `DUPLICATE_ID` |
| Same top-level Context declared twice | `DUPLICATE_ID` |
| Same top-level Relation declared twice | `DUPLICATE_ID` |
| Same Rule declared twice | `DUPLICATE_ID` |
| Same labeled context emission reused by several Rules | One shared local Context symbol |
| Same labeled relation emission reused by several Rules | One shared local Relation symbol |
| Top-level Context plus matching labeled context emissions | One documented Context symbol |
| Top-level Relation plus matching labeled relation emissions | One documented Relation symbol |

Labeled emissions can introduce local Context or Relation symbols. Concepts are
never introduced implicitly: every Concept must have an explicit top-level
definition or come from [RF Vocabulary](rf-vocabulary.md).

## Rejected forms

```rf title="invalid references"
as = subnet
as = rf/subnet
as = other.concept.subnet
```

These fail because references are typed and dotted, and a Dialect cannot import
a foreign owner. A Policy reference such as `concept.subnet` fails with
`POLICY_REFERENCE_UNQUALIFIED`.
