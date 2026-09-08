---
title: Rootform documentation
description: Understand, review, and check the architecture declared in Terraform and OpenTofu.
tableOfContents: false
---

Rootform turns Terraform or OpenTofu into an architecture you can inspect. It
uses versioned [Dialects](concepts/dialects.md) to establish what declarations
mean, preserves evidence behind each fact, and leaves configuration as the source
of truth.

Use Rootform to review boundaries, components, placement, and declared
relationships without executing providers or contacting cloud accounts. It
makes unsupported or unresolved input explicit instead of completing a diagram
with guessed meaning.

## What Rootform produces

| Result | Use it for |
| --- | --- |
| Local explorer | Navigate architecture with Survey, Plan, Focus, and Inspector. |
| Architecture IR | Save deterministic JSON facts, accounting, diagnostics, and provenance. |
| Self-contained HTML | Share an interactive architecture that needs no server or adjacent assets. |
| Diff report | Compare architectural meaning between source revisions or both sides of a plan. |
| Policy result | Evaluate policies selected for a project and distinguish passed, violated, and indeterminate decisions. |

Rootform does not run Terraform/OpenTofu, execute providers, contact backends,
apply changes, or verify deployed infrastructure. It describes the architecture
supported by the supplied source or plan evidence and selected semantics.

## Start here

<!-- rootform:directory -->
- [Install Rootform](installation.md)
  Use the recommended method for your operating system and verify the executable.
- [Your first architecture](getting-started/first-architecture.md)
  Render a VPC and subnet, inspect their evidence, and save the result. No cloud account or credentials required.

For an existing project, run from the Terraform or OpenTofu root:

```sh
rootform run .
```

Rootform prepares the missing Dialects, records their selection in `rootform.lock`,
and opens the local explorer. Review the proposal before confirming it. See
[project preparation](cli.md) for non-interactive, locked, and offline use.

## Continue by question

<!-- rootform:directory -->
- [How did Rootform derive this?](concepts/architecture-ir.md)
  Follow architecture facts to their source declarations and Dialect rules.
- [What do Survey, Plan, Focus, and Inspector show?](renderer/index.md)
  Learn visual grammar and navigate larger results.
- [How do I compare a change?](guides/compare-architectures.md)
  Build before and after architectures and read their Diff.
- [How do I check a policy?](guides/check-architecture.md)
  Evaluate one bounded rule against known architecture facts.
- [How do I reproduce a result offline?](guides/reproduce-build.md)
  Preserve lock and vendor exact semantic packages.

Use the [CLI reference](reference/cli/index.md) for exact command syntax and
[troubleshooting](troubleshooting/index.md) for failed operations.
