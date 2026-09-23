---
title: "Troubleshooting"
description: "Trace an observed Rootform symptom to evidence and the next action."
---

Keep the command, exit status, report, and standard-error diagnostics together.
A reported Policy violation, an uncertain result, and a command failure call
for different actions. [Outputs and exit status](../reference/outputs.md)
defines those boundaries.

## Rootform reports the wrong version or command set

Your shell may resolve another executable than the one you installed. Check
the path and the running binary before comparing documentation with its help:

```sh
command -v rootform
rootform version
```

On PowerShell use `Get-Command rootform`. Adjust `PATH` or the exact binary
invoked by your script. Pin the intended version in automation.

## run cannot start or the expected browser does not open

`run` stays in the foreground. Its status `1` means the local interface could
not start; status `2` means incorrect command use. Read standard error first.
If the chosen port is occupied, ask for a free loopback port:

```sh
rootform run . --no-browser --port 0
```

Open the local address printed on standard output yourself. If the server
started but no browser opened, that address works without automatic browser
launch. `--no-browser` disables launch deliberately. Stop the server with
`Ctrl+C`; a clean stop returns `0`. See [`run`](../reference/cli/run.md).

## A resource has no architectural interpretation

An unrecognized normalized resource still has a base Representation, but no
Rule-derived Concept or facts. Build the architecture and inspect the source
address, provider/type, applied Rule, and diagnostics:

```sh
rootform build . --output architecture.json
rootform explain architecture aws_vpc.main --input architecture.json
```

Replace the address with the one in your project. Check the effective Dialect
selection with `rootform list dialects -o wide` after selected content is
available. If the type is genuinely outside reviewed Rule coverage, report a
[semantic gap](../contributing/index.md#report-a-semantic-gap). Ordinary use
does not require adding a Rule just to create a visual card.

## A Representation has no standalone card in the current scene

The Explorer shows one Context at a time. Search by resource name or type
across the architecture, then inspect its **Source** and contributions.
Secondary association resources may appear through another object's Inspector
and can be revealed on demand. Use `rootform explain architecture <address>`
to confirm the Representation in saved evidence. A missing card alone is not
a missing resource. See [Reveal a secondary resource](../guides/explore-architecture.md#reveal-a-secondary-resource).

## A module or its resources are missing

Read `build` diagnostics for a missing, cyclic, unresolved, or out-of-bound
module. Confirm that you selected the intended root module. Local module
paths must stay inside it; remote modules must be materialized and matched to
their calls by `.terraform/modules/modules.json`. Prepare modules with your
Terraform/OpenTofu workflow, then rerun Rootform. See
[Make modules available locally](../inputs/index.md#make-modules-available-locally).

## A plan input is refused

Read the diagnostic from `rootform build --plan tfplan.json`. Rootform accepts
the JSON export of a completed saved plan, not a binary plan, state document,
`plan -json` event stream, malformed JSON, or an unknown shape. Export the
saved plan with `terraform show -json tfplan` or the OpenTofu equivalent,
and protect both files. See [Terraform and OpenTofu plans](../inputs/plans.md).

## --locked fails because the lock is missing

Confirm `rootform.lock` is in the project root selected by the command.
`--locked` requires that existing valid file; `init` never creates it. Remove
`--locked` if embedded content is sufficient, or record a reviewed external
selection and prepare it. See [Select Dialects and Policy Packs](../cli.md).

## Selected content is missing

Read the diagnostic and the exact entries in `rootform.lock`. Do not rely on
`rootform list` at this point: listing can fail for the same missing content.
When the project has no damaged vendor tree, prepare its pinned selection:

```sh
rootform init . --locked --no-input
```

Add `--offline` only when the exact bytes are already local. `init` cannot
select another version or change the lock. If a vendor tree exists, use the
repair path below instead. See [Locks and vendored content](../offline-security.md).

## Vendored content is incomplete or altered

An existing `.rootform/dialects` or `.rootform/policy-packs` directory is
exclusive for that selected family. A normal build or check will not fall
back to the shared store or registry. Confirm which family the diagnostic
names, then repair only that selection from the project root:

```sh
rootform vendor dialects
rootform vendor policy-packs
```

Run the command for the affected family, not both by default. Use `--offline`
only if verified source, store, or cache bytes already exist. Vendor preserves
the lock. See [What changes when vendor exists?](../offline-security.md#what-changes-when-vendor-exists).

## Registry access, authentication, or CA validation fails

This affects explicit `init`, `vendor`, or `publish`, not normal analysis.
Confirm the repository in the lock or publish `--to` argument and the expected
digest in the lock or package. Then check connectivity and `DOCKER_CONFIG` for
that registry host. If `config.json` names a credential helper, confirm its
executable is on `PATH`. A helper failure does not trigger another identity.
For private CA errors, check the PEM bundle selected by `SSL_CERT_FILE`. Do
not print tokens or credentials while diagnosing. See
[Registry compatibility](../integrations/registry-compatibility.md)
and the [OCI mirror](../offline-security.md#oci-mirror) procedure.

## check reports no selected policies

Run `rootform check . --format json` and inspect the selected Policy count in
its summary. Zero selected policies means no Policy Pack was selected, not a
pass. Add a reviewed pack to the project selection or pass a local
`--policy-pack` for this invocation. See [Run checks](../guides/check-architecture.md).

## A selected policy evaluates no target

If the check report shows a selected Policy but zero evaluations for it, inspect
its target with `rootform show policy <identifier>` using the same project
selection or explicit `--policy-pack` override. Compare that target with the
architecture's Concepts and applied Rules. A source type alone does not satisfy
a Concept or Rule target. Change the selection or source evidence only when
appropriate. Zero evaluations are not compliance. See
[Target scope is exact](../concepts/policies.md#target-scope-is-exact).

## A policy result is indeterminate

Read the JSON or text check report and its diagnostics. Unresolved references,
incomplete fact evidence, or incompatible semantic pins can prevent a Boolean
answer. Inspect the affected Representation with `rootform explain architecture`
and correct the underlying evidence or selection. Do not turn an indeterminate
result into a pass by dropping its diagnostic. See
[Evidence produces three outcomes](../concepts/policies.md#evidence-produces-three-outcomes).

## Diff contains undetermined entries

This can be a completed comparison. Inspect the `undetermined` section of
`rootform diff before.json after.json --format json` and its semantic or source
evidence. Use the same Rootform binary and comparable Dialect selection for
an infrastructure-only comparison where possible. Without `--exit-code`, a
completed report can return `0` despite changes or uncertainty. See
[Architecture Diff](../concepts/diff.md#undetermined-preserves-uncertainty).

## Diff cannot complete at all

Status `3` differs from a report containing undetermined facts. Validate both
saved inputs before retrying:

```sh
rootform validate architecture before.json
rootform validate architecture after.json
```

Fix invalid or unreadable inputs rather than treating failure as an empty
comparison. See [Valid partial document differs from invalid document](../concepts/architecture-ir.md#valid-partial-document-differs-from-invalid-document).

## A container cannot write its output file

The image runs as UID/GID `65532:65532`; the host mount may not allow that
identity to write even when Rootform can read the project. Check the mounted
output directory's permissions. Use a writable mount with suitable host-side
permissions, or keep the workspace read-only and redirect Rootform's standard
output in the host shell. Do not make the project world-writable. See
[Run against a project](../integrations/oci-image.md#run-against-a-project).

If the symptom remains, [report a synthetic reproduction](../contributing/index.md#report-a-semantic-gap)
without credentials, raw plans, state, or private infrastructure.
