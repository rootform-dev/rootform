---
title: "Policies and Policy Packs"
description: "Separate architecture meaning from the governance rules you choose to evaluate."
---

A policy evaluates a claim about an architecture. A Policy Pack versions and
distributes a set of policies independently from Dialects. Every policy belongs
to exactly one Policy Pack and has a pack-qualified identity.

## Choose governance explicitly

Provider detection selects Dialects, not policies. Rootform evaluates only
Policy Packs recorded in your lock or supplied explicitly. `build` and `run`
ignore governance; `check` evaluates it. Installing a Dialect is not a compliance
check.

## Interpret the result

A policy can pass, be violated, or remain indeterminate. Missing evidence is
not a pass. Read the selected packs and evaluation counts before interpreting
a successful process exit: no selected policies means no governance claim.

[CLI lifecycle](../cli.md) covers selection, local authoring, packaging, and
vendoring. The [baseline Policy Pack](../../policy-packs/README.md) provides
a concrete public example. Use the [Policy Result contract](../../contracts/policy-result.md)
when consuming machine output.
