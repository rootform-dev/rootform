---
title: "Rules"
description: "Reference for source matching, predicates, architecture facts, value matching, and composition."
---

A `rule` recognizes one source declaration, assigns one concept, and can emit
architecture facts or collect supporting declarations into a composition.

```hcl title="rule.rf"
rule "subnet" {
  match {
    type = "aws_subnet"
  }

  as = concept.core.subnet

  context {
    as  = context.core.network
    to  = concept.core.virtual-network
    via = source.vpc_id
  }
}
```

## Rule block

| Item | Cardinality | Value |
| --- | --- | --- |
| Label | exactly 1 | Rule name; lower kebab case |
| `match` | exactly 1 block | Initial source selector |
| `as` | exactly 1 attribute | Local or directly required concept reference |
| `context` | 0 or more blocks | Context facts |
| `contribution` | 0 or more blocks | Contribution facts |
| `relation` | 0 or more blocks | Directional relation facts |
| `composition` | 0 or 1 block | Ordered supporting members |

Rule identity is `<dialect>/<rule>`. Two rules that safely match the same
source declaration are not merged; architecture compilation reports
`AMBIGUOUS_RULE_MATCH`.

## Initial `match`

```hcl title="rule.rf"
match {
  kind  = "resource"
  type  = "google_compute_global_forwarding_rule"
  where = source.load_balancing_scheme == "EXTERNAL"
}
```

| Attribute | Required | Value |
| --- | --- | --- |
| `kind` | no | Closed declaration kind; defaults to `resource` |
| `type` | yes | Nonempty literal adapter type |
| `where` | no | Boolean source predicate |

Accepted `kind` values:

| Value | Source declaration category |
| --- | --- |
| `settings` | Terraform/OpenTofu settings block |
| `provider` | Provider configuration |
| `resource` | Managed resource |
| `data` | Data source |
| `ephemeral` | Ephemeral resource |
| `action` | Action declaration |
| `module` | Module call |
| `variable` | Input variable |
| `local` | Local value |
| `output` | Output value |
| `moved` | Moved declaration |
| `removed` | Removed declaration |
| `import` | Import declaration |
| `check` | Check declaration |
| `language` | Language-settings declaration |

These values classify declarations visible through the source adapter. They do
not expose authoring modules, variables, imports, or checks inside `.rf`.
There is one block syntax. Scalar forms such as `match = "aws_subnet"` are
invalid. Composition member matches use the same `resource` default.

### Where predicate

A predicate must produce a Boolean from:

- `true` or `false`;
- `!`, `&&`, and `||` over Boolean predicate expressions;
- `==` or `!=` between compatible string, Boolean, or integer operands;
- `<`, `<=`, `>`, or `>=` between integer operands;
- literal operands and `source` traversals.

```hcl title="rule.rf"
where = source.enabled == true && source.mode == "private" && source.priority >= 10
```

Calls, concept references, context references, other traversal roots, and bare
non-Boolean values are invalid in a rule predicate. Missing, unknown, or
incompatible source evidence does not become a match. See
[Evaluation](evaluation.md) for unknown behavior.

## Context fact

```hcl title="rule.rf"
context {
  as  = context.core.network
  to  = concept.core.virtual-network
  via = source.vpc_id
}
```

| Attribute | Required | Value |
| --- | --- | --- |
| `as` | yes | Local or directly required context definition |
| `to` | yes | Target concept of kind `entity` or `scope` |
| `via` | yes | `source` or `provider` traversal |
| nested `match` | no | Explicit value matching configuration |

The rule's representation becomes the context source. `as` names the placement
dimension. `to` constrains the target representation's concept. A successful
`via` resolution establishes the fact; unresolved evidence remains explicit.

## Contribution fact

```hcl title="rule.rf"
contribution {
  to  = concept.core.kubernetes-cluster
  via = source.cluster_id
}
```

| Attribute | Required | Value |
| --- | --- | --- |
| `to` | yes | Target concept of kind `entity` or `scope` |
| `via` | yes | `source` or `provider` traversal |
| nested `match` | no | Explicit value matching configuration |

The rule's `as` concept must be `detail`. A contribution attaches that detail
to a target representation; it does not create a relation between two
standalone components.

## Local relation

```hcl title="rule.rf"
relation "private-reachability" {
  to  = concept.core.virtual-network
  via = source.private_network
}
```

| Item | Required | Value |
| --- | --- | --- |
| Label | yes | Local predicate name; lower kebab case |
| `to` | yes | Target concept of kind `entity` or `scope` |
| `via` | yes | `source` or `provider` traversal |
| nested `match` | no | Explicit value matching configuration |

The rule's `as` concept must also be `entity` or `scope`. Direction runs from
the rule's representation to resolved target. Label always introduces and
uses `<current-dialect>/private-reachability`; an imported homonym never changes
that resolution.

## Shared relation

Declare vocabulary once at Dialect scope only when several Dialects should use
same predicate:

```hcl title="relations.rf"
relation "private-reachability" {
  description = "Private network reachability."
}
```

Reference it explicitly from an unlabelled rule emission:

```hcl title="rule.rf"
relation {
  as  = relation.core.private-reachability
  to  = concept.core.virtual-network
  via = source.private_network
}
```

Owner must be current Dialect or direct requirement. Label plus `as` is
invalid. Predicate identity is `owner/name`; producer rule, emission, package
version, endpoints, and provenance remain separate. Several rules may emit
same predicate with different source/target concept pairs. Inspection lists
each producer shape; shared name does not claim those pairs are equivalent.

## Fact-level `match`

Use a nested match when `via` yields a scalar identity rather than a direct
source reference:

```hcl title="rule.rf"
context {
  as  = context.network
  to  = concept.subnet
  via = source.network

  match {
    by       = target.name
    strategy = "exact"
  }
}
```

| Attribute | Required | Value |
| --- | --- | --- |
| `by` | yes | `target` traversal with at least one path step |
| `strategy` | yes | Literal `"exact"` or `"dot-ancestor"` |

When fact-level `match` exists, `via` must begin at `source`; `provider` is not
accepted. `exact` compares known scalar values for equality.
`dot-ancestor` also accepts a target value followed by `.` as an ancestor of
the source value. Ambiguous matches do not become arbitrary facts.

## Composition

A composition gathers linked source declarations into the representation
created by the parent rule:

```hcl title="rule.rf"
composition {
  member "tls-proxy" {
    via = source.target

    match {
      kind = "resource"
      type = "google_compute_target_https_proxy"
    }
  }

  member "routing" {
    via = member.tls-proxy.url_map

    match {
      kind = "resource"
      type = "google_compute_url_map"
    }
  }
}
```

| Composition item | Cardinality | Value |
| --- | --- | --- |
| `member` | 0 or more blocks | Ordered supporting declaration definition |
| Other attributes or blocks | none | Rejected |

An empty composition records no supporting members and has no useful authoring
outcome; omit it. Useful compositions declare at least one member. Each member
has:

| Member item | Cardinality | Value |
| --- | --- | --- |
| Label | exactly 1 | Unique lower-kebab member name |
| `via` | exactly 1 | `source` or earlier `member.<name>` traversal |
| `match` | exactly 1 | `type`, optional `kind` (default `resource`), and optional `where` |

Order is part of the contract. `source` means the declaration matched by the
parent rule. `member.name` must name a member already declared above the current
member. `provider`, `target`, forward references, and self references are
invalid as composition links.

A composition changes declaration accounting: member sources support one
representation. It does not create a new concept, context, or generic visual
group.

See [Traversals and scope](traversals.md) for path syntax and
[Expressions](expressions.md) for predicate operators.
