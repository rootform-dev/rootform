---
title: "Troubleshooting"
description: "Find the cause, verification step, and correction for common Rootform input, package, policy, and rendering failures."
---

Keep the command, exit status, and standard-error diagnostic together. An error
that prevented a decision is different from a completed check that found a
violation. Start with the symptom below.

## The command is missing or an older version runs

Your shell may not have the installation directory on `PATH`, or another copy
may appear first. Check the resolved executable with `command -v rootform` on
macOS/Linux or `Get-Command rootform` in PowerShell, then run `rootform version`.
Correct the path and open a new terminal. See [Install](../installation.md).

## No project Dialects are available

The current root may not have a selection, even if packages are installed in
your Rootform home. Verify that you are in the intended Terraform/OpenTofu root
and that its markers belong there. Prepare that root explicitly:

```sh
rootform init . --no-input
rootform list dialects
```

Rootform does not inherit a parent directory's lock. For a plan or saved-document
check, prepare the required current-project semantics before running the operation.

## `rootform.lock` is missing with `--locked`

`--locked requires rootform.lock` means that the selected project root has no
lock. Check the directory argument and the file location. If this is a new
project, run `rootform init . --no-input` from that root, review the selection,
then retry with `--locked`. Do not borrow an unrelated lock to suppress the error.

## Offline execution is missing a package

An error naming missing locked Dialects or packs means the exact content is not
available from the permitted local source. Compare `rootform list dialects` or
`rootform list policy-packs` with the intended lock, and check whether a project
vendor directory is present.

On a machine allowed to reach the registry, `rootform init . --locked --no-input`
can acquire missing exact pins without changing the lock. Then prepare the home
or vendor tree for the offline machine. [Reproduce a build offline](../guides/reproduce-build.md)
includes an empty-home proof. Retrying offline cannot download missing bytes.

## Vendor content is missing or changed

A present `.rootform/dialects/` or `.rootform/policy-packs/` is exclusive for its
package family. A healthy installed store cannot compensate for damaged vendor
content. Verify the vendor tree against the same project lock, then explicitly
repair the affected family:

```sh
rootform vendor dialects --offline
```

Use `rootform vendor policy-packs --offline` for packs. If the exact repair bytes
are not local, allow online recovery through that explicit command according to
your environment's rules. The repair preserves the lock; it does not upgrade
or select substitute versions.

## Automation waits for input or stops at EOF

Use `--no-input` on preparation-capable commands. It prevents prompts but still
requires a deterministic choice. If a normal command says the existing lock
needs an update, run the explicit `rootform init` command it reports and review
the lock diff.

An ambiguous source or candidate is not resolved by adding `--no-input` or piping
an unconditional answer. Inspect the configured sources and make the selection
explicit. `--locked` cannot accompany `--upgrade`, `--source`, or initialization's
`--policy-pack`, because those options can change selection.

## Provider compatibility is unverified

Rootform lacks reliable provider-version evidence. Check that
`.terraform.lock.hcl` belongs to the current configuration and satisfies its
constraints. Refresh it with Terraform/OpenTofu when appropriate for the project,
then rerun Rootform. That IaC operation has its own network and backend requirements.

Unknown evidence produces a warning. Reliable incompatible evidence blocks the
affected Dialect. Check the Dialect's declared provider-version envelope before
choosing a provider or semantic update.

## Initialization succeeds but the project cannot build

If initialization reports only uncovered providers, the resulting lock can have
an empty Dialect selection. A build then reports that the resolved Dialects
could not be compiled and the lock could not be verified.

