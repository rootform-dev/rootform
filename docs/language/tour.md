---
title: "Language tour"
description: "Follow one subnet from exported plan evidence through a Dialect Rule, network Context, closure and Policy."
---

A subnet belongs to a VPC. This tour teaches how a Rule turns that reference
into network Context, then how a Policy checks the established fact.

Start with the two-resource VPC and subnet plan from
[Trace a placement](../getting-started/first-architecture.md). Keep its `plan.json`
and matching `plan.tfplan` in your working directory. The subnet's `vpc_id` is
unknown before apply, but its configuration directly references `aws_vpc.main.id`.
The [plan-input guide](../inputs/plans.md) gives export commands for both producers.

<!-- rootform:steps -->

## Name the Dialect

Save these files beneath `./aws`. This example uses the embedded AWS owner
for a command-local source override; a distributable Dialect uses your own owner.

```rf title="aws/dialect.rf.hcl"
dialect "aws" {
  version = "0.1.0"

  provider "hashicorp/aws" {
    version = "= 6.62.0"
  }
}
```

The source root supplies identity and a provider binding. Files do not create
imports or matching priority. The `rf` owner names the embedded RF Vocabulary.

## Classify both instances and declare the connection

```rf title="aws/network/vpc.rf.hcl"
rule "vpc" {
  match {
    kind = "resource"
    type = "aws_vpc"
  }

  as = rf.concept.virtual-network

  identity {
    attributes = ["id"]
  }

  endpoint {
    attributes = ["id"]
  }
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

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
```

Every instance already has a Representation. `as` classifies the VPC and subnet.
The VPC's `identity` makes its known `id` available for value matching; `endpoint`
allows a verified reference to that ID to name the instance before the value is
known. The subnet's Context reads `source.vpc_id` and requires a virtual-network
target. Its nested `match` supplies the value-comparison route.

## Produce a Form from the plan pair

<!-- docs-check:language-tour-run-pair -->
```sh
rootform validate dialects ./aws
rootform run plan.json --plan-file plan.tfplan --dialect ./aws \
  --no-serve -o analysis.json
```

In `analysis.json`, the Planned stage contains both Representations, a network
Context from `aws_subnet.application` to `aws_vpc.main`, and a `resolved` closure.
Its fact provenance records `traversal`: the saved plan identifies the endpoint
without requiring the unknown ID. The Form records the evidence behind that
claim. No live cloud connection was tested.

## See the boundary without enrichment

<!-- docs-check:language-tour-run-values -->
```sh
rootform run plan.json --dialect ./aws --no-serve -o values-only.json
```

The two instances retain their classification. The unknown `vpc_id` cannot
establish the Context alone, so its closure is
`indeterminate(unknown_until_apply)`. A known ID could resolve by value matching
when target identity and provider compatibility are established. The saved plan
is optional enrichment, not an architectural input requirement.

## Check the architectural fact

Save the manifest and Policy beneath `./policies`:

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

<!-- docs-check:language-tour-check-pair -->
```sh
rootform check analysis.json --policy-pack ./policies
```

The subnet has one confirmed network Context, so this Policy passes with exit `0`.
The check reads the saved Form; it does not rebuild the architecture.

<!-- docs-check:language-tour-check-values -->
```sh
rootform check values-only.json --policy-pack ./policies
```

This check is indeterminate and exits `3`. Zero confirmed facts under an
indeterminate closure do not prove that the subnet lacks a VPC. To prove absence,
the Rule would need known evidence under its declared null/empty policy and a
complete relevant population.

<!-- rootform:endsteps -->

[Read a Rule](learn/read-a-rule.md) explains the complete official version.
[Evidence and target resolution](learn/evidence-targets.md) covers known values,
state evidence, ambiguity and external endpoints. Then follow
[Write a Dialect](../dialect-authoring.md) or
[Write a Policy Pack](write-policy-pack.md) to author your own source.
