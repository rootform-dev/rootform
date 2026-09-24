---
title: "Limitations"
description: "Find the evidence boundary behind Rootform's architecture, Policy, and Diff results."
---

A successful command reports what Rootform could establish from its input and
selected [Dialects](concepts/dialects.md), not everything that exists in an
infrastructure environment.

## Does Rootform see deployed infrastructure?

No. Rootform does not run Terraform/OpenTofu, execute providers, refresh state,
contact a backend or cloud API, or apply changes. It cannot verify deployed
health, network reachability, or drift from source. Use your infrastructure
tooling for live-state questions, then analyze its saved JSON plan when planned
architecture matters. See [Choose an input](inputs/index.md).

## Is configuration analysis the same as a plan?

No. A root-module directory supplies declarations and references Rootform can
read statically. A JSON plan supplies evidence from one completed planning
operation. Rootform does not evaluate configuration as Terraform/OpenTofu would
or fill in facts absent from the input. Choose a
[plan input](inputs/plans.md) for questions about planned instances and
changes. A raw binary plan, state document, or planning event stream is not an
accepted JSON plan.

## What happens with count, for_each, .tfvars, and modules?

Configuration `count` and `for_each` describe declarations, not a guaranteed
inventory of evaluated instances. Rootform does not load `.tfvars` to resolve
values. Use a JSON plan from a particular planning operation when the instance
set matters.

Local module paths must remain inside the selected root. Remote modules must
already be materialized and matched by `.terraform/modules/modules.json`.
Missing, cyclic, unresolved, or out-of-bound modules leave diagnostics rather
than an invented architecture. Prepare modules with Terraform/OpenTofu, then
rerun Rootform. See [Explore a root module](inputs/index.md#explore-a-root-module).

## Does a resource disappear without a Rule?

No. Every normalized resource receives a base
[Representation](concepts/architecture-ir.md#accounting-keeps-partial-knowledge-honest).
Without an applicable Dialect Rule it has no derived Concept or architectural
facts, so a Policy targeting those facts cannot treat its source type as proof.
Inspect the interpretation and diagnostics before judging coverage.

A Representation in Architecture IR does not necessarily have a permanent,
standalone card in every Explorer scene. A secondary association resource can
appear through an Inspector contribution or search and be revealed on demand.
That presentation choice does not remove it from the document. See
[Reveal a secondary resource](guides/explore-architecture.md#reveal-a-secondary-resource).

## Why was a policy not evaluated or indeterminate?

No selected Policy Pack means no governance evaluation. A selected policy with
no matching target has zero evaluations. Neither is compliant. An
`indeterminate` evaluation means available evidence cannot establish true or
false, for example because a relevant reference or fact remains unresolved.
A confirmed violation takes precedence in a mixed run. Inspect counts,
targets, and diagnostics rather than treating status alone as approval. See
[Policy outcomes](concepts/policies.md#evidence-produces-three-outcomes) and
[Outputs and exit status](reference/outputs.md).

## Why does Diff differ from Terraform actions?

[Architecture Diff](concepts/diff.md) compares validated architectural
representations and facts, not Terraform actions, source formatting, or a
screen layout. A provider replacement can leave architectural meaning
unchanged. A changed Rule can change meaning without a new resource. Missing
or incomparable evidence is reported as `undetermined`, not as no change.
Read the report and use [Compare architectures](guides/compare-architectures.md)
for a review procedure.

## What does offline guarantee?

Normal analysis never acquires packages. `install`, `add`, and `update` can
resolve OCI references; `init` and `vendor` can acquire exact selected OCI
content. `--offline` forbids acquisition on these commands. Vendored
directories are exclusive for their selected family, so damaged content
cannot silently fall back to a store or registry. `--locked` requires a lock
but does not itself disable acquisition. See
[Locks and vendored content](offline-security.md).

Other tools can still use the network. For containers, the image must already
be local and runtime network isolation is a separate choice. See
[Security and data handling](security/index.md#know-which-operation-crosses-a-network-boundary)
and [Container image](integrations/oci-image.md#run-with-vendored-content-offline).

## Where does the Rootform language stop?

`.rf.hcl` uses HCL syntax but has a closed Rootform expression surface, not
general Terraform evaluation. Unsupported definitions and expressions fail
compilation. The [Rootform language reference](language/reference/index.md)
defines accepted forms; authoring errors belong there, not in an architecture
coverage claim.
