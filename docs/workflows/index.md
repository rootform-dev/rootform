---
title: "Review a pull request"
description: "Produce comparable architecture evidence for local review, pull requests, and CI gates."
---

A useful review preserves input revision, exact Rootform binary or image,
external selection, and result. When the project has explicit external
selection, commit `rootform.lock` with the change. Retain only the artifacts
reviewers need.

## Choose the review question

| Question | Rootform workflow |
| --- | --- |
| What architecture meaning changed between source revisions? | Build both revisions with the same binary and the same external selection, then run `rootform diff`. |
| What architectural changes does a Terraform or OpenTofu plan describe? | Run `rootform diff --plan` on the plan's JSON export. |
| Does the architecture satisfy reviewed policies? | Run `rootform check` with the expected Policy Pack selection and evaluation coverage. |

## Keep comparisons comparable

`rootform diff` compares two [Architecture IR](../concepts/architecture-ir.md)
documents. Build both sides with the same Rootform binary or image and effective
Dialect selection when question is limited to source change. A different
release set or Dialect lock selection can change interpretation. Diff still
accepts valid documents with different semantic environments, but marks affected
conclusions as undetermined instead of attributing them to infrastructure.

Review a Dialect update as a change in architecture meaning. Review a Policy
Pack update as a change in governance; Policy Packs do not alter Architecture
IR or Diff.

## Review locally first

Keep base and head outputs separate:

```sh
rootform build ./base --output before.json
rootform build ./head --output after.json
rootform diff before.json after.json
```

Separate checkouts or worktrees preserve both revisions without rewriting the
working copy under review.

When the project lock selects Policy Packs, prepare the revision under review
and check it:

```sh
rootform init ./head --locked --no-input
rootform check ./head --locked
```

Confirm the selected policies and the evaluation count, not only the status.
The [check guide](../guides/check-architecture.md) shows pass, violation, and
indeterminate behavior.

## Read policy status as a gate

Policy coverage is not approval. `rootform check` exits `0` only when every
selected policy was evaluated and compliant. Zero policies or zero evaluations
are never compliant and return status `3`; a selected policy without targets
also prevents compliance. Confirmed violations take precedence and return
`1`; invalid command use returns `2`. Read
[Policies and Policy Packs](../concepts/policies.md) before choosing a gate.

## Put evidence in the pull request

Choose the output for its reader:

| Artifact | Reader |
| --- | --- |
| Diff Markdown | Human review of architectural change. |
| Diff JSON | Automation consuming determined and undetermined facts. |
| Policy SARIF | Code-review UI showing policy target and message. |
| Policy JSON | Automation inspecting selection, evaluations, and evidence. |
| Self-contained HTML | Open and share one architecture. |

Use `rootform diff --exit-code` when any change or undetermined fact should
return status `1`. A policy violation returns `1`; an indeterminate or
not-evaluated check returns `3`; invalid command use returns `2`. Preserve
those distinctions instead of collapsing every nonzero result into one message.

Architecture artifacts reveal names, paths, structure, and provenance. Apply
repository access and retention rules. Never attach raw plans, state, or
credentials as Rootform evidence.

## Reproduce the review in CI

Pin the exact Rootform binary or image and commit the project's external
selection. A supplied-only build needs no preparation: no lock, no `init`, and
no network. When a project has a lock, run
`rootform init --locked --no-input` to verify local entries and fetch only the
exact OCI pins that the lock already names. `build`, `run`, and `check`
perform no acquisition and never prompt.

The [portable CI guide](../integrations/ci/README.md) provides runner examples.
[GitHub Actions](../integrations/github-actions.md) covers binary setup,
analysis, and explicit PR reporting. Privileged reporting must never execute
untrusted infrastructure code; choose the event and permissions accordingly.
