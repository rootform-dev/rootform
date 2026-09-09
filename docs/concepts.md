---
title: "Core concepts"
description: "Understand architecture meaning, provenance, and governance before interpreting a Rootform result."
---

Rootform reads Terraform or OpenTofu and builds an architecture from the facts
it can establish. You can explore that architecture, compare two versions, or
evaluate it against selected policies. Your Terraform/OpenTofu source remains
the place where infrastructure is defined.

## From source to a claim

Consider a subnet whose `vpc_id` refers to a VPC. Rootform can read the reference
without knowing what a VPC means. The AWS [Dialect](concepts/dialects.md) supplies
that meaning: the VPC is a network scope, and the subnet belongs to its network
context. The resulting fact retains the declaration and rule that justify it.

That distinction matters for other references. An expression might refer to a
name, a credential, or a configuration value. Rootform does not turn every
reference or `depends_on` entry into a traffic-flow arrow. A relation needs a
rule that establishes its architectural meaning.

The result is [Architecture IR](concepts/architecture-ir.md), a saved document
with semantic facts, declaration accounting, provenance, and diagnostics.
The renderer reads those facts. Moving the camera or changing a view cannot
create a new architectural claim.

## Why Rootform does not run Terraform

Rootform does not start Terraform/OpenTofu, execute a provider, contact a
backend, refresh state, or apply a plan. It does not download modules. This
keeps architecture analysis separate from operations that need cloud access,
credentials, state locks, or infrastructure changes.

You can render the [first example](getting-started/first-architecture.md)
without a cloud account. For a real project, materialize remote modules with
your IaC tool before analyzing configuration. To use facts from planning,
give Rootform a [JSON plan](inputs/plans.md) produced by that tool.

Reading source also imposes a boundary: Rootform cannot establish live health,
prove connectivity, or discover deployed drift. An architecture reflects the
supplied evidence and the coverage of the selected Dialects. Unsupported and
unresolved input remain explicit; they must not disappear behind a tidy diagram.

## Determinism makes a result reviewable

Given the same supported input and exact semantic selections, Rootform produces
the same canonical architecture bytes. Stable identities and ordering let a
comparison track meaning without depending on file traversal order or screen
coordinates. Provenance lets you ask why a fact exists.

A different Dialect version can change interpretation even when Terraform is
unchanged. [Locks and offline operation](offline-security.md) control those
inputs. Diff rejects incompatible semantic selections instead of attributing
their effects to an infrastructure change.

## Describe first, evaluate second

A Dialect answers what the source means. A [policy](concepts/policies.md)
evaluates facts in the resulting architecture. Policies are distributed in
**Policy Packs**, which you select explicitly. Building or exploring an
architecture does not run governance checks.

Use the [renderer](renderer/index.md) to understand a result,
[Diff](renderer/diff.md) to understand change, and `rootform check` when the
question is whether selected rules hold. A result that cannot be determined
is different from a pass.

When you need to author semantics or governance, start with the
[Rootform language overview](language/index.md). Concept pages explain why
Dialects and policies exist; Language guides explain how to write their `.rf`
source.
