---
title: "Fact emissions"
description: "Complete reference for Context, Relation, and Contribution emissions, explicit target matching, omissions, and diagnostics."
---

Rule emissions turn normalized source evidence into directed Architecture IR
facts. Every emitted fact starts at current Rule representation and points to a
represented target.

| Emission | Semantic qualifier | Direction |
| --- | --- | --- |
| Context | Context dimension | Current representation to target |
| Relation | Relation predicate | Current representation to target |
| Contribution | None | Current representation contributes to target |

A `to` reference describes required architecture meaning. A `via` traversal
describes how source evidence identifies target. Rootform emits no fact unless
both agree.

## Complete example

```rf title="emissions/dialect.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/example" {
    version = ">= 1.0.0"
  }
}

concept "workload" {
  description = "A runnable workload."
}

concept "namespace" {
  description = "A workload namespace."
}

concept "database" {
  description = "A database service."
}

context "ownership" {
  description = "The namespace that owns a workload."
}

relation "reads-from" {
  description = "A declared read dependency."
}

rule "workload" {
  match {
    type = "example_workload"
  }

  as = concept.workload

  context {
    as  = context.ownership
    to  = concept.namespace
    via = source.namespace

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation {
    as  = relation.reads-from
    to  = concept.database
    via = source.database_id
  }

  contribution {
    to  = concept.database
    via = source.database_id
  }
}
```

## Common parameters

All three emission kinds share these parameters:

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `to` | Concept or Rule reference | Yes | None | Target must be represented by an applied Rule satisfying reference |
| `via` | Traversal | Yes | None | `source.*` or `provider.*`; nested `match` permits `source.*` only |
| `match` | Nested block | No | Direct reference resolution | At most one, no label |

`to = concept.database` accepts only a target whose applied Rule classifies it
as that Concept. A resource base alone is insufficient. `to = rule.database`
accepts only a target interpreted by that exact Rule.

A traversal may resolve one or several declarations. Rootform emits one
deduplicated fact per accepted target and records Rule and resolution
provenance. Two identical emission shapes inside one Rule have same semantic
identity and are rejected with `DUPLICATE_ID`.

## Context emission

### Referenced form

```rf title="referenced Context"
context {
  as  = rf.context.network
  to  = rf.concept.virtual-network
  via = source.network_id
}
```

### Labeled form

```rf title="labeled Context"
context "runtime" {
  to  = concept.cluster
  via = source.cluster_id
}
```

| Property | Contract |
| --- | --- |
| Placement | Inside `rule` |
| Cardinality | Zero or more |
| Labels | Zero or one |
| Attributes | `as`, `to`, `via` |
| Nested blocks | Optional single `match` |

### Context-specific parameter

| Form | Required | Forbidden | Meaning |
| --- | --- | --- | --- |
| Unlabeled | `as` Context reference | Label | Use existing local/current-owner or `rf` Context |
| Labeled | Label | `as` | Introduce or reuse local Context with that name |

Exactly one of label or `as` is required. Both or neither produce
`FACT_INVALID`.

## Relation emission

### Referenced form

```rf title="referenced Relation"
relation {
  as  = relation.reads-from
  to  = concept.database
  via = source.database_id
}
```

### Labeled form

```rf title="labeled Relation"
relation "calls" {
  to  = concept.application
  via = source.upstream_id
}
```

| Property | Contract |
| --- | --- |
| Placement | Inside `rule` |
| Cardinality | Zero or more |
| Labels | Zero or one |
| Attributes | `as`, `to`, `via` |
| Nested blocks | Optional single `match` |

Exactly one of label or `as` is required. Labeled form introduces or reuses a
local Relation predicate. Unlabeled form requires a Relation reference.
RF Vocabulary 0.1.0 has no Relations.

## Contribution emission

```rf title="Contribution"
contribution {
  to  = rf.concept.object-storage-container
  via = source.bucket
}
```

| Property | Contract |
| --- | --- |
| Placement | Inside `rule` |
| Cardinality | Zero or more |
| Labels | Forbidden |
| Attributes | `to`, `via` |
| Nested blocks | Optional single `match` |

