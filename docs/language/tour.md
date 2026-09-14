---
title: "Language tour"
description: "Follow a .rf source set from declaration matching to base representations, facts, composition, and policy linking."
---

The Rootform language turns normalized Terraform and OpenTofu evidence into
Architecture IR. Rootform ships RF Vocabulary and its supplied Dialects with
every release, and every authoring source stays inspectable and independently
testable.

<!-- rootform:steps -->

## Declare a Dialect

```hcl title="aws/dialect.rf"
dialect "aws" {
  version = "0.1.0"

  provider "hashicorp/aws" {
    version = "= 6.62.0"
  }
}
```

A Dialect owns its local definitions and Rules and imports no other Dialect. Any
reference to `rf.*` derives a dependency on the embedded RF Vocabulary.

## Start from the complete resource base

Every normalized `resource` becomes a base representation even when no Rule
recognizes its type. The base holds the known source identity, address, type,
provider, name, and location, so a missing Rule or Concept is not an error.

A data source differs: its declaration stays in the source inventory, and a
representation requires a successfully applied Rule.

## Use common and local vocabulary

RF Vocabulary is part of the language contract and uses the reserved `rf` owner.
Version 0.1 defines six Concepts:

- `rf.concept.virtual-network`;
- `rf.concept.subnet`;
- `rf.concept.kubernetes-cluster`;
- `rf.concept.managed-database`;
- `rf.concept.object-storage-container`;
- `rf.concept.service-identity`.

It also defines `rf.context.network` and `rf.context.runtime`, and no Relations.
RF Vocabulary ships with the release, so it is never installed or vendored.
Dialect-specific meaning stays local:

```hcl title="google/vocabulary.rf"
concept "load-balancer" {
  description = "A load-balancing service composed from routing infrastructure."
}
```

## Match and enrich a declaration

```hcl title="aws/network/vpc.rf"
rule "vpc" {
  match {
    kind = "resource"
    type = "aws_vpc"
  }

  as = rf.concept.virtual-network
}

rule "subnet" {
  match {
    kind = "resource"
    type = "aws_subnet"
  }

  as = rf.concept.subnet

  context {
    as  = rf.context.network
    to  = rf.concept.virtual-network
    via = source.vpc_id
  }
}
```

`as` adds optional nominal classification. The subnet context exists only when
the `vpc_id` traversal proves a target representation with the requested Concept.
A source dependency alone never becomes an architecture fact.

A Rule must add classification, emission, or composition; a match-only Rule is
invalid. One accepted Rule is applied, and an ambiguous or undecidable predicate
keeps the resource base and records diagnostics.

## Choose a fact shape

- `context` records placement in a named dimension;
- a labeled `relation "name"` records a local directed predicate;
- an unlabeled `relation { as = ... }` reuses an existing local predicate;
- `contribution` links a contributor without absorbing it.

Each emission requires a `to` Concept or Rule and a `via` evidence path. Explicit
target matching supports only `exact` and `dot-ancestor`.

## Compose source declarations transactionally

```hcl title="google/load-balancing/application-load-balancer.rf"
rule "application-load-balancer" {
  match {
    kind = "resource"
    type = "google_compute_global_forwarding_rule"
  }

  as = concept.load-balancer

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
  }
}
```

Members are ordered, required, and exclusive. Any member failure rejects the
whole Rule application, including `as` and emissions, and the root resource keeps
its base. Member declarations remain, and every resource member keeps its own
base without inheriting the root Rule or Concept.

## Ask a policy question

```hcl title="policies/pack.rf"
policy_pack "tutorial" {
  version = "0.1.0"
}
```

```hcl title="policies/subnet-network-context.rf"
policy "subnet-network-context" {
  target {
    concept = rf.concept.subnet
  }

  assert = exists(contexts(rf.context.network, rf.concept.virtual-network))
  message = "Subnets must have an established virtual network context."
}
```

A policy source declares no dependencies. The linker derives exact RF Vocabulary
and Dialect pins from qualified references and the Architecture IR. The policy ID
is `tutorial.policy.subnet-network-context`.

## Keep uncertainty explicit

Unknown traversal, ambiguous target, incompatible provider, and failed
composition produce stable diagnostics. Proven absence produces omission.
Neither case deletes a resource base or invents fallback meaning.

```text title="Diagnostic shape"
CONCEPT_UNKNOWN  rules/network.rf:18:10
```

Compiled definitions build Architecture IR. Use `rootform validate dialects` for
language source, `rootform test` for reviewed Architecture IR fixtures, and
`rootform check` for policies. `rootform diff` compares two built documents.

<!-- rootform:endsteps -->

Continue with [Write a Dialect](../dialect-authoring.md),
[Write a Policy Pack](write-policy-pack.md), or
[language reference](reference/index.md).
