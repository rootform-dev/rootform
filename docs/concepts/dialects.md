---
title: "Dialects and RF Vocabulary"
description: "Understand how Dialects interpret source evidence and how RF Vocabulary provides shared architectural terms."
---

A Dialect is a named, versioned unit of source interpretation. Its Rules turn
Terraform or OpenTofu evidence into architectural meaning. A Dialect does not
decide which source declarations exist and does not create missing resources.

## Interpretation enriches resource base

Every normalized `resource` already has a base representation. A Rule can then
add a Concept, Context, Relation, Contribution, or Composition. No matching Rule
leaves an unclassified representation rather than an unsupported resource.

`data` declarations follow a stricter boundary. They remain source-accounted but
gain a representation only when a successful Rule justifies one.

This distinction separates two coverage questions.

- **Resource coverage** asks which normalized resources have representations.
- **Rule coverage** asks which declarations received successful semantic
  interpretation.

Rule coverage can be narrower than resource coverage. A successful build status
does not claim every representation has Rule or Concept.

## Rule explains why fact exists

For a subnet whose `vpc_id` refers to a VPC, the AWS Dialect can classify the
subnet and establish a network Context toward the VPC. The resolved reference is
evidence. The Rule gives that evidence architectural meaning.

Without a Rule, the reference remains a source fact only. Provider type, provider
version, naming similarity, and `depends_on` also create no architectural
connection automatically. [Core concepts](../concepts.md#references-are-evidence-not-meaning)
explains this boundary across all fact types.

A Rule can establish facts without assigning a Concept. Removing the Rule
removes its interpretation, but does not delete the underlying resource
representation or change the representation's stable identity.

## RF Vocabulary provides shared terms

RF Vocabulary is an embedded language contract owned by the reserved `rf` namespace.
It provides shared Concepts and Contexts such as
`rf.concept.virtual-network`, `rf.concept.subnet`, and
`rf.context.network`.

RF Vocabulary is not a Dialect. It has no provider envelope, cannot be excluded
or replaced, and is never installed or vendored. Dialects can reference its
shared terms so architecture from different providers can use common meaning.
Dialect-owned meaning keeps owner-first identity such as `aws.rule.subnet`.

The exact symbols belong in the [RF Vocabulary reference](../language/reference/rf-vocabulary.md).

## Inspect effective semantics

Run these inspections from the project root with the Rootform binary used for
the build. The embedded release set is available without a lock. External
selections must already be prepared according to project configuration.

<!-- docs-check:concept-dialect-list -->
```sh
rootform list dialects --dialect aws -o wide
```

```text title="AWS Dialect summary"
NAME  VERSION  ORIGIN    CONCEPTS  CONTEXTS  RELATIONS  RULES
aws   0.1.0    embedded        64         0          1    108
```

Origin confirms which selected unit supplies the Dialect. Counts expose the
semantic surface, not coverage of the current project.

Inspect the Rule behind subnet interpretation.

<!-- docs-check:concept-dialect-show-rule -->
```sh
rootform show aws.rule.subnet
```

```text title="Subnet Rule summary"
aws.rule.subnet

Matches   resource "aws_subnet"
Produces  rf.concept.subnet
Defined   network/vpc.rf.hcl:9

Contexts (1)
  rf.context.network
    with  rf.concept.virtual-network
    via   source.vpc_id
```

The output connects the source type, produced Concept, and network Context
evidence. These commands inspect effective selection and do not change it.

## Embedded and external selection

The Rootform binary carries RF Vocabulary and supplied Dialects. Updating the
binary can therefore update embedded interpretation. External Dialects are
selected explicitly by exact owner, version, and digest in `rootform.lock`. Whole-owner
exclusion or replacement can change which Dialect interprets source.

Selection consequences are semantic. The same Terraform can produce different
Concepts, facts, diagnostics, or Rule coverage under different effective
Dialect selection. Rootform does not reinterpret saved Architecture IR using
the current binary. The saved document keeps the producer's semantic snapshot.

Use [Select Dialects and Policy Packs](../cli.md) to understand effective
project selection and [Use external Dialects and Policy Packs](../guides/external-content.md)
to configure exact external content. For authoring, continue separately with
[Write a Dialect](../dialect-authoring.md) and
[Dialect language reference](../language/reference/dialects.md).
