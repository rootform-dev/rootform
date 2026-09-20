---
title: "Composition"
description: "Complete reference for ordered composition members, matching, exclusivity, diagnostics, and transactional application."
---

Composition says one interpreted root declaration is implemented by other
source declarations. It is structural architecture meaning, independent of
optional Concept classification.

## Complete example

```hcl title="composition/dialect.rf.hcl"
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

Root is `example_forwarding_rule`. First member resolves from root's
`proxy_id`. Second resolves from already accepted `proxy` member.

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
| `kind` | Static string enum | No | `"resource"` | One of [15 match kinds](rules.md#matchkind-values) |
| `type` | Static string | Yes | None | Nonempty exact adapter-owned type |
| `where` | Predicate expression | No | Equivalent to known `true` | `source.*` reads candidate member declaration |

```hcl title="filtered member"
member "backend" {
  via = member.proxy.backend_id

  match {
    type  = "example_backend_service"
    where = source.enabled == true
  }
}
```

Within member `match.where`, `source` means declaration currently being
tested as that member, not composition root.

## Resolution and exclusivity

For every member in authored order, Rootform:

1. resolves `via` from root or accepted earlier member;
2. requires one unambiguous target declaration;
3. applies member's `kind`, `type`, provider, version, and `where` match;
4. rejects target already selected by its own Rule;
5. rejects target with uncertain interpretation;
6. records member for later members.

One declaration can satisfy at most one composition member slot globally. This
includes two slots in one composition and slots under different roots.
Competing claims fail every conflicting composition; Rootform does not choose
by order.

Composition links source declarations into root implementation. It does not
apply root Rule or Concept to members. It does not erase members' resource
bases. Membership and resolution provenance remain explicit in Architecture IR.

## Transactional behavior

Composition is all-or-nothing. If any member fails:

- no composition is applied;
- root Rule application is rolled back;
- root `as` classification is not applied;
- root emissions do not run;
- partial member resolutions are removed;
- managed-resource base representations remain.

A failure in early member also prevents dependent later members from becoming
independent successes.

## Diagnostics

Composition diagnostics have error severity.

| Code | Meaning |
| --- | --- |
| `COMPOSITION_MEMBER_UNRESOLVED` | Required member cannot be found |
| `COMPOSITION_MEMBER_MISMATCH` | Resolved declaration fails member `match` |
| `COMPOSITION_MEMBER_CONFLICT` | Member has own selected Rule or more than one composition slot claims same declaration |
| `COMPOSITION_MEMBER_UNCERTAIN` | Member interpretation is already indeterminate |
| `PREDICATE_UNRESOLVED` | Member `where` cannot be decided |
| `PROVIDER_IDENTITY_UNRESOLVED` | Member provider identity cannot be decided |
| `PROVIDER_VERSION_INCOMPATIBLE` | Member exact provider version violates envelope |
| Traversal diagnostic | Member `via` cannot resolve safely |

## Rejected forms

```hcl title="invalid/empty-composition.rf.hcl"
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

```hcl title="invalid member order"
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
