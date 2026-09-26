---
title: "Language tour"
description: "Follow a .rf.hcl source set from declaration matching to base representations, facts, composition, and policy linking."
---

The Rootform language interprets instances in a plan JSON or state JSON. This
tour follows one Dialect Rule from a resource to a fact, then asks a policy
question about it. Rootform ships RF Vocabulary and embedded Dialects with
every release; authored source stays inspectable and testable.

<!-- rootform:steps -->

## Declare a Dialect

```rf title="aws/dialect.rf.hcl"
dialect "aws" {
  version = "0.1.0"

  provider "hashicorp/aws" {
    version = "= 6.62.0"
  }
}
```

A Dialect owns its local definitions and Rules and imports no other Dialect. Any
reference to `rf.*` derives a dependency on the embedded RF Vocabulary.

## Start from the complete instance base

Every managed and data instance in the plan or state has a Representation,
even when no Rule recognizes its type. The base retains its address, type,
provider and known identity. A missing Rule is visible as uninterpreted,
instead of making the instance disappear.

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

```rf title="google/vocabulary.rf.hcl"
concept "load-balancer" {
  description = "A load-balancing service composed from routing infrastructure."
}
```

## Match and enrich an instance

```rf title="aws/network/vpc.rf.hcl"
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
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"
  }
}
```

`as` classifies an instance. The subnet Context resolves when its evaluated
`vpc_id` or verified saved-plan traversal identifies a virtual-network
instance. A source dependency alone never becomes an architecture fact.

A Rule must add classification, emission, or composition; a match-only Rule is
invalid. One accepted Rule is applied, and an ambiguous or undecidable predicate
keeps the instance base and records diagnostics.

## Choose a fact shape

- `context` records placement in a named dimension;
- a labeled `relation "name"` records a local directed predicate;
- an unlabeled `relation { as = ... }` reuses an existing local predicate;
- `contribution` links a contributor without absorbing it.

Each emission requires a `to` Concept or Rule, a `via` evidence path, and
`on_null` and `on_empty` choices. Explicit target matching supports `exact`,
`dot-ancestor`, and `last-segment`. See [emissions](reference/emissions.md).

## Compose implementation members

```rf title="google/load-balancing/application-load-balancer.rf.hcl"
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

Members are ordered: each `via` reads the root instance or an earlier member.
Rootform resolves them separately for every root instance and stage. An
unresolved member stays listed on its root with a reason, and a later member
that reads it is unresolved too; the root keeps its classification and
emissions. Members remain separate instances and never inherit the root Rule
or Concept. See [composition](reference/composition.md).

## Ask a policy question

```rf title="policies/pack.rf.hcl"
policy_pack "tutorial" {
  version = "0.1.0"
}
```

```rf title="policies/subnet-network-context.rf.hcl"
policy "subnet-network-context" {
  target {
    concept = rf.concept.subnet
  }

  assert = exists(contexts(rf.context.network, rf.concept.virtual-network))
  message = "Subnets must have an established virtual network context."
}
```

A policy source declares no dependencies. The linker derives exact RF Vocabulary
and Dialect identities from qualified references and the Rootform document. The policy ID
is `tutorial.policy.subnet-network-context`.

## Keep uncertainty explicit

Unknown traversal and ambiguous target leave a closure indeterminate with a
reason; proven absence records an absent closure. Neither case removes the
instance or invents an edge. A policy depending on that uncertain fact cannot
claim a pass. See [evaluation](reference/evaluation.md).

Validate authored Dialects and Policy Packs first. Test a Dialect against a
fixture containing `main.tf`, `plan.json`, the matching `plan.tfplan`, and an
`analysis.golden` Rootform document. Run the plan to inspect the instance,
facts and policy outcome. Comparing two inputs with `--diff` produces a
comparison document. The [authoring guide](../dialect-authoring.md) makes those
steps executable; [plan inputs](../inputs/plans.md) explains the export.

<!-- rootform:endsteps -->

Continue with [Write a Dialect](../dialect-authoring.md),
[Write a Policy Pack](write-policy-pack.md), or
[language reference](reference/index.md).
