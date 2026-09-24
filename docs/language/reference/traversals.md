---
title: "Traversals and scope"
description: "Complete traversal grammar, roots, path steps, position rules, and resolution behavior."
---

Traversals navigate normalized infrastructure declarations. They do not name
semantic symbols; [Concept, Context, Relation, and Rule references](symbols.md)
use separate typed syntax.

## Grammar

```ebnf
traversal        = simple-root, step, { step }
                 | member-root, step, { step } ;

simple-root      = "source" | "provider" | "target" ;
member-root      = "member", ".", member-name ;

step             = ".", attribute-name
                 | "[", non-negative-integer, "]" ;

attribute-name   = letter-or-underscore,
                   { letter | digit | underscore } ;
```

Every traversal needs at least one path step after root. For `member`, member
name is part of root, so `member.proxy` alone remains incomplete.

Examples:

```rf title="valid traversals"
source.vpc_id
source.metadata[0].name
provider.host
target.metadata[0].name
member.proxy.backend_id
```

## Path steps

### Attribute step

Adapter-owned attribute names are 1 to 64 bytes and match:

```regexp
[A-Za-z_][A-Za-z0-9_]*
```

They use source-adapter naming, usually snake case, not RF kebab-case
identifier grammar.

### Index step

Index key must be exact non-negative signed 64-bit integer value. Canonical
spelling is decimal whole number:

```rf
source.backends[0].id
```

String indexes, negative indexes, dynamic indexes, slices, and splats are
invalid:

```rf title="invalid traversal steps"
source.tags["Name"]
source.items[-1]
source.items[source.index]
source.items[*].id
```

## Roots

| Root | Meaning |
| --- | --- |
| `source` | Declaration in current language position |
| `provider` | Concrete provider configuration bound to matched Rule declaration |
| `target` | Candidate target declaration during explicit fact matching |
| `member.<name>` | Earlier accepted member in current composition |

Meaning of `source` depends on placement:

| Placement | `source` declaration |
| --- | --- |
| Rule `match.where` | Candidate for Rule |
| Member `match.where` | Candidate for that member |
| Emission `via` | Rule's interpreted root declaration |
| Composition member `via` | Composition root declaration |

`provider` follows actual normalized binding, including aliases and module
inheritance. It does not expose canonical provider source identity as free
metadata.

## Root availability

| Position | `source` | `provider` | `target` | `member.<name>` |
| --- | --- | --- | --- | --- |
| Rule `match.where` | Yes | No | No | No |
| Member `match.where` | Yes | No | No | No |
| Emission `via`, without nested fact `match` | Yes | Yes | No | No |
| Emission `via`, with nested fact `match` | Yes | No | No | No |
| Fact `match.by` | No | No | Yes | No |
| Composition member `via` | Yes | No | No | Earlier members only |

Using known root in wrong position produces `INVALID_REFERENCE`,
`FACT_INVALID`, or `COMPOSITION_INVALID` according to enclosing construct.

## Traversal use by position

### Predicate scalar inspection

```rf
where = source.enabled == true
```

Predicate traversal must resolve to known string, Boolean, or signed integer
scalar. Missing, collection-valued, dynamic, or type-incompatible result is
unknown.

### Fact reference resolution

```rf
via = source.vpc_id
```

Emission `via` resolves infrastructure references represented by source
expression. It can produce zero, one, or several declarations. Result must also
satisfy emission `to` semantic type.

### Provider configuration resolution

```rf
via = provider.host
```

This reads `host` from concrete provider configuration used by matched source
declaration. A proven missing configuration or attribute yields ordinary
`source_absent` omission. A binding or value that source analysis attempted but
could not decide produces incomplete emission evidence. `provider.*` is valid
only for direct emission resolution, without nested fact `match`.

### Explicit target comparison

```rf
match {
  by       = target.metadata[0].name
  strategy = "exact"
}
```

For each candidate satisfying emission `to`, `target` reads candidate's
attribute. See [Explicit attribute match](emissions.md#explicit-attribute-match).

### Composition chaining

```rf
member "url-map" {
  via = member.proxy.url_map

  match {
    type = "example_url_map"
  }
}
```

`proxy` must precede `url-map` in same composition. Members from another
Rule or later position are not in scope.

## Resolution states

Traversal evaluation distinguishes:

| State | Meaning |
| --- | --- |
| Resolved | Required value or declaration is known |
| Absent | Path is known not to exist |
| Dangling | Reference names declaration absent from normalized source |
| Ambiguous | More than one incompatible declaration remains |
| Unresolved | Evidence is unknown or unsupported |

Context decides whether absence becomes normal omission or diagnostic.
Uncertainty never becomes empty evidence. See
[Fact emissions](emissions.md#omission-and-uncertainty) and
[Evaluation](evaluation.md).

## Rejected roots and forms

```rf title="invalid traversals"
source
provider
target.name
member.future.id
aws_vpc.main.id
```

First two lack path step. `target` is invalid outside fact `match.by`.
`member.future` is invalid unless `future` is earlier composition member.
Terraform address `aws_vpc.main.id` has no RF traversal root.
