---
title: "Limitations"
description: "Know the input, coverage, governance, comparison, and offline boundaries of Rootform v0.1."
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

## Resource coverage is not Rule coverage

Every normalized resource gets base representation even when no Dialect or Rule
recognizes its type. Dialect coverage measures architectural enrichment, not
resource visibility. References can remain missing, ambiguous, dynamic, or
unresolved; accounting and diagnostics expose those cases.

Base-only representation has no synthetic Rule, Concept, or facts and therefore
does not satisfy Policy targets by source type alone.

## A policy only proves its evaluated assertion

No selected packs means no governance evaluation. A selected policy with no
matching targets also produces zero evaluations. Human output reports
`not evaluated`; machine output keeps `not_evaluated`. Both set
`compliant = false` and exit 3.

Policies cannot create missing facts. Review their assumptions against provider
coverage. A missing fact is known absent only when relevant emission closure is
complete; otherwise evaluation is indeterminate. Neither result proves an
opposite condition in deployed infrastructure. Policies have no configurable
severity or warning-only threshold. See
[policy outcomes](concepts/policies.md).

## Closed language surface

`.rf.hcl` uses HCL syntax but exposes a closed, domain-specific expression surface,
not general HCL or Terraform evaluation. Unsupported definitions and expression
forms are compilation errors. See the [Language reference](language/reference/index.md)
for the exact accepted set.

## Diff compares architectural meaning

Diff requires valid documents. Source normalization mismatch limits structural
comparison; semantic-owner mismatch preserves source continuity while marking
interpretation and fact changes undetermined. Formatting-only changes are
ignored. Terraform replacement can leave architecture facts unchanged.

`rootform diff` emits text, JSON, or Markdown reports. [Architecture Diff](concepts/diff.md)
explains report contents and the evidence boundary.

## Offline means exact inputs already exist

Normal execution never downloads. `init --locked` may acquire exact OCI pins;
add `--offline` to forbid it. `vendor … --offline` cannot repair missing bytes
from registry. Present vendor directories are exclusive, so damaged content
cannot fall back. Prepare exact packages with
[offline procedure](guides/reproduce-build.md).

Use [troubleshooting](troubleshooting/index.md) for failures within these boundaries,
and [report a synthetic reproduction](contributing/index.md#report-a-semantic-gap)
when supported behavior does not match its documented result.
