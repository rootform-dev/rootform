---
title: "Security and data handling"
description: "Understand Rootform's network boundary, sensitive outputs, and trust in selected content."
---

Rootform analyzes local inputs without telemetry, cloud account access,
provider execution, or implicit package acquisition. It reads the plan JSON,
saved plan, or state JSON that Terraform or OpenTofu already produced; it never
runs either tool. Network access belongs to explicit preparation or
publication, plus the loopback server used by `run`.

## Know which operation crosses a network boundary

| Operation | Rootform network behavior |
| --- | --- |
| `rootform install` | Resolves and verifies OCI references for this machine. It does not select content for a project. |
| `rootform add` and `rootform update` | Local sources stay local. OCI references may require registry access to resolve and install exact content. |
| `rootform init` | With an existing OCI selection, may acquire missing exact content from its recorded registry. This is possible with or without `--locked`. |
| `rootform vendor dialects` and `rootform vendor policy-packs` | Copy selected local sources directly. May acquire and install missing exact OCI content before vendoring when acquisition is allowed. |
| `rootform publish dialects` and `rootform publish policy-packs` | Deliberately write package artifacts to a registry and repull their exact identity. |
| `rootform package` | Creates local OCI layouts without registry access. |
| `rootform run`, `explain`, `list`, `show`, `validate`, and `test` | Use available embedded, local, installed, or vendored content. They never acquire packages implicitly. |
| `rootform run` without `--no-serve` | Serves the Explorer on `127.0.0.1` only. It makes no outbound connection. |

`--locked` requires and preserves an existing `rootform.lock`; it does not
disable network acquisition by `init`. `--offline` prevents acquisition by
`install`, `add`, `update`, `init`, and `vendor`. An offline OCI tag cannot be
resolved; an already installed digest reference can be used. Normal analysis
fails when selected external content is unavailable. See
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
> Saved plans, plan JSON, and state JSON can contain sensitive values in clear
> text, even when terminal output hides them. Keep them out of Git and public
> artifacts. Rootform does not sanitize, modify, or delete those inputs.

A Rootform document never copies attribute values, sensitive values, raw HCL,
saved plans, plan JSON, state, local paths, or Explorer state. It still records
resource and instance addresses, including `count` and `for_each` keys,
resource types, module paths, provider identities, planned actions,
relationships, closure results, diagnostics, and the Terraform or OpenTofu
version that the input reports. An external endpoint's identity is recorded
only when its Dialect allows that disclosure. Comparisons, Markdown and SARIF
reports, and HTML exports expose the same kind of information. Omitting raw
values does not anonymize the result.

An HTML export embeds the Explorer and a display copy of the Rootform document
in one file. Opening it makes no network request. Anyone who receives the file
can read the names and topology in that copy; keep the `.json` document when
you need the complete reusable result.

Review saved Rootform documents, HTML exports, reports, and standard-error
diagnostics before sharing them. Apply the same audience and retention rules as
other infrastructure metadata. The
[plan guide](../inputs/plans.md#protect-the-plan-files) explains the input
risk, and
[Architecture documents](../concepts/architecture-ir.md#saved-evidence-still-needs-handling-rules)
describes what a saved document retains.

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

Reduce a failure to synthetic configuration and a plan made from it. Record the
Rootform version, command, exit status, and sanitized diagnostic while
preserving the relevant reference or module shape. Never include credentials,
real plans, state, or customer names in a public report.

Use [Troubleshooting](../troubleshooting/index.md) for operational symptoms,
[Limitations](../limitations.md) for product boundaries, and the
[security policy](../../SECURITY.md) to report vulnerabilities privately.