Contribution has no `as` because it has no dimension or predicate. Query it
from target side with
`contributions(contributor)`; see [Built-ins](built-ins.md#contributions).

## Direct target resolution

Without nested `match`, Rootform resolves references carried by `via`.

```rf
context {
  as  = rf.context.network
  to  = rf.concept.virtual-network
  via = source.vpc_id
}
```

For each resolved declaration, Rootform checks:

1. target has a representation;
2. target has an applied Rule;
3. applied Rule satisfies exact Concept or Rule in `to`.

Collections can resolve several targets and emit several facts. Wrong
representation meaning does not get coerced to requested target type.

`provider.*` resolves attributes on concrete provider configuration bound to
matched declaration, including module inheritance and aliases. It names actual
configuration, not provider source identity.

## Explicit attribute match

Use nested `match` as an attribute-matching fallback when source stores a value
rather than a direct infrastructure reference:

```rf title="fact match"
context {
  as  = context.ownership
  to  = concept.namespace
  via = source.metadata[0].namespace

  match {
    by       = target.metadata[0].name
    strategy = "exact"
  }
}
```

### `match` block contract

| Property | Contract |
| --- | --- |
| Placement | Inside one Context, Relation, or Contribution emission |
| Cardinality | Zero or one |
| Labels | Forbidden |
| Attributes | `by`, `strategy` |
| Nested blocks | None |

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `by` | Traversal | Yes | None | Must start with `target` |
| `strategy` | Static string enum | Yes | None | `"exact"` or `"dot-ancestor"` |

Rootform always attempts direct `via` resolution first. If that produces one or
more represented targets satisfying `to`, Rootform emits those facts and does
not evaluate nested `match`. The nested block is not a filter over an already
valid direct target.

Attribute matching is eligible when direct resolution is unknown, or when an
ambiguous/direct result consists only of non-architectural intermediary
declarations that can carry the scalar evidence. A directly resolved
non-intermediary that is unrepresented or does not satisfy `to` is a diagnostic,
not permission to search for a different target.

Fallback matching considers represented declarations satisfying `to`. It
compares source value at `via` with candidate value at `by`.

| Strategy | Match rule |
| --- | --- |
| `exact` | Same known symbolic declaration, same known nonempty string value, or source-adapter-proven equivalent private expression |
| `dot-ancestor` | Exact match, or candidate string is dot-delimited ancestor of source string; most specific candidate wins |

For `dot-ancestor`, candidate `team.prod` can match source
`team.prod.api`; candidate `team` ranks lower. Unique best candidate is
required. Equal best candidates produce `ATTRIBUTE_MATCH_AMBIGUOUS`.
Unknown or incomparable values produce `ATTRIBUTE_MATCH_UNRESOLVED`.

## Omission and uncertainty

Absence is different from uncertainty.

| Evidence result | Architecture result |
| --- | --- |
| Source path is proven absent | Omission with reason `source_absent` |
| Explicit match is complete and finds none | Omission with reason `no_match` |
| One or more targets are proven | Fact for each target |
| Resolution is dangling, ambiguous, unknown, unrepresented, or semantically wrong | Emission warning; no invented fact for affected target |

Confirmed facts can coexist with an emission warning when only part of a
collection resolves. Fact diagnostics have warning severity. They still make
affected query evidence incomplete, so a Policy cannot treat missing fact as
proven absence.

## Emission diagnostics

| Code | Meaning |
| --- | --- |
| `TRAVERSAL_UNRESOLVED` | Value or reference cannot be decided |
| `TRAVERSAL_DANGLING` | Reference names declaration not present in normalized source |
| `TRAVERSAL_AMBIGUOUS` | Reference resolves to several incompatible declarations |
| `ATTRIBUTE_MATCH_UNRESOLVED` | Candidate comparison cannot be completed |
| `ATTRIBUTE_MATCH_AMBIGUOUS` | More than one best explicit match remains |
| `FACT_TARGET_UNREPRESENTED` | Resolved target lacks applicable representation |
| `FACT_TARGET_MISMATCH` | Resolved target does not satisfy `to` |

## Rejected forms

```rf title="invalid emission"
context "ownership" {
  as  = context.ownership
  to  = concept.namespace
  via = source.namespace
}
```

Label and `as` are mutually exclusive, so this block produces
`FACT_INVALID`. Missing `to`, missing `via`, a labeled
`contribution`, or a fact `match` without both `by` and `strategy` is
also invalid.
