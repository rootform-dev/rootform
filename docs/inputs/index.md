---
title: "Terraform and OpenTofu inputs"
description: "Choose the project root and distinguish source configuration, saved architecture, and plan inputs."
---

Choose the input that answers your question: source configuration for declared
architecture, a saved Rootform architecture for reuse, or a JSON plan for a
planned change. These inputs have different evidence and preparation needs.

## Source configuration

Pass the Terraform/OpenTofu root directory to `run`, `build`, or `check`.
Project markers live directly under that selected root; Rootform does not search
parent directories for a different lock. Provider declarations and compatible
`.terraform.lock.hcl` evidence guide Dialect selection.

Remote modules must already be materialized by Terraform/OpenTofu. Rootform
does not run providers, download modules, apply configuration, or modify state.
Unknown or unsupported input remains visible through accounting and diagnostics.

## Saved architectures

A [Rootform architecture file](../concepts/architecture-ir.md) contains compiled
semantic evidence. Serving or comparing it does not re-read Terraform. Keep
its Dialect identities when comparing it with another document.

## Plans

Use [Terraform/OpenTofu plan JSON](plans.md) when the question concerns a planned
change. Raw binary plans, state files, and JSON event streams are different
inputs and are not interchangeable with a JSON plan document.
