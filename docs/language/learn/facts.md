---
title: "Choose an architectural fact"
description: "Distinguish classification, Context, Relation and Contribution before choosing an emission."
---

One provider attribute can support several different architectural claims.
Choose the meaning first, then prove its target. A dependency tells Terraform
about ordering; it does not choose an architectural fact for Rootform.

## Classification is not a connection

A Concept answers what an instance represents. `as = rf.concept.subnet`
classifies it without establishing any network Context. A Rule may emit facts
without assigning a Concept, and an instance without a Rule remains represented.
Use an RF Vocabulary Concept only when its
[complete meaning](../reference/rf-vocabulary.md) fits. Define provider-specific
Concepts locally when it does not.

## Choose the claim and direction

| Need | Fact | Official example |
| --- | --- | --- |
| Record placement in a named dimension | Context, source to placement target | AWS subnet to VPC through `rf.context.network` |
| State a directed domain predicate | Relation, source to related target | AWS SNS subscription to topic through `aws.relation.subscribes-to` |
| Record an instance contributing to another | Contribution, contributor to beneficiary | AWS bucket versioning to its bucket |

Network placement does not prove reachability. A subscription Relation does
not prove messages were delivered. A versioning Contribution records the
configuration instance's support for its bucket; it does not absorb that
instance or prove all storage protections.

Context and Relation emissions either reuse a symbol through `as`, or introduce
or reuse a local symbol through a block label. Contribution has no named
predicate. Local definitions can document a symbol but do not emit facts.
[Fact emissions](../reference/emissions.md) owns the syntax.

## Prove the endpoint separately

Every emission declares `to`, `via`, `on_null` and `on_empty`.
`to` is a semantic requirement, such as a Concept or a specific Rule.
`via` names the source evidence path. It is not a target selector by itself.
Use an explicit `match` for value comparison, or a verified saved-plan reference
for direct endpoint resolution.

Several facts may use the same path when their declared meanings differ.
Neither a shared dependency nor similar resource names justify adding them.
If no emission exists, no closure exists for that claim: missing coverage is
not a declaration of absence.

Read [Evidence and target resolution](evidence-targets.md) before choosing
identity paths or external policy. [Policies over facts](policies.md) explains
why Contexts and Relations are queried from their source, while Contributions
are queried from their beneficiary.
