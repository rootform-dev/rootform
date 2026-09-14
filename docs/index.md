---
title: Rootform documentation
description: Review, compare, and check the architecture declared in Terraform and OpenTofu.
tableOfContents: false
---

Rootform turns Terraform and OpenTofu into an architecture you can review,
compare, and check against policies. It uses versioned
[Dialects](concepts/dialects.md) to give declarations architectural meaning,
keeps the evidence behind every fact, and leaves your configuration as the
source of truth.

No infrastructure operation is involved. Rootform does not run Terraform or
OpenTofu, execute providers, contact backends, apply changes, or verify
deployed infrastructure, and unsupported or unresolved input stays explicit
instead of being completed with a guess.

## What an architecture contains

Every normalized `resource` becomes a base representation, even when no Dialect
recognizes its provider or type. Its stable ID derives from the normalized
source identity, so the base keeps the same identity whether or not a Rule
applies to it, and it stays valid and complete about structural existence.

A Dialect Rule may then apply to that base. The applied Rule can classify the
representation with an optional Concept, establish contexts, relations,
contributions, or composition, and record how each fact follows from the
evidence. An uninterpreted resource is one that no Rule matched; it is not an
unsupported resource and it is never removed from the result.

Facts record architectural meaning, such as a context that places one
representation relative to another. Every fact keeps bounded
[provenance](concepts/architecture-ir.md#follow-a-fact-back-to-its-evidence):
the declaration, the applied Rule, and the successful resolution behind it.
Evidence that is missing, ambiguous, or unresolved becomes an omission or a
diagnostic rather than a resolved fact.

## Supplied meaning, explicit selection

A Rootform release embeds the RF Vocabulary and its supplied Dialects as one
immutable release set. The vocabulary supplies the shared `rf.*` Concepts and
contexts that supplied Dialects reference, and the whole set needs no install
step. A project that uses only the supplied release set needs no
`rootform.lock` and no `rootform init`:

```sh
rootform build . --output architecture.json
```

`rootform.lock` records only explicit selection beyond that release set:
additional third-party Dialects, whole-owner exclusions or replacements, and
Policy Packs. [External content](guides/external-content.md) explains how a
project records, verifies, and carries those selections.

## Review, compare, and check

| Result | Use it for |
| --- | --- |
| [Architecture IR](concepts/architecture-ir.md) | Save deterministic JSON facts, accounting, diagnostics, and evidence. |
| [Architecture Diff](concepts/diff.md) | Compare architectural meaning between two revisions or both sides of a plan. |
| [Checks](guides/check-architecture.md) | Evaluate policies selected for a project and separate passed, violated, indeterminate, and not evaluated outcomes. |

A [Policy Pack](concepts/policies.md) asks whether established facts satisfy a
requirement. Policies cannot create facts, and building an architecture never
evaluates them. Diff compares two validated documents, keeps stable resource
identity separate from changing knowledge, and marks what the evidence cannot
prove as undetermined.

## Start here

<!-- rootform:directory -->
- [Install Rootform](installation.md)
  Use the recommended method for your platform and verify the executable.
- [Your first architecture](getting-started/first-architecture.md)
  Build a VPC and subnet from configuration and read their facts and evidence. No cloud account or credentials required.

## Continue by question

<!-- rootform:directory -->
- [How does a Dialect give a resource meaning?](concepts/dialects.md)
  Follow one declaration from its base to its applied Rule and Concept.
- [How do I compare a change?](guides/compare-architectures.md)
  Build before and after architectures and read their Diff.
- [How do I gate architecture rules?](guides/check-architecture.md)
  Evaluate a local policy, inspect its evidence, then reproduce it in CI.
- [How do I add third-party Dialects or Policy Packs?](guides/external-content.md)
  Record exact external selections, verify their bytes, and carry them offline.
- [How do I reproduce a result offline?](guides/reproduce-build.md)
  Preserve the lock and vendor the exact selections.

Use the [CLI reference](reference/cli/index.md) for exact command syntax,
[limitations](limitations.md) for what Rootform cannot establish, and
[troubleshooting](troubleshooting/index.md) for failed operations.
