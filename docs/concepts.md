---
title: "Core concepts"
description: "Understand resource bases, Rule interpretation, facts, and evaluation before reading a Rootform result."
---

Rootform reads Terraform or OpenTofu and builds an architecture from the facts
it can establish. You can inspect that architecture, compare two versions, or
evaluate it against selected policies. Terraform or OpenTofu source remains
the place where infrastructure is defined.

## Every resource has a base representation

A normalized `resource` always has a representation, even when no [Dialect](concepts/dialects.md) knows its provider or type. The representation's stable ID follows from the normalized source identity. It does not depend on a Rule, Concept, label, icon, version, or location. Base carries known identity, address, kind, type, provider, name, and location.

A `data` declaration is different. It enters source accounting like any other declaration, but it receives a representation only when a successful Rule justifies one. A data source without successful interpretation remains a source fact, not an architecture element.

A Rule adds optional interpretation to an existing base: a Concept, facts such as a context, relation, or contribution, and an optional composition. The Concept is optional; its absence implies neither absence of the representation nor absence of its facts. Removing a Rule removes its interpretation and leaves the base and its representation ID unchanged.

## Rule coverage is not resource coverage

Coverage has two separate questions. Every normalized resource keeps a resource
base. A Rule adds interpretation when it applies successfully. A resource
without a Rule is an unclassified representation, not an unsupported resource,
and it is never filtered merely because no Rule knows it.

Read the summary before making a coverage claim. `rootform build` reports
represented resources, source declarations, resolved facts, omissions, and
diagnostics on standard error. A successful build can still contain resource
bases without Rules and explicit interpretation diagnostics. An exit status of
`0` means the architecture was built; it makes no coverage or governance claim.

## Meaning requires a Rule

[Architecture IR](concepts/architecture-ir.md) is the saved result of reading source: normalized declarations, semantic facts, accounting, provenance, and diagnostics. Every fact in that document is justified by the declaration and Rule that produced it.

Consider a subnet whose `vpc_id` refers to a VPC. Rootform can read the reference without knowing what a VPC means. The AWS Dialect supplies that meaning: both resources already have stable bases, and the subnet belongs to the VPC representation through network context. The resulting fact retains the declaration and Rule that justify it.

That distinction matters for other references. An expression might refer to a name, a credential, or a configuration value. Terraform references, `depends_on` entries, provider metadata, and naming proximity are evidence, not architecture relations. A Rule states how evidence produces meaning, and none of those source facts becomes a context, relation, or contribution automatically.

## Why Rootform does not run Terraform

Rootform does not start Terraform/OpenTofu, execute a provider, contact a backend, refresh state, or apply a plan. It does not download modules. This keeps architecture analysis separate from operations that need cloud access, credentials, state locks, or infrastructure changes.

You can build the [first example](getting-started/first-architecture.md) without
a cloud account. For a real project, materialize remote modules with your IaC
tool before analyzing configuration. To use facts from planning, give Rootform
a [JSON plan](inputs/plans.md) produced by that tool.

Reading source also imposes a boundary: Rootform cannot establish live health, prove connectivity, or discover deployed drift. An architecture reflects the supplied evidence and the effective semantic catalog. Unresolved evidence stays explicit in the saved document and must not disappear behind a tidy diagram.

## Uncertainty stays explicit

An emission on an applied Rule closes with confirmed facts, a proven omission, or a diagnostic. An omission is exclusive and means conclusively empty. Unknown, ambiguous, dangling, or incomparable evidence produces a diagnostic; it never proves absence, and it never converts to a pass.

The same rule applies to evaluation. A result that cannot be determined is different from a pass, and a comparison that cannot pair two sides is reported as undetermined rather than as no change.

## Determinism makes a result reviewable

Given the same supported input and exact semantic selections, Rootform produces the same canonical architecture bytes. Stable identities and ordering let a comparison track meaning without depending on file traversal order or screen coordinates. Provenance lets you ask why a fact exists.

A different Dialect version can change interpretation even when Terraform is
unchanged. The Rootform binary fixes supplied semantics; `rootform.lock` fixes
external selections. [Locks and offline operation](offline-security.md) explain
that boundary. [Architecture Diff](concepts/diff.md) distinguishes a changed
interpretation from an added or removed resource and marks conclusions affected
by incompatible semantic environments as undetermined.

## Describe first, evaluate second

A Dialect answers what the source means. A [policy](concepts/policies.md)
evaluates facts in the resulting architecture. Policies are distributed in
**Policy Packs**, which you select explicitly. `build` and `run` never evaluate
Policy Packs; `rootform check` evaluates selected policies. Building an
architecture does not run governance checks, and selecting a Dialect never
selects governance.

When you need to author semantics or governance, start with the [Rootform language overview](language/index.md). Concept pages explain why Dialects and policies exist; Language guides explain how to write their `.rf` source.
