---
title: "GitHub Actions"
description: "Install an exact Rootform release, build and compare architecture evidence, and gate on policy status in a workflow."
---

The Rootform Action installs a checksum-verified Rootform release and invokes
the CLI. It reports the CLI's own results; it does not re-interpret Terraform,
compute architecture semantics, or create or edit `rootform.lock`. Two
entrypoints share one installer:

- `setup` installs and verifies the binary only;
- the main entrypoint installs the binary, prepares the project's exact
  selection, runs build and check, and reports results.

## Install the CLI for controlled commands

Use `setup` when a workflow runs commands you control: a build-only job, a
custom output path, an explicit local Policy Pack, or a custom gate.

```yaml title=".github/workflows/architecture.yml"
name: Architecture
on: [pull_request]
permissions:
  contents: read
jobs:
  architecture:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
      - uses: rootform-dev/action/setup@71eef759bff5e73b27489b1f7de818a4a76dc2e9
        with:
          version: 0.1.0
      - run: |
          rootform init ./infra --locked --no-input
          rootform build ./infra --locked --output architecture.json
          rootform check ./infra --locked --format sarif --output policy.sarif
```

`setup` installs an exact release and verifies its checksum and identity. It
never prepares external packages and never runs analysis. The example assumes a
committed `rootform.lock` in `infra`; `init` verifies local entries and
fetches only missing exact pinned packages. `build` and `check` then perform
no acquisition, and their outputs stay local until a later step uploads them.

A supplied-only build needs no lock, no `init`, and no `--locked`:

```yaml
- run: rootform build ./infra --output architecture.json
```

Omit `check` in that case: no Policy Pack is selected, and a zero-policy check
is not compliant.

## Run analysis with the main entrypoint

The main entrypoint installs the binary, prepares the project, builds
architecture and HTML evidence, evaluates policies, uploads artifacts, and
writes a Job Summary and outputs:

```yaml
- uses: rootform-dev/action@71eef759bff5e73b27489b1f7de818a4a76dc2e9
  with:
    version: 0.1.0
    path: ./infra
    locked: true
```

Preparation runs one non-interactive `rootform init` command, with
`--no-input` always present and `--locked` and `--offline` added when those
inputs are set. `locked` requires an existing valid `rootform.lock`; the CLI
rejects a missing or invalid lock, and the job stops with the CLI diagnostic.
`offline` is independent and disables network, so the pinned content must
already exist locally. The Action never writes the lock.

The main entrypoint always evaluates policies. The project needs a committed
lock that selects a Policy Pack whose policies have targets for the expected
architecture. Without that selection, check reports `not evaluated` and the
machine result uses `not_evaluated`; the step fails. Check exit status drives
the gate:

| Status | Meaning | Step result |
| --- | --- | --- |
| `0` | Every selected policy was evaluated and compliant. | Pass. |
| `1` | At least one confirmed violation. | Fail unless `fail-on-violations: false`. |
| `2` | Invalid command use. | Always fail. |
| `3` | Indeterminate or not evaluated. | Always fail. |

`fail-on-violations` controls status `1` only. Status `2` and `3` fail
regardless, because the run produced no compliant verdict. The `exit-code`
output preserves the exact check status for later steps.

Set `report-diff: true` to compare revisions. In source mode, `baseline-path`
must name a separate checkout of the base revision. Action uses same binary for
both sides, but each checkout retains its own `rootform.lock`; it neither copies
nor synchronizes selection. Keep effective Dialect selections equal when review
should isolate source change. A mismatch remains visible through Diff semantic
comparability and undetermined results.

Action emits Diff JSON and Markdown, and `fail-on-changes` gates Diff status `1`
independently. In plan mode, no baseline is needed because
`rootform diff --plan` derives both sides from one plan. Use `setup` with
explicit commands when workflow only needs Architecture IR or Diff without a
policy gate.

See the [Action input reference](https://github.com/rootform-dev/action/blob/main/README.md)
for the full input, output, and artifact surface.

## Pull-request reports

PR reporting is opt-in and explicit. An ordinary analysis never posts a
comment; the workflow must use the documented event, permissions, and
`pull-request-token` input. Follow the
[PR reporting workflow](https://github.com/rootform-dev/action/blob/main/README.md#pull-request-architecture-review)
for the exact supported setup.

Use the `pull_request` event. A same-repository PR with a
`pull-request-token` receives an updated comment. Fork pull requests receive
the Job Summary and artifact evidence without any write token. Do not switch
to `pull_request_target`, which would grant an untrusted contribution more
privileges.

## Keep evidence reproducible

Pin the exact Rootform version and the Action commit. Review and commit
`rootform.lock` when the project has explicit external selection; use
`offline: true` only when the required pinned content is already local or
vendored. Artifacts contain selected Rootform results, not raw Terraform plans,
state, credentials, or the whole working directory.

A check with no selected policies is not a compliance review. Confirm the
expected evaluation count and preserve indeterminate status `3`. Read
[Policies and Policy Packs](../concepts/policies.md) and
[Outputs and exit status](../reference/outputs.md) before choosing a gate.
