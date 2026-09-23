---
title: "Core concepts"
description: "Understand how Rootform turns source evidence into architectural meaning, then compares and evaluates that meaning."
---

Rootform reads Terraform or OpenTofu evidence and produces an architecture that
can be explored, compared, and evaluated. Source remains where infrastructure
is defined. Rootform adds architectural meaning without running an apply or
claiming knowledge it cannot establish.

## From source to architecture

Rootform keeps three layers separate.

1. **Source evidence** records declarations, expressions, references, and
   locations found in the selected input.
2. A **Dialect** applies Rules that interpret that evidence as architectural
   Concepts and facts.
3. **Architecture IR** saves representations, facts, provenance, diagnostics,
   and the exact semantic snapshot used to produce them.

A [Policy](concepts/policies.md) evaluates the saved meaning afterward.
[Architecture Diff](concepts/diff.md) compares meaning between two saved
architectures. Neither operation changes the architecture it reads.

## Every resource starts with a representation

Every normalized `resource` has a base representation, even when no Rule knows
its provider or type. Its stable identity derives from normalized source
identity. It does not depend on a Rule, Concept, display label, icon, version,
or position in a file.

A `data` declaration is different. It is always source-accounted, but it gains
a representation only when a successful Rule justifies one. A data source
without successful interpretation remains known source evidence, not an
architecture element.

A Rule enriches an existing representation. It may classify it with a Concept,
establish facts, or compose several representations. Concept is optional. A
representation can therefore exist without a Concept, and facts can exist
without a Concept when their Rule establishes them.

Rule coverage and resource coverage answer different questions. Removing or
changing a Rule can alter interpretation while the underlying resource
representation and its stable identity remain.

## References are evidence, not meaning

Suppose `aws_subnet.application.vpc_id` refers to `aws_vpc.main.id`. Rootform
can read that reference as source evidence. An AWS Dialect Rule explains what it
means architecturally and establishes a network Context from subnet to VPC.

References, `depends_on`, provider metadata, and similar names do not create
Contexts, Relations, or Contributions by themselves. They become architecture
facts only through explicit Rule interpretation. Provenance then records which
source evidence, Rule, and emission justified each fact.

## Read each architectural connection precisely

Rootform uses distinct structures because they answer distinct questions.

| Structure | Question answered | What it does not imply |
| --- | --- | --- |
| **Representation** | Which architecture element exists? | That it has a Concept, Rule, or visible standalone card |
| **Context** | In which architectural frame is one representation placed? | Network connectivity, reachability, or dependency |
| **Relation** | Which domain-specific connection did a Rule establish? | Every source reference between both declarations |
| **Contribution** | Which representation contributes to another? | Ownership, containment, or a parent for the contributor |
| **Composition** | Which proven members form one composed representation? | Placement of those members in a Context |

A representation may have several Contexts in different dimensions. A
Contribution keeps contributor and target as distinct representations.
Composition is stronger than visual grouping because it creates one composed
root from proven members, yet members retain their own bases and do not inherit
the root Concept.

Architecture existence and rendered visibility are also different. A renderer
may group, compose, or omit a standalone visual card while valid Architecture
IR still contains the representation and its facts. Inspect the saved
architecture or use `rootform explain architecture` when exact membership and
provenance matter.

## Rootform reports what evidence permits

Each active Rule emission closes in one of three ways.

- A **fact** means the evidence established an architectural claim.
- An **omission** means Rootform proved the relevant fact absent.
- A **diagnostic** means evidence was insufficient, ambiguous, dangling, or
  otherwise unresolved.

Omission and insufficient evidence are not interchangeable. Unknown evidence
cannot prove absence. It also cannot become a passing Policy result or a
no-change conclusion in Diff.

Partial architectures are expected. Rule-free resource bases and explicit
diagnostics can belong to a valid document. Structural invalidity is different
and prevents consumers from making governance or comparison claims.

## Rootform does not run Terraform

Rootform does not start Terraform or OpenTofu, execute providers, contact a
backend, refresh state, apply a plan, or download modules. Remote modules must
already be materialized by the IaC tool. Plan-derived evidence must come from a
[Terraform or OpenTofu JSON plan](inputs/plans.md).

This boundary keeps architecture analysis away from credentials, state locks,
and infrastructure changes. It also means Rootform cannot establish live
health, runtime connectivity, or deployed drift. Architecture describes
supplied evidence and effective semantic selection.

## Determinism makes evidence reviewable

The same supported input and exact semantic selection produce the same
canonical Architecture IR bytes. Stable identities preserve source continuity.
Canonical ordering removes traversal noise. Provenance explains why a fact
exists.

Dialect evolution can change interpretation even when Terraform is unchanged.
The Rootform binary fixes embedded semantics and `rootform.lock` fixes external
selection. [Project configuration](cli.md) explains effective selection.
[Locks and vendored content](offline-security.md) explains reproducible use.

Continue with [Dialects and RF Vocabulary](concepts/dialects.md) for
interpretation, [Policies and Policy Packs](concepts/policies.md) for
governance, or [Architecture IR](concepts/architecture-ir.md) for the saved data
contract.