Inspect `rootform.lock` and the initialization warnings. Use the
[official catalog](https://github.com/rootform-dev/dialects/blob/main/dialects.json)
to determine whether a compatible Dialect exists, or supply reviewed semantics
through an explicit source. Reinitializing the same uncovered input will not
create coverage. Partly covered projects can build with unsupported declarations;
read their accounting before relying on the result.

## A module is absent from the architecture

Read the module diagnostic. A remote source may not be materialized, a local
source may be missing, or a path may escape the selected root. Check the module
call and, for installed remote modules, its matching
`.terraform/modules/modules.json` entry.

Materialize remote modules with your IaC tool. Correct missing local paths or
use a project layout within the selected boundary. Rootform does not download
modules or follow escaping symlinks. See [input boundaries](../inputs/index.md#modules-must-be-available-locally).

## The plan input is refused

Prepare the project's Dialects first so a preparation failure does not mask the
input diagnostic. Then check what document was supplied:

| Input reported | Correction |
| --- | --- |
| Saved plan is binary | Export that saved plan with `terraform show -json tfplan` or the OpenTofu equivalent. |
| Machine event stream | Use `show -json` after producing a saved plan, not `plan -json`. |
| State document | Supply the JSON representation of a plan; a single state is not a planned change. |
| Not JSON / not a plan | Regenerate the export and check that the producing command succeeded. |
| Plan could not be read | Verify the file exists and is readable by the current process. |

`diff --plan` takes no positional base/head inputs because the plan carries both
sides. The ordinary form takes two inputs. See [plan procedure](../inputs/plans.md).
Do not include raw plans or state in a public bug report.

## A registry request fails

Check the recorded repository and artifact digest, registry reachability, and
Docker authentication configuration. `DOCKER_CONFIG` names the **directory**
containing `config.json`. An empty value falls back to the normal Docker config;
it does not request an anonymous identity.

A configured credential-helper failure is final; Rootform does not silently
switch to another identity. For a private CA, check the `SSL_CERT_FILE` PEM
bundle. Invalid trust data fails explicitly. Offline commands do not consult
registry credentials or the trust bundle.

For source conflicts, compare exact name/version and artifact identities.
Source order is not a priority mechanism. See [sources and mirrors](../offline-security.md#oci-mirrors-for-locked-projects)
and [registry compatibility](../integrations/registry-compatibility.md).

## A policy check passes but evaluates nothing

Read `summary.policies`, `summary.evaluations`, and the selected packs. No pack
selection gives zero policies. A selected policy whose target concept is absent
gives zero evaluations for that policy. Verify the intended pack and target
coverage before using status `0` as approval.

Use [the worked policy example](../guides/check-architecture.md) for a known
one-target evaluation. A local `check --policy-pack` expects a directory;
initialization's `--policy-pack` expects an OCI artifact reference.

## A policy result is indeterminate or surprising

For status `3`, read diagnostics and inspect unavailable evidence. Check the
architecture's validity, required Dialect vocabulary, and selected Policy Packs.
An indeterminate result cannot become a pass by dropping its diagnostic.

For a violation, inspect the target and the exact facts queried by the assertion.
The reported source path and line refer to the Policy Pack's assertion. A policy
may require a relation that the selected provider Dialect does not establish;
see [policy claim scope](../concepts/policies.md#know-the-scope-of-a-claim).
A violation of that assertion is not itself proof about live infrastructure.

## Diff refuses the comparison

Check that both inputs are valid and use the same Dialect identities and versions.
If a Dialect changed between builds, rebuild comparable inputs with one reviewed
selection rather than editing the architecture JSON. Preserve status `3` as an
unavailable decision; do not replace it with an empty Diff.

A Terraform action can still have no architectural change. Check the
[comparison boundary](../renderer/diff.md#what-a-diff-result-cannot-promise)
before interpreting a no-change result. Use `--exit-code` when a nonempty report,
including undetermined facts, should return `1`.

## The diagram or search seems to be missing something

Check whether the subject is inside a collapsed scope or outside the active
Focus. Expand, return through the location path, or switch to Plan. Use Fit for
an overview; large complete views can require panning.

Search names, concepts, or context paths. Exact Terraform addresses are not a
separate search field; use `explain architecture ADDRESS --input architecture.json`
for an address in a saved document. If the source declaration is unsupported,
no display control can add its missing meaning.

## The browser does not open or the port is occupied

Use the loopback URL printed by `rootform run`. For an automatically selected
free port:

```sh
rootform run . --no-browser --port 0
```

Keep the process running while exploring; stop with Ctrl+C. The default port
is documented in [run reference](../reference/cli/run.md). On a remote machine,
loopback refers to that machine. A local HTML export is useful when you need a
file instead of a running server.

If these steps do not resolve the issue, [report a synthetic reproduction](../contributing/index.md#report-a-semantic-gap)
with the command, version, status, and sanitized diagnostic. Keep credentials,
raw plans, state, and customer infrastructure out of the report.
