---
title: "Policies and Policy Packs"
description: "Understand what Rootform checks, how policies are selected, and what each outcome proves."
---

A policy asks whether an architecture rule holds. It runs after
[Dialects](dialects.md) have established components, placement, composition,
relations, and provenance from the input.

This is different from linting Terraform syntax or resource names. A policy can
ask whether every represented subnet has an established network context, but it
cannot contact a cloud provider to test connectivity or invent a missing fact.

## Policies, packs, and Dialects

Every policy belongs to one **Policy Pack**, which gives related policies a
shared name, version, requirements, and distribution unit.
`tutorial/subnet-network-context` identifies the policy `subnet-network-context`
in the pack `tutorial`.

The source root establishes ownership. One top-level `policy_pack` manifest
defines the pack. Top-level `policy` blocks can live in any `.rf` or `.rf.json`
file beneath that root, including subdirectories, without an explicit pack
reference. Nesting policies inside `policy_pack` remains accepted for compatibility
only; use the top-level form for new policies.

A pack's `requires` block names the exact Dialect vocabulary its policies use.
It does not select provider Dialects or add facts. Provider detection selects
Dialects; you select Policy Packs explicitly and review whether their assumptions
match the evidence those Dialects produce.

## What gets evaluated

`rootform check` selects policies, validates their required vocabulary, and
evaluates each policy once for every representation with its exact target
concept. One policy matching ten subnets produces ten **evaluations**. Each result
keeps the policy identity, target identity, outcome, and inspected facts.

Checks can read a configuration directory, a saved Rootform architecture, or
the planned architecture in a [JSON plan](../inputs/plans.md). They evaluate
Architecture IR; they do not evaluate raw Terraform expressions or deployed
state.

The [worked check](../guides/check-architecture.md) uses one real pack and shows
observed pass, violation, and indeterminate results.

## Read outcomes and diagnostics

| Outcome | Meaning |
| --- | --- |
| `passed` | The assertion is known to hold for this target. |
| `violated` | The assertion is known to be false for this target. |
| `indeterminate` | Available valid evidence cannot produce a trusted Boolean decision. |

A violation reports the authored message, target, and inspected fact identities.
Its path and line point to the assertion in the Policy Pack source, not the
Terraform declaration. Follow the target's provenance to reach the infrastructure
source.

A **diagnostic** explains why Rootform could not read, compile, or evaluate part
of the operation. An incompatible pack requirement, unknown vocabulary, or
unavailable evidence can make the check indeterminate. Rootform does not convert
that condition into a pass or a known violation.

Policies have no warning-only severity. SARIF presents violations as errors; a
provider-version warning remains separate from the policy outcome.

### Zero evaluations are not approval

A check with no selected packs can succeed with:

```text
0 policies, 0 evaluations, 0 passed, 0 violated, 0 indeterminate
```

A selected policy also gets zero evaluations when its target concept does not
occur. Confirm policy selection, target coverage, and evaluation count before
treating status `0` as approval.

## Turn checks into gates

Use a local pack while authoring:

```sh
rootform check . --offline --policy-pack ./policies
```

For a project gate, select reviewed packs, commit `rootform.lock`, and run the
same check non-interactively in CI. `--format json` preserves the complete result;
`--format sarif` exposes findings to compatible code-review tools.

| Status | Gate meaning |
| --- | --- |
| `0` | Evaluation completed without a violation or indeterminate result. Counts can still be zero. |
| `1` | At least one policy was violated and no indeterminate result took precedence. |
| `2` | Command use was invalid. |
| `3` | Evaluation was indeterminate or required evidence was unavailable. |

Accept only the expected selection, coverage, and status. Never convert status
`3` into success. [Run in CI](../integrations/ci/README.md) and
[GitHub Actions](../integrations/github-actions.md) show the project workflow;
the [outputs and exit status reference](../reference/outputs.md) defines machine
behavior.

## Know the scope of a claim

A policy proves only its evaluated assertion over facts available in that
architecture. For example, a policy requiring a `private-reachability` relation
can be violated when a provider Dialect does not produce that relation. The
result says the required architecture fact is absent; it does not prove that a
database is publicly reachable.

Review target coverage and evidence assumptions before adopting any pack as a
gate. To author governance, continue with
[Write a Policy Pack](../language/write-policy-pack.md). Exact syntax and query
behavior live in the [Policy Pack reference](../language/reference/policy-packs.md).
