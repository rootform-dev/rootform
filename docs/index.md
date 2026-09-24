---
title: Overview
description: Explore, explain, compare, and check architecture derived from Terraform and OpenTofu.
tableOfContents: false
---

Rootform turns Terraform and OpenTofu configuration or plans into architecture
you can inspect without running providers or accessing a cloud account.

Use Rootform to:

- Explore resources in their architectural contexts
- Explain how source evidence produced a placement or connection
- Compare architectural meaning between two revisions
- Evaluate the result against [policies](concepts/policies.md)

Rootform analyzes only the input you provide. It does not deploy infrastructure,
read live cloud resources, verify connectivity, or detect drift. When evidence
is unresolved or ambiguous, Rootform reports a diagnostic instead of treating
unknown evidence as a proven absence or a successful check.

## Get started

<!-- rootform:directory -->
- [Install Rootform](installation.md)
  Choose the recommended method for your platform and verify the executable.
- [Your first architecture](getting-started/first-architecture.md)
  Explore a VPC and subnet, save the result, and explain its placement. No cloud credentials required.

## How Rootform reads a project

A [Dialect](concepts/dialects.md) gives provider declarations architectural
meaning. Rootform includes the RF Vocabulary and embedded Dialects in the
executable, so projects covered by them need no additional Rootform
configuration.

[Core concepts](concepts.md) explains how declarations, Rules, facts, and
diagnostics fit together. Use [Architecture IR](concepts/architecture-ir.md)
for the saved document contract and [Architecture Diff](concepts/diff.md) for
comparison semantics.

## Continue by task

<!-- rootform:directory -->
- [Explore an architecture](guides/explore-architecture.md)
  Navigate an existing project, inspect evidence, and follow connections.
- [Choose an input](inputs/index.md)
  Decide between configuration, a saved Rootform architecture file, and a plan.
- [Compare architectures](guides/compare-architectures.md)
  Review architectural changes between two revisions.
- [Run checks](guides/check-architecture.md)
  Evaluate selected Policy Packs and distinguish violations from indeterminate evidence.

Use [outputs and exit status](reference/outputs.md) for automation,
[limitations](limitations.md) for evidence boundaries, and
[troubleshooting](troubleshooting/index.md) for failed operations.
