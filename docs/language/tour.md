---
title: "Language tour"
description: "Follow real .rf definitions from source matching to architecture facts, composition, and policy evaluation."
---

This tour follows definitions used by official Dialects and tested fixtures.
It starts with the subnet from [your first architecture](../getting-started/first-architecture.md),
then adds the language features needed to explain more complex semantics and
governance.

You can read the tour without installing an authoring checkout. To run the
examples, install Rootform and use the public Dialects repository as described
in [Write a Dialect](../dialect-authoring.md).

<!-- rootform:steps -->

## Declare a Dialect

Every Dialect source root has exactly one `dialect` declaration. The official
AWS Dialect identifies itself, requires exact shared vocabulary from `core`,
and declares its provider compatibility envelope:

```hcl title="aws/dialect.rf"
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

Requirements expose vocabulary across Dialect boundaries. They do not copy
files or create an authoring import. Provider constraints participate in
Dialect selection; individual rules still state which source declarations they
recognize.

## Define vocabulary

Concepts give architectural representations stable meaning. This definition
comes from the official `core` Dialect:

```hcl title="core/network/virtual-network.rf"
concept "virtual-network" {
  kind        = scope
  description = "A virtual network that provides connectivity and isolation."
}

concept "subnet" {
  kind        = scope
  description = "A subnet that segments a virtual network."
}
```

`scope` is one of three closed concept kinds:

| Kind | Architecture role |
| --- | --- |
| `entity` | An independently represented component. |
| `scope` | A representation that can provide visible context or containment. |
| `detail` | Supporting information contributed to another representation. |

A context definition names a dimension in which placement has meaning:

```hcl title="core/architecture/contexts.rf"
context "network" {
  description = "Network placement or containment."
}
```

Concepts classify representations. Contexts classify placement facts. Neither
definition matches source by itself.

## Match a source declaration

A rule turns source evidence into a representation. The first half of the
official AWS subnet rule matches Terraform/OpenTofu managed resources whose
type is exactly `aws_subnet`:

```hcl title="aws/network/vpc.rf"
rule "subnet" {
  match {
    kind = "resource"
    type = "aws_subnet"
  }

  as = concept.core.subnet
}
```

`as` uses vocabulary from the directly required `core` Dialect. Compilation
resolves that reference to the canonical concept ID `core/subnet`. During an
architecture build, each matching declaration can produce one subnet
representation with source and rule provenance.

Rules can narrow a match with `where` when type alone is insufficient:

```hcl title="rule.rf"
match {
  kind  = "resource"
  type  = "google_compute_global_forwarding_rule"
  where = source.load_balancing_scheme == "EXTERNAL"
}
```

Predicates read fields from the initially matched source declaration. Missing,
unknown, or incompatible values do not become a safe match.

## Establish an architecture fact

The complete subnet rule adds network context:

```hcl title="aws/network/vpc.rf"
rule "subnet" {
  match {
    kind = "resource"
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

For the tutorial input, `source.vpc_id` resolves from
`aws_subnet.application` to `aws_vpc.main`. Rootform can therefore record:

| Produced fact | Proven by |
| --- | --- |
| `scope:aws_subnet.application` has concept `core/subnet` | Rule `aws/subnet` matched the source declaration. |
| `scope:aws_vpc.main` has concept `core/virtual-network` | Rule `aws/vpc` matched the referenced declaration. |
| Subnet has `core/network` context in the VPC | `aws_subnet.application.vpc_id` resolved to `aws_vpc.main`. |

The renderer can present the subnet inside the VPC because this context fact
exists. It does not infer containment from names, CIDR values, or a drawing
heuristic.

## Choose the fact shape

Rules can emit three kinds of connection fact:

| Block | Meaning | Source concept | Target concept |
| --- | --- | --- | --- |
| `context` | Placement in a named dimension | any represented kind | `entity` or `scope` |
| `contribution` | Supporting detail belongs to a representation | `detail` | `entity` or `scope` |
| `relation "type"` | A directional domain relationship | `entity` or `scope` | `entity` or `scope` |

Each fact names its target concept and a `via` traversal. A context also names
its dimension with `as`. The compiler rejects concept-kind combinations that
would make the graph invalid.

This tested contribution treats a node pool as supporting detail for a
cluster:

```hcl title="rule.rf"
contribution {
  to  = concept.cluster
  via = source.cluster
}
```

This tested relation expresses a named, directional claim:

```hcl title="rule.rf"
relation "reachability" {
  to  = concept.cluster
  via = source.cluster
}
```

Relation names carry domain meaning defined by the Dialect. A plain Terraform
reference does not automatically become a relation.

## Match by a value when no reference exists

Most facts follow source references directly. Some providers identify another
declaration with an equal scalar value instead. A fact-level `match` makes that
choice explicit:

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

Here Rootform compares the source value at `network` with candidate subnet
values at `name`. `dot-ancestor` is the other supported strategy; it accepts an
exact match or a candidate followed by `.` as a namespace ancestor. Both are
closed matching strategies, not general search expressions.

## Compose several declarations

Some provider APIs represent one architectural component with several linked
resources. The official Google Dialect composes a forwarding rule, HTTPS
proxy, URL map, and backend service into one load balancer representation:

```hcl title="google/load-balancing/application-load-balancer.rf"
rule "application-load-balancer" {
  match {
    kind = "resource"
    type = "google_compute_global_forwarding_rule"
  }

  as = concept.core.load-balancer

  composition {
    member "target-https-proxy" {
      via = source.target

      match {
        kind = "resource"
        type = "google_compute_target_https_proxy"
      }
    }

    member "url-map" {
      via = member.target-https-proxy.url_map

      match {
        kind = "resource"
        type = "google_compute_url_map"
      }
    }

    member "backend-service" {
      via = member.url-map.default_service

      match {
        kind = "resource"
        type = "google_compute_backend_service"
      }
    }
  }
}
```

Members are ordered. A member can follow `source` or an earlier named member;
it cannot refer forward or to itself. Supporting source declarations remain in
declaration accounting while the architecture gets one load balancer
representation.

## Ask a policy question

The official baseline Policy Pack declares exact vocabulary requirements and
groups policies under one versioned identity. This policy asks whether each
managed database has a private-reachability relation to a virtual network or
subnet:

```hcl title="policy-packs/baseline/pack.rf"
policy_pack "baseline" {
  version = "0.1.0"

  requires {
    core = "0.1.0"
  }

  policy "private-database-reachability" {
    target = concept.core.managed-database

    assert = (
      length(relations("private-reachability", concept.core.virtual-network)) > 0 ||
      length(relations("private-reachability", concept.core.subnet)) > 0
    )

    message = "Managed databases must be privately reachable from a virtual network or subnet."
  }
}
```

The policy evaluates once for each representation whose exact concept is
`core/managed-database`. `relations` reads outgoing facts from that target;
`length` turns the result into an integer for comparison. A false assertion is
a violation with the authored message and inspected fact IDs.

This result is only as strong as the facts available. Absence of a relation is
not live proof of public reachability. Review Dialect coverage before adopting
a policy as a gate.

## Let diagnostics stop invalid meaning

Rootform rejects unknown blocks, attributes, references, kinds, and expression
forms instead of silently ignoring them. For example, a misspelled fact target
can produce a stable code with a source range:

```text title="Diagnostic shape"
CONCEPT_UNKNOWN  rules/network.rf:18:10
```

Use `rootform validate dialects` while authoring a Dialect. Use
`rootform check` to evaluate a Policy Pack against a prepared architecture.
`rootform test` has a third role: it builds Dialect fixtures and compares their
Architecture IR with reviewed golden files.

<!-- rootform:endsteps -->

Continue with [Write a Dialect](../dialect-authoring.md) or
[Write a Policy](../guides/check-architecture.md). Use the
[language reference](reference/index.md) when you need exact accepted forms,
scope, and diagnostic codes.
