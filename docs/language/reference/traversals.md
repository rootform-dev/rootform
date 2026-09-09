---
title: "Traversals and scope"
description: "Reference for source paths, provider paths, target matching, composition members, and vocabulary references."
---

A traversal follows a bounded path through source-adapter evidence. Rootform
recognizes four roots, then restricts each root to specific authoring positions.

## Path syntax

```hcl title="Traversal examples"
source.vpc_id
source.settings[0].ip_configuration[0].private_network
provider.host
target.name
member.url-map.default_service
```

A traversal contains:

1. one recognized root;
2. for `member`, one valid member name;
3. at least one attribute or index path step.

Attribute steps use adapter-owned names containing ASCII letters, digits after
the first character, or `_`. Index steps are nonnegative integer literals.
Splat expressions, string-key indexes, computed indexes, calls, relative
traversals, and parent traversal are not accepted.

## Root availability

| Authoring position | `source` | `provider` | `target` | `member.<name>` |
| --- | --- | --- | --- | --- |
| Rule or member `match.where` | yes | no | no | no |
| Fact `via` without nested match | yes | yes | no | no |
| Fact `via` with nested match | yes | no | no | no |
| Fact nested `match.by` | no | no | yes | no |
| Composition member `via` | yes | no | no | earlier members only |

Availability is checked at compilation. A recognized root in the wrong
position produces `INVALID_REFERENCE` or `COMPOSITION_INVALID`.

## Source root

`source` is the declaration currently being examined:

- in the parent rule's `match.where`, it is the initial candidate;
- in a composition member's `match.where`, it is that member candidate;
- in a fact `via`, it is the representation's initially matched declaration;
- in a composition member `via`, it is the parent rule's initial declaration.

```hcl title="source examples"
where = source.load_balancing_scheme == "EXTERNAL"
via   = source.vpc_id
```

Rootform reads only source-adapter evidence available at the path. A traversal
does not invoke Terraform evaluation, read state, or fetch a provider.

## Provider root

`provider` means the concrete provider configuration used by the matched source
declaration. It is available only as a direct fact `via`:

```hcl title="kubernetes/workloads/controllers.rf"
context {
  as  = context.core.runtime
  to  = concept.core.kubernetes-cluster
  via = provider.host
}
```

It does not mean the abstract provider envelope in `dialect.rf`. It cannot be
used in a predicate, value-matching fact, or composition link.

## Target root

`target` is a candidate target declaration during explicit fact matching. It
is available only under the fact's nested `match.by`:

```hcl title="target example"
match {
  by       = target.name
  strategy = "exact"
}
```

The surrounding fact's `via = source.path` supplies the source value. Rootform
compares it with candidate values at `target.path` using the declared strategy.

## Composition member root

A composition member can follow a member resolved earlier in author order:

```hcl title="member example"
member "routing" {
  via = member.tls-proxy.url_map

  match {
    kind = "resource"
    type = "google_compute_url_map"
  }
}
```

`tls-proxy` must already be declared above `routing`. `member` with no name,
an unknown name, a self reference, or a forward reference is invalid.

## Concept and context references

Concept and context references name semantic vocabulary. They are not source
traversals:

| Scope | Concept form | Context form |
| --- | --- | --- |
| Current Dialect | `concept.subnet` | `context.network` |
| Current Dialect, explicit | `concept.aws.subnet` | `context.aws.network` |
| Directly required Dialect | `concept.core.subnet` | `context.core.network` |
| Policy Pack | `concept.core.subnet` | `context.core.network` |

Within a Dialect, an unqualified reference resolves only to local vocabulary.
A qualified cross-Dialect reference resolves only when the current Dialect
directly requires that exact Dialect version.

Policy Packs have no local vocabulary, so every concept, context, and relation reference
is qualified and its Dialect must appear in the pack's direct `requires`.

There is no implicit `core` scope and no transitive import. File paths and
folder nesting do not affect reference resolution.
