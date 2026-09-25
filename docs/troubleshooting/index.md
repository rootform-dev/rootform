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

<!-- docs-check:docs-troubleshooting-index-1 -->
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

<!-- docs-check:docs-troubleshooting-index-2 -->
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

<!-- docs-check:docs-troubleshooting-index-3 -->
```sh
rootform build . --output architecture.json
rootform explain architecture aws_vpc.main --input architecture.json
```

Replace the address with the one in your project. Check the active Dialect
set with `rootform list dialects -o wide` after selected content is
available. If the type is genuinely outside reviewed Rule coverage, report a
[semantic gap](../contributing/index.md#report-a-semantic-gap). Ordinary use
does not require adding a Rule just to create a visual card.

## A Representation has no standalone card in the current scene

The Explorer emphasizes one navigation scene at a time. Search by resource name or type
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
`--locked` if embedded content is sufficient, or use `rootform add` to record
a reviewed external selection and then prepare it. See
[Add external content](../guides/external-content.md).

## A local source differs from rootform.lock

A selected local Dialect or Policy Pack changed after it was added. Use
`--dialect` or `--policy-pack` to try the edited source for one command. When
the change is ready, run `rootform update dialect <owner>` or
`rootform update policy-pack <name>` from the project root and commit the
lock diff. When you edited both a Dialect and a Policy Pack, update them in
either order; commands keep reporting the other one until it is recorded too.
`init` does not adopt drift. See
[Use a local Dialect while authoring](../guides/local-dialect.md).

## Selected content is missing

Read the diagnostic and the exact entries in `rootform.lock`. Do not rely on
`rootform list` at this point: listing can fail for the same missing content.
When the project has no damaged vendor tree, prepare its pinned selection:

<!-- docs-check:docs-troubleshooting-index-4 -->
```sh
rootform init . --locked --no-input
```

Add `--offline` only when the exact bytes are already local. `init` cannot
select another version or change the lock. Without a vendor tree, a missing
local source must be restored at its recorded path; `init` cannot install it.
If a vendor tree exists, use the repair path below instead.

## Installed content does not match rootform.lock

The Rootform home holds the version the lock names, but its bytes no longer
match the recorded digest. `init` refuses to overwrite an installed version,
so remove the damaged copy first, using the family and `name@version` from
the diagnostic, for example `rootform uninstall dialects payments@0.1.0` or
`rootform uninstall policy-packs baseline@0.1.0`. Then run
`rootform init . --locked --no-input` to install the exact pinned bytes
again. The lock does not change. See
[External content storage](../reference/storage.md).

## Vendored content is incomplete or altered

`init --locked --offline` fails when a vendored family has missing, extra,
or changed content. A build or check also refuses it. Confirm which family
the diagnostic names, then repair that family from the project root:

<!-- docs-check:docs-troubleshooting-index-5 -->
```sh
rootform vendor dialects
rootform vendor policy-packs
```

Run the command for the affected family, not both by default. Use `--offline`
only if verified local source or installed OCI bytes already exist. Vendor
preserves the lock. See
[External content storage](../reference/storage.md).

## An offline add or update refuses a tag

A tag needs a registry lookup and cannot be resolved with `--offline` or
`ROOTFORM_OFFLINE=1`. Use a local source directory, or an exact digest reference
already installed on this machine. Otherwise run the selection command online.
See [Add external content](../guides/external-content.md).

## A Dialect owner collides with an embedded owner

An external Dialect named `aws`, for example, cannot replace the embedded `aws`
Dialect by installation alone. If replacement is intended, rerun `rootform add
dialects <source> --replace`. The reserved `rf` vocabulary cannot be replaced.
See [Replace or exclude an embedded
Dialect](../guides/external-content.md#replace-or-exclude-an-embedded-dialect).

## rootform.lock.new blocks a change

If a command names `rootform.lock.new` after an interrupted selection change,
confirm no Rootform writer is running. Then remove that leftover file and
retry. If vendored content differs from the lock, repair the affected family
with `rootform vendor`. See [Who writes this file](../../contracts/rootform-lock.md#who-writes-this-file).

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

Status `3` differs from a completed report containing undetermined facts. Check
the input form used by the failed command before retrying. For two saved
Architecture IR documents, validate each file separately:

<!-- docs-check:docs-troubleshooting-index-6 -->
```sh
rootform validate architecture before.json
rootform validate architecture after.json
```

For root-module directories, build each root separately and read its own
diagnostics:

<!-- docs-check:docs-troubleshooting-index-7 -->
```sh
rootform build ./before --output before.json
rootform build ./after --output after.json
```

For `rootform diff --plan tfplan.json`, confirm the input is a completed saved
plan's JSON export. Re-export it as described in
[Terraform and OpenTofu plans](../inputs/plans.md) and retry the plan input
with `rootform build --plan tfplan.json`. Do not pass a plan to
`validate architecture`, which accepts Architecture IR. Fix invalid or
unreadable inputs rather than treating failure as an empty comparison. See
[Valid partial document differs from invalid document](../concepts/architecture-ir.md#valid-partial-document-differs-from-invalid-document).

## A container cannot write its output file

The image runs as UID/GID `65532:65532`; the host mount may not allow that
identity to write even when Rootform can read the project. Check the mounted
output directory's permissions. Use a writable mount with suitable host-side
permissions, or keep the workspace read-only and redirect Rootform's standard
output in the host shell. Do not make the project world-writable. See
[Run against a project](../integrations/oci-image.md#run-against-a-project).

If the symptom remains, [report a synthetic reproduction](../contributing/index.md#report-a-semantic-gap)
without credentials, raw plans, state, or private infrastructure.
