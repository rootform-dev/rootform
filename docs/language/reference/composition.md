---
title: "Composition"
description: "Complete reference for ordered composition members, per-instance resolution, and unresolved-member reasons."
---

Composition says one interpreted root instance has implementation members in
the same stage. It is structural architecture meaning, independent of optional
Concept classification. Members remain separate instances.

## Complete example

```rf title="composition/dialect.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/example" {
    version = ">= 1.0.0"
  }
}

concept "load-balancer" {
  description = "A load-balancing service."
}

rule "application-load-balancer" {
  match {
    type = "example_forwarding_rule"
  }

  as = concept.load-balancer

  composition {
    member "proxy" {
      via = source.proxy_id

      match {
        type = "example_https_proxy"
      }
    }

    member "backend" {
      via = member.proxy.backend_id

      match {
        type = "example_backend_service"
      }
    }
  }
}
```

The root is each matching `example_forwarding_rule` instance. Its `proxy_id`
names the first member; `backend_id` on a resolved proxy names the second.
The `via` value can match a candidate's declared identity. A verified saved
plan can establish a direct reference to that candidate's endpoint even when
the value is unknown. An unresolved proxy leaves the backend unresolved too.

## `composition` block

| Property | Contract |
| --- | --- |
| Placement | Inside `rule` |
| Cardinality | Zero or one |
| Labels | Forbidden |
| Attributes | None |
| Nested blocks | One or more `member` blocks |

Empty composition is invalid. RF has no optional member, alternatives, nested
composition, or cardinality operator.

## `member` block

| Property | Contract |
| --- | --- |
| Placement | Inside `composition` |
| Cardinality | One or more |
| Labels | Exactly one required member name |
| Attributes | `via` |
| Nested blocks | Exactly one `match` |

### Parameters

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| Label | Identifier | Yes | None | Lowercase kebab case, 1-64 bytes; unique in composition |
| `via` | Traversal | Yes | None | `source.*` or `member.<earlier-name>.*` |
| `match` | Block | Yes | None | Exactly one, unlabeled |

Member order is semantic. A `member.*` traversal can reference only a
previously declared member. Self-reference and forward reference are invalid.

## Member matching

Member `match` uses same parameters as Rule `match`:

| Name | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `kind` | Static string enum | No | `"resource"` | `"resource"` or `"data"`; see [match kinds](rules.md#matchkind-values) |
| `type` | Static string | Yes | None | Nonempty exact adapter-owned type |
| `where` | Predicate expression | No | Equivalent to known `true` | `source.*` reads candidate member instance |

```rf title="filtered member"
member "backend" {
  via = member.proxy.backend_id

  match {
    type  = "example_backend_service"
    where = source.enabled == true
  }
}
```

Within member `match.where`, `source` means the instance currently considered
as that member, not the composition root.

## Member resolution

For every root instance, Rootform processes members in authored order:

1. Read `via` from the root or an established earlier member.
2. Find an eligible instance of the member's kind and type, applying `where`.
3. Establish identity through a known value matching a candidate Rule's
   declared identity, or through a verified saved-plan traversal to an endpoint.
4. Record the established member with its value or traversal evidence; otherwise
   record an unresolved member with its reason.

The saved-plan traversal can establish an uninterpreted member. An unresolved
member does not stop an independent later member from resolving.

Composition does not apply the root Rule or Concept to members, invent
Relations between them, or remove their Representations. See
[Fact emissions](emissions.md) when a visible relationship is needed.

## Unresolved members

Composition is evaluated independently for each root instance and stage.
Unresolved members stay listed on that root, alongside any established
members. A later member whose `via` uses an unresolved earlier member is itself
unresolved with reason `unavailable`; an independent later member can still
resolve. The root's Rule classification and emissions remain available.

## Diagnostics

Member resolution is visible through unresolved-member reasons in the Rootform
document. Authored source errors still produce compiler diagnostics.

| Code | Meaning |
| --- | --- |
| `COMPOSITION_INVALID` | Invalid authored member structure or order |
| `unavailable` | An earlier member needed by `via` is unresolved, or required evidence is unavailable |
| `identity_incomplete` | No candidate identity or verified traversal establishes the member |
| `reference_ambiguous` | Verified traversal and evaluated identity evidence disagree |
| `ambiguous_unknown` | An eligible candidate cannot be ruled out with the available evidence |

## Rejected syntax

```rf title="invalid/empty-composition.rf.hcl"
dialect "example" {
  version = "0.1.0"

  provider "hashicorp/example" {
    version = ">= 1.0.0"
  }
}

rule "empty" {
  match {
    type = "example_root"
  }

  composition {}
}
```

Empty block produces `COMPOSITION_INVALID`.

This forward reference is also invalid:

```rf title="invalid member order"
composition {
  member "backend" {
    via = member.proxy.backend_id

    match {
      type = "example_backend"
    }
  }

  member "proxy" {
    via = source.proxy_id

    match {
      type = "example_proxy"
    }
  }
}
```

Declare `proxy` first so `member.proxy` is available.
