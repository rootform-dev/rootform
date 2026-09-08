---
title: "Policies and Policy Packs"
description: "Understand what a policy evaluates, how packs are selected, and what a successful check can prove."
---

A policy asks whether a rule holds for facts in a Rootform architecture. For
example, a subnet policy can require an established network context. It reads
the context produced by a Dialect; it does not contact a cloud provider to find
one or invent a missing relationship.

## Policy Packs

A **Policy Pack** gives policies a shared name, version, and distribution unit.
Every policy belongs to exactly one pack. `tutorial/subnet-network-context`
names the policy `subnet-network-context` in the pack `tutorial`.

Use a pack when a group of policies should travel together. A project lock pins
that set so repeat checks can evaluate the same policy source. Selecting a pack
still requires checking that its assumptions match the facts your Dialects produce.

## What happens during a check

A run of `rootform check` selects policies, validates their required vocabulary,
and evaluates each policy against each representation with its exact target
concept. One policy matching ten targets produces ten **evaluations**. The
result keeps the policy identity, target identity, outcome, and inspected facts.

A pack's `requires` declarations name the exact Dialect vocabulary it uses.
They do not authorize a pack to rewrite those Dialects or add facts to the
architecture. The pack contains public, reviewable rules; the executable
validates and evaluates them against Architecture IR.

Use the [worked policy example](../guides/check-architecture.md) to see a complete
pack and an observed result before reading the machine contract.

## Governance is an explicit choice

Provider detection selects Dialects. It does not select Policy Packs.
`build` and `run` ignore governance; installing a Dialect or opening its render
is not a compliance check.

For a project, select a published pack with `rootform init --policy-pack` and
review the resulting lock. `check` then uses that selection. During authoring,
`check --policy-pack ./policies` reads a local pack directly. These are different
uses of the flag: an OCI reference for initialization, a directory for a local
check. `--policy` restricts evaluation to named policies within the selected packs.

A check over an existing architecture does not acquire missing packages.
Prepare the project and make selected Policy Packs available before evaluating
that document.

## Read the outcome and the scope

| Outcome | Meaning |
| --- | --- |
| `passed` | The assertion is known to hold for this target. |
| `violated` | The assertion is known to be false for this target. |
| `indeterminate` | Rootform cannot decide the assertion from the available valid evidence. |

A violation contains the policy's message, its target, and inspected fact
identifiers. When a violation has a path and line, they identify the assertion
in the **Policy Pack source**. They do not identify the Terraform declaration.
Use the target's provenance to trace the infrastructure source.

A **diagnostic** explains a problem with reading, compiling, or evaluating the
input. Architecture compilation uses warning and error severities. Policy
result diagnostics use `error`. A policy has no configurable severity or
warning-only gate level; SARIF presents its violations as errors.
Do not confuse a warning about provider-version evidence with a policy violation.

### Zero evaluations require attention

With no packs selected, the first line of a successful text result is:

```text
0 policies, 0 evaluations, 0 passed, 0 violated, 0 indeterminate
```

A selected pack whose target concepts do not occur can also finish with zero
evaluations. This is different from a target whose evidence is unresolved.
Check the selected policies, target coverage, and evaluation count before
interpreting status `0` as approval. Success alone does not prove that your
intended policy ran.

## Turn a result into a gate

`check` returns `0` for a successful compliant run, `1` for known violations,
`2` for incorrect command use, and `3` when it cannot decide. A gate should
accept the expected policy selection and coverage as well as the exit status.
An indeterminate result must not be converted into success.

`--format json` preserves the machine result. `--format sarif` presents the same
findings to compatible consumers; it does not change their meaning or exit
status. The [outputs reference](../reference/outputs.md) describes the streams.

## Match a policy to the Dialect's evidence

A policy can only query facts that the selected Dialects establish. The public
[baseline pack](../../policy-packs/README.md) is a demonstration, not universal
infrastructure assurance. Its database policy requires a `private-reachability`
relation. The AWS Dialect does not produce that relation, so an AWS
managed database can violate this assertion regardless of its real network setup.

That result means the required architectural fact is absent. It does not prove
that the database is publicly reachable. Review a policy's assumptions against
Dialect coverage before adopting it as a gate.

The [Policy Result contract](../../contracts/policy-result.md) defines the exact
output. [CLI command reference](../reference/cli/check.md) lists selection and
output flags. To author governance, continue with
[Write a Policy](../guides/check-architecture.md) or
[Write a Policy Pack](../language/write-policy-pack.md). The
[Language reference](../language/reference/policy-packs.md) defines the closed
syntax and query surface.
