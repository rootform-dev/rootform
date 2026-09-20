---
title: "Built-ins"
description: "Complete RF Policy built-in signatures, required and optional parameters, return types, support, and completeness semantics."
---

Rootform language 0.1.0 has five built-ins. They are available only in Policy
`assert`.

| Function | Signature | Return |
| --- | --- | --- |
| `exists` | `exists(query)` | Boolean or unknown |
| `length` | `length(query)` | Integer or unknown |
| `contexts` | `contexts(dimension[, target])` | Opaque query |
| `relations` | `relations(predicate[, target])` | Opaque query |
| `contributions` | `contributions(contributor)` | Opaque query |

Query values are opaque. They can appear only as direct argument to
`exists` or `length`.

## Complete example

```hcl title="built-ins/pack.rf.hcl"
policy_pack "architecture-contracts" {
  version = "0.1.0"
}

policy "subnet-has-network" {
  target {
    concept = rf.concept.subnet
    rules   = [aws.rule.subnet]
  }

  assert = exists(
    contexts(rf.context.network, rf.concept.virtual-network)
  )

  message = "Each subnet must declare its virtual network."
}

policy "subscription-has-topic" {
  target {
    rules = [aws.rule.sns-topic-subscription]
  }

  assert = exists(
    relations(aws.relation.subscribes-to, aws.concept.message-topic)
  )

  message = "Each subscription must declare its topic."
}

policy "bucket-has-versioning-contribution" {
  target {
    concept  = rf.concept.object-storage-container
    dialects = ["aws"]
  }

  assert = length(
    contributions(aws.rule.s3-bucket-versioning)
  ) >= 1

  message = "Each AWS bucket must have a versioning contribution."
}
```

## Executable architecture

This minimal Terraform configuration produces one target and one matching fact
for each Policy above. Rootform's documentation gate builds it and evaluates all
three Policies against resulting Architecture IR.

```hcl title="built-ins/main.tf"
terraform {
  required_version = ">= 1.14.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

resource "aws_vpc" "main" {
  cidr_block = "10.20.0.0/16"
}

resource "aws_subnet" "application" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.1.0/24"
}

resource "aws_sns_topic" "events" {}

resource "aws_sns_topic_subscription" "events" {
  topic_arn = aws_sns_topic.events.arn
  protocol  = "https"
  endpoint  = "https://example.com/events"
}

resource "aws_s3_bucket" "assets" {
  bucket = "rootform-docs-assets"
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}
```

## `exists`

```text
exists(query) -> Boolean | unknown
```

| Parameter | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `query` | Direct `contexts`, `relations`, or `contributions` call | Yes | None | Architecture fact selection for current Policy target |

Exactly one argument is required.

| Query evidence | Result |
| --- | --- |
| One or more confirmed facts | `true`, even if other evidence is incomplete |
| Supported, complete, zero facts | `false` |
| Unsupported or incomplete, zero confirmed facts | Unknown |

`exists` can prove presence from one confirmed fact. It cannot prove absence
without both support and completeness.

## `length`

```text
length(query) -> integer | unknown
```

| Parameter | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `query` | Direct `contexts`, `relations`, or `contributions` call | Yes | None | Architecture fact selection for current Policy target |

Exactly one argument is required.

`length` returns deduplicated fact count only when query is supported and
complete. Any relevant uncertainty makes count unknown, even if some facts are
confirmed, because exact cardinality is not proved.

```hcl
assert = length(contexts(rf.context.network)) == 1
```

## `contexts`

```text
contexts(dimension[, target]) -> query
```

Returns direct outgoing Context facts from current Policy target
representation.

| Parameter | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `dimension` | Qualified Context reference | Yes | None | Exact Context dimension |
| `target` | Qualified Concept or Rule reference | No | No target filter | Restrict emission target contract |

Accepted arity is one or two.

```hcl
assert = exists(contexts(rf.context.network))
assert = exists(
  contexts(rf.context.network, rf.concept.virtual-network)
)
```

Without second argument, support exists when applied Rule declares compatible
Context emission for dimension. With second argument, emission's `to` must
match exact Concept or Rule reference.

Function does not follow Contexts transitively.

## `relations`

```text
relations(predicate[, target]) -> query
```

Returns direct outgoing Relation facts from current Policy target
representation.

| Parameter | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `predicate` | Qualified Relation reference | Yes | None | Exact Relation predicate |
| `target` | Qualified Concept or Rule reference | No | No target filter | Restrict emission target contract |

Accepted arity is one or two.

```hcl
assert = exists(relations(aws.relation.subscribes-to))
assert = exists(
  relations(aws.relation.subscribes-to, aws.concept.message-topic)
)
```

Second argument matches emission's authored `to` contract exactly. AWS
subscription Rule emits `to = concept.message-topic`, so
`aws.concept.message-topic` is supported; replacing it with
`aws.rule.sns-topic` would not describe same query contract even when concrete
topic representation carries that Rule.

No inverse, recursive, or transitive relation query exists.

## `contributions`

```text
contributions(contributor) -> query
```

Returns Contributions arriving at current Policy target representation from a
matching contributor.

| Parameter | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `contributor` | Qualified Concept or Rule reference | Yes | None | Required semantic identity of contributing representation |

Accepted arity is exactly one.

```hcl
assert = exists(contributions(aws.rule.s3-bucket-versioning))
assert = length(contributions(aws.concept.storage-configuration)) >= 1
```

Unlike Contexts and Relations, Contributions are queried from receiving target
back toward contributors. Query considers Rules whose Contribution emission
`to` matches current target representation and whose own identity satisfies
`contributor`. A compatible contributor Rule can establish query support even
when architecture has zero instances of that Rule; facts and support are
separate.

## Qualified arguments

All semantic arguments are owner-qualified in Policy source:

| Accepted | Rejected |
| --- | --- |
| `rf.context.network` | `context.network` |
| `aws.relation.subscribes-to` | `relation.subscribes-to` |
| `aws.rule.subnet` | `rule.subnet` |
| `rf.concept.virtual-network` | `concept.virtual-network` |

Linker verifies each referenced symbol against Architecture IR before producing
compiled Policy Pack.

## Support, completeness, and evidence

Each query internally carries:

| Signal | Meaning |
| --- | --- |
| Facts | Confirmed matching Architecture IR fact IDs |
| Supported | Loaded Rule emission contracts can answer query shape |
| Complete | Relevant architecture and emission evidence has no unresolved gap |
| Evidence | Emission, omission, resolution, and diagnostic IDs inspected |

A known-empty emission can support complete zero result. Missing compatible
emission contract means unsupported, not empty. Emission warning can leave
confirmed facts while marking result incomplete.

These signals explain why `exists` and `length` differ under uncertainty.
See [Evaluation](evaluation.md#query-truth) for truth tables.

## Rejected calls

```hcl title="invalid built-ins"
assert = contexts(rf.context.network)
assert = exists()
assert = exists(contexts())
assert = length(relations(aws.relation.subscribes-to, aws.rule.sns-topic, aws.rule.subnet))
assert = contributions(aws.rule.s3-bucket-versioning)
assert = count(contexts(rf.context.network))
```

Failures include bare query, wrong wrapper arity, wrong query arity, and unknown
function. Each produces `POLICY_INVALID`.
