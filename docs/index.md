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
- Compare architectural meaning between two plans, states, or saved Forms
- Evaluate the result against [policies](concepts/policies.md)

Rootform analyzes only the input you provide. It does not deploy infrastructure,
read live cloud resources, or verify connectivity. A plan made with a prior
state may also report drift records; Rootform shows their architectural
consequences and never assumes more. When
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
closures fit together. [Forms and stages](concepts/forms.md)
describes what a saved Form keeps, and
[Comparisons](concepts/comparisons.md) explains stages, drift, and
comparisons.

## Continue by task

<!-- rootform:directory -->
- [Explore an architecture](guides/explore-architecture.md)
  Navigate an analysis, inspect evidence, and follow connections.
- [Choose an input](inputs/index.md)
  Decide between plan JSON, state JSON, and a saved Form.
- [Compare architectures](guides/compare-architectures.md)
  Review architectural changes between two revisions.
- [Check an architecture](guides/check-architecture.md)
  Evaluate selected Policy Packs and distinguish violations from indeterminate evidence.

Use [outputs and exit status](reference/outputs.md) for automation,
[limitations](limitations.md) for evidence boundaries, and
[troubleshooting](troubleshooting/index.md) for failed operations.
