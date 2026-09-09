---
title: "Review changes with Git and CI"
description: "Choose architecture evidence for local review, pull requests, and reproducible gates."
---

A useful review preserves the input revision, exact semantic selection, and
result being discussed. Commit `rootform.lock`; retain only artifacts reviewers
need.

## Choose the review question

| Question | Rootform workflow |
| --- | --- |
| What architecture meaning changed between source revisions? | Build both revisions with the same lock, then run `rootform diff`. |
| What architectural changes does this Terraform/OpenTofu plan describe? | Run `rootform diff --plan` on the plan's JSON export. |
| Does the architecture satisfy our reviewed rules? | Run `rootform check` with expected Policy Packs and evaluation coverage. |

## Review locally first

For a source change, keep base and head outputs separate:

```sh
rootform build ./base --locked --offline --no-input --output before.json
rootform build ./head --locked --offline --no-input --output after.json
rootform diff before.json after.json
```

Separate checkouts or worktrees preserve both revisions without rewriting the
working copy under review. Use the same Dialect versions on both sides; review a
Dialect update separately because it can change interpretation.

Run project checks against the revision under review:

```sh
rootform check ./head --locked --offline --no-input
```

Confirm selected policies and evaluation count, not only status. The
[check guide](../guides/check-architecture.md) shows pass, violation, and
indeterminate behavior.

## Put evidence in the pull request

Choose output for its reader:

| Artifact | Reader |
| --- | --- |
| Diff Markdown | Human review of architectural change. |
| Diff JSON | Automation consuming determined and undetermined facts. |
| Policy SARIF | Code-review UI showing policy target and message. |
| Policy JSON | Automation inspecting selection, evaluations, and evidence. |
| Self-contained HTML | Interactive review of one architecture. |

Use Diff `--exit-code` when any change or undetermined fact should return status
`1`. A policy violation returns `1`; an indeterminate check returns `3`. Preserve
those distinctions instead of collapsing every nonzero result into the same
message.

Architecture artifacts can reveal names, paths, structure, and relationships.
Apply repository access and retention rules. Never attach raw plans, state, or
credentials as Rootform evidence.

## Reproduce the review in CI

Pin an exact Rootform binary or image, use committed selection, and disable
prompts. A connected locked job may acquire missing artifacts pinned by the
lock. Add `--offline` only after supplying complete local or vendored packages.

The [portable CI guide](../integrations/ci/README.md) provides runner examples.
[GitHub Actions](../integrations/github-actions.md) covers Summary, artifacts,
and explicit PR reporting. Privileged reporting must never execute untrusted
infrastructure code; choose event and permissions accordingly.
