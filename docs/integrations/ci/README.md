---
title: "Run Rootform in CI"
description: "Reproduce architecture builds and policy gates in a non-interactive runner."
---

CI should reproduce the architecture reviewed locally: pin an exact Rootform
release, commit any external selection, and disable prompts. Rootform never
prompts in a non-interactive runner; every command below is deterministic.

Copy [`rootform-ci.sh`](rootform-ci.sh) to `ci/rootform-ci.sh`. It detects
project selection, writes results under `.rootform-ci/`, and preserves policy
gate status when a check is selected.

## Two project branches

Projects with external selection commit `rootform.lock`. The lock records every
selected external Dialect and Policy Pack by name, version, content digest, and
an exact local path or OCI identity. The job then runs:

```sh
rootform init "$project" --locked --no-input [--offline]
rootform build "$project" --locked
rootform check "$project" --locked
```

`init` verifies every locked entry locally and fetches only the exact OCI
packages the lock already pins; it never detects providers, resolves a tag or
version, or rewrites the lock. Set `ROOTFORM_OFFLINE=1` when the runner has a
vendored tree: `.rootform/dialects/` and, when selected,
`.rootform/policy-packs/` become the exclusive source, and no store, index, or
registry fallback exists.

A supplied-only project has no `rootform.lock` and needs no `init`. Its
architecture meaning comes entirely from supplied Dialects and RF Vocabulary
embedded in exact binary. The job skips preparation and builds directly:

```sh
rootform build "$project"
```

No `--locked` flag, no acquisition, and no network. Embedded Dialects are
embedded in binary and are never vendored or installed. With no Policy Pack,
script stops after build because a zero-policy check would correctly return
`not evaluated`, not approval.

To gate embedded-only architecture with repository-owned policy source, set:

```sh
ROOTFORM_POLICY_PACK=./policies ./ci/rootform-ci.sh
```

Script passes this path through `--policy-pack` for check only. It does not add
source to lock or install it.

## Script behavior

Script checks for `$project/rootform.lock`. When present, it runs
`init --locked --no-input` (adding `--offline` for `ROOTFORM_OFFLINE=1`), then
`build --locked` and `check --locked`. `ROOTFORM_POLICY_PACK` replaces locked
Policy Pack selection for check, so check omits `--locked` in that case. Without
lock or explicit local pack, script builds and performs no governance check.

JSON goes to `init.json`, `architecture.json`, and, when checked, `check.json`.
Exact check exit code goes to `check.status` and becomes script exit status.

Environment:

- `ROOTFORM_BIN` selects an already verified executable, default `rootform`.
- `ROOTFORM_PROJECT` selects the project directory, default literal `.`.
- `ROOTFORM_OUTPUT_DIR` selects the results directory, default `.rootform-ci`.
- `ROOTFORM_OFFLINE=1` forces the offline locked branch.
- `ROOTFORM_POLICY_PACK` selects one local source directory or compiled pack for
  this check.

## Exact release

Pin one exact Rootform release in CI. Install through a checksum-verifying
setup Action or run an official image by exact tag; never resolve a floating
`latest`. Verify the installed identity with `rootform version` before
analysis. The embedded semantics a job reviews are the ones in that exact
binary.

## Policy coverage and status

`check` reports policy coverage and records every evaluation. Exit status:

- `0`: every selected policy was evaluated and compliant;
- `1`: at least one confirmed violation, including mixed runs;
- `2`: the command was used incorrectly;
- `3`: indeterminate, or a selected policy was not evaluated.

Check coverage before accepting status `0`: zero selected policies are never
compliant, and a selected policy without targets prevents compliance. Confirmed
violations take precedence over indeterminate results. The `check.json` file
contains the exact policy and evaluation counts for the gate.

## Private registries

For private image, Dialect, or Policy Pack repositories, configure the runner's
Docker credential file or helper. Rootform uses standard `DOCKER_CONFIG`;
credentials never appear in arguments, locks, output, or vendor content.

## Examples

- [GitHub Actions](github-actions.yml) installs the exact release through a
  checksum-verifying setup Action.
- [GitLab CI](gitlab-ci.yml) and
  [Azure Pipelines](azure-pipelines.yml) use the exact official image tag.
- [Generic CI](generic-ci.sh) assumes an exact checksum-verified binary is
  already on `PATH`.
