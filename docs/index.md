---
title: Overview
description: Explore, explain, compare, and check architecture derived from Terraform and OpenTofu.
tableOfContents: false
---

Rootform turns Terraform and OpenTofu plans and state into architecture you
can inspect. It reads the JSON that `terraform show -json` exports and never
runs Terraform or OpenTofu, executes providers, or contacts a cloud account.

Use Rootform to:

- Explore resources in their architectural contexts
- Explain how plan evidence produced a placement or connection
- Compare architectural meaning between two plans, states, or saved analyses
- Evaluate the result against [policies](concepts/policies.md)

Rootform analyzes only the input you provide. It does not deploy infrastructure,
read live cloud resources, or verify connectivity. A plan made with a prior
state also reports drift, the changes made outside Terraform or OpenTofu that
its refresh found; Rootform shows that drift and never assumes more. When
evidence is unknown or ambiguous, Rootform reports it as indeterminate instead
of treating it as a proven absence or a successful check.

## Get started

<!-- rootform:directory -->
- [Install Rootform](installation.md)
  Choose the recommended method for your platform and verify the executable.
- [Your first architecture](getting-started/first-architecture.md)
  Plan a VPC and subnet, see why the subnet sits in the VPC, and save the result. No cloud account required.

## How Rootform reads a project

A [Dialect](concepts/dialects.md) gives provider resources architectural
meaning. Rootform includes the RF Vocabulary and embedded Dialects in the
executable, so projects covered by them need no additional Rootform
configuration.

[Core concepts](concepts.md) explains how instances, Rules, facts, and
closures fit together. [Architecture documents](concepts/architecture-ir.md)
describes what a saved Rootform document keeps, and
[Architecture comparisons](concepts/diff.md) explains stages, drift, and
comparisons.

## Continue by task

<!-- rootform:directory -->
- [Explore an architecture](guides/explore-architecture.md)
  Navigate an analysis, inspect evidence, and follow connections.
- [Choose an input](inputs/index.md)
  Decide between plan JSON, state JSON, and a saved Rootform document.
- [Compare architectures](guides/compare-architectures.md)
  Review architectural changes between two revisions.
- [Run checks](guides/check-architecture.md)
  Evaluate selected Policy Packs and distinguish violations from indeterminate evidence.

Use [outputs and exit status](reference/outputs.md) for automation,
[limitations](limitations.md) for evidence boundaries, and
[troubleshooting](troubleshooting/index.md) for failed operations.
