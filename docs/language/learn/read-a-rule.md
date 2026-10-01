---
title: "Read a Rule"
description: "Read an official subnet Rule from instance selection to network Context and its evidence."
---

A subnet has a Terraform instance address. Rootform needs a Rule to say that
it is a subnet and that its VPC reference establishes network placement.
Those are separate claims: classifying the instance does not prove its target.

This is the current subnet Rule from the official AWS Dialect,
[aws/network/vpc.rf.hcl](../../../dialects/aws/network/vpc.rf.hcl):

```rf title="aws/network/vpc.rf.hcl"
rule "subnet" {
  match {
    type = "aws_subnet"
  }

  as = rf.concept.subnet

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

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

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
```

## Select and classify the instance

`match` chooses managed `aws_subnet` instances; managed is the default kind.
The AWS Dialect's provider declaration binds the provider source.
`as` assigns the optional Concept `rf.concept.subnet`. It does not inspect
traffic or prove connectivity.

At most one Rule applies per instance and stage. Two accepted Rules are
ambiguous, not alternatives tried in file order. An eligible Rule with an
unknown predicate prevents selection around that uncertainty. Use `where`
only when known values distinguish the intended cases. A data source requires
`kind = "data"`. Instances with no applicable Rule keep their Representations.
[Rules and matching](../reference/rules.md#selection-precedence) defines selection.

## Identify the subnet when another Rule targets it

The subnet's `identity` allows its known `id` to participate in value matching.
Its `endpoint` permits a verified reference ending in that subnet's `id` to
identify it. These blocks describe the subnet as a **target of other Rules**;
they do not resolve this Rule's VPC Context.

Identity paths are alternatives, not parts concatenated into a key. Declare
only forms another resource can actually use to name this instance. Neither
block changes its Representation ID, which remains its instance address, or
copies these attribute values into the Form.

## Establish network placement

The `context` block names network placement with `as`, requires a
virtual-network target with `to`, and reads `source.vpc_id` with `via`.
Its nested `match` compares that value with eligible targets' `id` attributes.
The target Rule must declare the required identity. The official VPC Rule does:

```rf title="VPC target declarations, excerpt"
identity {
  attributes = ["id"]
  scope      = "provider"
}

endpoint {
  attributes = ["id", "cidr_block"]
}
```

`external = "allow"` handles a VPC managed outside this input. It does not
verify that VPC remotely. Here disclosure defaults to `"none"`.
`on_null` and `on_empty` say those known values establish absence of this
Context. Unknown is a different state.

## Read the conclusion

The emission gets a closure for each applied subnet instance and stage. A
resolved fact records its Rule, emission, closure and evidence kind. A closure
can instead report absence or explain why the target remains indeterminate.
The closure is produced from evidence, not authored as another block.

Continue with [Choose an architectural fact](facts.md), then
[Evidence and target resolution](evidence-targets.md) to understand when
value matching, verified references, or both establish the target.
