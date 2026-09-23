---
title: "Security and data handling"
description: "Understand Rootform's network boundary, sensitive outputs, and trust in selected content."
---

Rootform analyzes local inputs without telemetry, cloud account access,
provider execution, or implicit package acquisition. Network access belongs
to explicit preparation or publication, plus the loopback server used by
`run`.

## Know which operation crosses a network boundary

| Operation | Rootform network behavior |
| --- | --- |
| `rootform init` | With an existing OCI selection, may acquire missing exact pinned content from its recorded registry. This is possible with or without `--locked`. |
| `rootform vendor dialects` and `rootform vendor policy-packs` | May acquire exact locked content when local or cached bytes are missing and acquisition is allowed. |
| `rootform publish dialects` and `rootform publish policy-packs` | Deliberately write package artifacts to a registry and repull their exact identity. |
| `rootform package` | Creates local OCI layouts without registry access. |
| `build`, `check`, `diff`, `explain`, `list`, `show`, `validate`, and `test` | Use available embedded, local, installed, or vendored content. They never acquire packages implicitly. |
| `rootform run` | Serves the local architecture over loopback. It does not make an outbound Rootform connection or acquire packages. |

`--locked` requires and preserves an existing `rootform.lock`; it does not
disable network acquisition by `init`. `--offline` controls acquisition for
`init` and `vendor`. Normal analysis fails when selected external content is
unavailable rather than repairing it silently. See
[Locks and vendored content](../offline-security.md) for selection and
[Registry compatibility](../integrations/registry-compatibility.md) for the
tested transport boundary.

This matrix covers Rootform, not every tool in a workflow. Docker may pull an
image before starting a container. Git checkout, Terraform/OpenTofu module or
provider preparation, planning, and CI services have their own network and
credential behavior. Rootform does not contact a cloud provider to fill an
evidence gap.

## Protect plans and derived outputs

> [!WARNING]
> Saved Terraform or OpenTofu plans and their JSON exports can contain sensitive
> values even when terminal output hides them. Keep them out of Git and public
> artifacts. Rootform does not sanitize, modify, or delete those inputs.

Architecture IR does not copy raw HCL, raw source values, secrets, plan files,
state, absolute paths, or UI state. It still records resource addresses and
names, relative source locations, project structure, relationships,
diagnostics, and provenance. A Diff or Policy report can expose portions of
the same architecture evidence. No raw values does not mean anonymized.

Review saved architecture JSON or HTML, reports, and standard-error diagnostics
before sharing them. Apply the same audience and retention rules as other
infrastructure metadata. The [plan guide](../inputs/plans.md#protect-the-plan-files)
explains the input risk, and [Architecture IR](../concepts/architecture-ir.md#saved-evidence-still-needs-handling-rules)
describes the retained evidence.

## Separate integrity from trust

A digest establishes which package bytes were selected and whether those bytes
changed. It does not establish that a [Dialect](../concepts/dialects.md)
interprets a provider correctly or that a [Policy Pack](../concepts/policies.md)
fits a project's requirements. A wrong Rule can produce the same wrong
architecture deterministically. A policy result covers only matched targets,
its assertion, and the evidence available to it.

Review external source, coverage, and assumptions before recording exact
identities in a lock. Dialect and Policy Pack artifacts are bounded Rootform
language data, not provider binaries or package-supplied shell code. Provenance
shows why a claim was made; it does not verify deployed health or reachability.

## Share a useful reproduction

Reduce a failure to synthetic configuration. Record the Rootform version,
command, exit status, and sanitized diagnostic while preserving the relevant
reference or module shape. Never include credentials, raw plans, state, or
customer names in a public report.

Use [Troubleshooting](../troubleshooting/index.md) for operational symptoms,
[Limitations](../limitations.md) for product boundaries, and the
[security policy](../../SECURITY.md) to report vulnerabilities privately.
