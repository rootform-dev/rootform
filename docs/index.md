---
title: Rootform documentation
description: Understand, review, and check the architecture declared in Terraform and OpenTofu.
tableOfContents: false
---

Rootform turns Terraform and OpenTofu into an architecture you can inspect,
compare, and check against policies. It uses versioned
[Dialects](concepts/dialects.md) to interpret declarations, preserves the
evidence behind each architectural fact, and keeps your configuration as the
source of truth.

Use Rootform to review boundaries, components, placement, and declared
relationships without executing providers or contacting cloud accounts. It
makes unsupported or unresolved input explicit instead of completing a diagram
with guessed meaning.

## What Rootform produces

| Result | Use it for |
| --- | --- |
| [Renderer](renderer/index.md) | Navigate architecture with Survey, Plan, Focus, and Inspector. |
| [Architecture Diff](guides/compare-architectures.md) | Compare architectural meaning between source revisions or both sides of a plan. |
| [Checks](guides/check-architecture.md) | Evaluate policies selected for a project and distinguish passed, violated, and indeterminate decisions. |
| [Architecture IR](concepts/architecture-ir.md) | Save deterministic JSON facts, accounting, diagnostics, and provenance. |
| [Self-contained HTML](reference/outputs.md#share-the-right-artifact) | Share an interactive architecture that needs no server or adjacent assets. |

Rootform does not run Terraform/OpenTofu, execute providers, contact backends,
apply changes, or verify deployed infrastructure. It describes the architecture
supported by the supplied source or plan evidence and selected Dialects.

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

Rootform proposes any missing Dialects. After you confirm the selection, it
records them in `rootform.lock` and opens the local explorer. See
[project preparation](cli.md) for non-interactive, locked, and offline use.

## Continue by question

<!-- rootform:directory -->
- [How did Rootform derive this?](concepts/architecture-ir.md)
  Follow architecture facts to their source declarations and Dialect rules.
- [What do Survey, Plan, Focus, and Inspector show?](renderer/index.md)
  Learn the visual grammar and navigate larger results.
- [How do I compare a change?](guides/compare-architectures.md)
  Build before and after architectures and read their Diff.
- [How do I gate architecture rules?](guides/check-architecture.md)
  Evaluate a real policy locally, inspect its evidence, then reproduce it in CI.
- [How do I reproduce a result offline?](guides/reproduce-build.md)
  Preserve the lock and vendor the exact Dialects.

Use the [CLI reference](reference/cli/index.md) for exact command syntax and
[troubleshooting](troubleshooting/index.md) for failed operations.
