---
title: "Rootform v0.1 limits"
description: "Know the input, coverage, governance, comparison, and renderer boundaries of Rootform v0.1."
---

Rootform's conclusions are limited to the evidence in its accepted inputs and
the facts established by the selected Dialects. These boundaries apply even when
a command succeeds.

## Infrastructure operations stay with Terraform/OpenTofu

Rootform does not run Terraform/OpenTofu, execute providers, contact backends,
refresh state, download modules, or apply changes. It cannot verify live health,
prove connectivity, or independently detect Drift. A plan contains evidence from
the operation that produced it; Rootform does not refresh that evidence.

## Configuration analysis does not reproduce evaluation

Rootform reads supported configuration syntax, declarations, and references.
It does not evaluate every expression, load `.tfvars` to resolve values, or expand
configuration `count`/`for_each` as a deployed-instance inventory. Use a JSON plan
for the instances stated by a particular planning operation.

Local modules must stay within the selected root. Remote modules must already
be materialized and match their module-manifest entries. Raw binary plans, state
files, and planning event streams are not JSON plan inputs. See [inputs](inputs/index.md).

## Provider support is not complete resource coverage

A provider can have a Dialect while some resource types remain unsupported.
References can be missing, ambiguous, dynamic, or unresolved. Accounting and
diagnostics expose those cases; a small or empty canvas is not evidence of
complete coverage.

A project with only uncovered providers can initialize with an empty Dialect
selection but cannot build from that selection. A partly supported
project can build with unsupported declarations. Check the declaration outcomes
before using the result for review or governance.

## A policy only proves its evaluated assertion

No selected packs means no governance evaluation. A selected policy with no
matching targets also produces zero evaluations. Both report `not_evaluated`,
`compliant = false`, and exit 3.

Policies cannot create missing facts. Review their assumptions against provider
coverage. A violated assertion says its required architecture fact is absent; it
does not prove an opposite condition in deployed infrastructure. Policies have
no configurable severity or warning-only threshold. See
[policy outcomes](concepts/policies.md).

## Closed language surface

`.rf` uses HCL syntax but exposes a closed, domain-specific expression surface,
not general HCL or Terraform evaluation. Unsupported definitions and expression
forms are compilation errors. See the [Language reference](language/reference/index.md)
for the exact accepted set.

## Diff compares architectural meaning

Diff requires valid compatible documents and the same Dialect identities and
versions. Formatting and provenance-only changes are ignored. A Terraform
replacement can leave architectural facts unchanged. Before-side evidence that
cannot be reconstructed remains undetermined.

`rootform diff` emits text, JSON, or Markdown reports. `run --plan` shows only
the planned architecture, not both comparison sides. The [Diff guide](renderer/diff.md)
explains the report and Diff view.

## Large views need exploration

Survey summarizes according to the viewport. Plan starts with the complete
graph; Focus opens local context without Survey's automatic collapse budget.
A large Plan or Focus can need panning and explicit disclosure. Fit can make
labels too small to read when showing the whole view at once.

Search indexes names, concepts, and context paths rather than exact Terraform
addresses. Toolbar controls are keyboard-focusable, but the canvas has no
dedicated keyboard panning shortcuts. See [views and inspection](renderer/views.md).

## Offline means the inputs must already exist

`--locked` alone does not forbid downloads. `--offline` cannot recover a missing
artifact from a registry. Present vendor directories are exclusive, so damaged
content cannot fall back to another source. Prepare exact packages beforehand
with [the offline procedure](guides/reproduce-build.md).

Use [troubleshooting](troubleshooting/index.md) for failures within these boundaries,
and [report a synthetic reproduction](contributing/index.md#report-a-semantic-gap)
when supported behavior does not match its documented result.
