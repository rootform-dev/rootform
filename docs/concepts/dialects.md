---
title: "Dialects and RF Vocabulary"
description: "Understand how Dialects interpret plan and state instances using shared architectural terms."
---

A Dialect is a named, versioned unit of interpretation. Its Rules match Terraform or OpenTofu plan and state instances and can add Concepts, Contexts, Relations, Contributions, or composition meaning. A Dialect does not decide which observed instances exist and cannot create a missing managed or data instance.

## Interpretation enriches an instance base

Every observed managed and data instance has a Representation before a Rule interprets it. A matching Rule can classify that instance and establish facts. With no matching Rule, the instance remains represented without a guessed Concept. This is a coverage gap, not the same as a Rule whose endpoint cannot be resolved from available evidence. See [Core concepts](../concepts.md#every-observed-instance-starts-with-a-representation) for the distinction between instance and Rule coverage.

Rule matching uses source kind, resource type, provider binding, and any predicate over supported instance evidence. Two instances of one Terraform declaration can therefore receive different interpretation. An ambiguous or failed interpretation leaves its own status and diagnostics. It does not silently fall back to a plausible Rule. See [Core concepts](../concepts.md#every-observed-instance-starts-with-a-representation).

## How a Rule establishes a fact

For a subnet whose `vpc_id` identifies a VPC, an AWS Rule can classify the subnet and establish a network Context toward that VPC. The value or verified direct traversal is evidence. The Rule gives it architectural meaning. A `depends_on` edge, matching resource name, or provider type alone creates no Context or Relation. [Core concepts](../concepts.md#references-are-evidence-not-meaning) explains this boundary across all fact types.

An emission closes as `resolved`, `absent`, or `indeterminate` per instance. A verified saved plan can establish a planned-stage identity traversal when a value is unknown until apply. A state export has values and masks but no traversal snapshot. If an eligible target has unknown identity, the closure can remain indeterminate even if one candidate looks plausible. [Forms and Rootform documents](forms.md#stages-and-facts) explains closures and provenance.

## RF Vocabulary provides shared terms

RF Vocabulary is an embedded language contract owned by the reserved `rf` namespace. It supplies shared Concepts and Contexts, including `rf.concept.virtual-network`, `rf.concept.subnet`, and `rf.context.network`. It is not a provider Dialect: it has no provider binding or Rules, cannot be excluded or replaced, and is never installed or vendored. Provider Dialects can use these terms so architectures from different providers share a vocabulary; Dialect-owned meaning retains its own owner identity, such as `aws.rule.subnet`.

The [RF Vocabulary reference](../language/reference/rf-vocabulary.md) lists exact symbols. A shared Concept does not imply identical provider behavior. Its Rule and evidence still explain each fact.

## Inspect active Dialects

The executable embeds the official Dialects and RF Vocabulary. They are available without a project lock; external selections must already be prepared as the project lock describes. Run these inspections from the project root with the binary used for the analysis, then inspect a Rule before interpreting a result:

<!-- docs-check:concept-dialect-list -->
```sh
rootform list dialects aws -o wide
```

<!-- docs-output:concept-dialect-list -->
```text title="AWS Dialect summary, excerpt"
NAME  VERSION  ORIGIN    CONCEPTS  CONTEXTS  RELATIONS  RULES
aws   0.1.0    embedded        64         0          1    108
```

<!-- docs-check:concept-dialect-show-rule -->
```sh
rootform show aws.rule.subnet --color always
```

<!-- docs-output:concept-dialect-show-rule -->
```ansi title="Subnet Rule, excerpt"
[1maws.rule.subnet[0m

[2mMatches[0m   resource "aws_subnet"
[2mProduces[0m  rf.concept.subnet
[2mDefined[0m   network/vpc.rf.hcl:18

[1m[38;5;208mContexts (1)[0m
  rf.context.network
    with  rf.concept.virtual-network
    via   source.vpc_id
```

`ORIGIN` confirms which unit supplies the Dialect, such as `embedded` for the binary or `local` for a project source. Counts describe the Dialect's definitions, not coverage of the current project. The Rule inspection identifies the source type, produced Concept, and network Context emission. `rootform explain architecture` shows which Rule actually interpreted an instance and which closures resolved. See the [show reference](../reference/cli/show.md) for inspection forms.

## Embedded and external selection

The binary fixes its embedded Dialects. `rootform.lock` records exact external selections, exclusions, and replacements. A provider binding retains the observed registry host, address, alias, and module context; Rootform does not assume two registries are equivalent because a provider name matches. Explicit provider mapping can make a binding choice visible and reviewable.

Changing the active Dialect selection can change Concepts, facts, diagnostics, and coverage even when a plan is unchanged. A saved Rootform document keeps the Dialect selection used for interpretation; reopening it does not reinterpret its instances. [Select Dialects and Policy Packs](../cli.md) explains command selection, and [external content](external-content.md) explains installation and locks. To author interpretation, use [Write a Dialect](../dialect-authoring.md) and the [Dialect language reference](../language/reference/dialects.md).
